// js/scenes/SlotMachine.js
import { api } from '../utils/api.js';

export class SlotMachine extends Phaser.Scene {
  constructor(){ super('SlotMachine'); }

  // =================== PARAMS À FIGER ICI ===================
  FIXED_LAYOUT = {
    // >>> Remplace ces valeurs par celles que tu as calées <<<
    WIN:   { x: 274, y: 125, w: 720, h: 410 }, // fenêtre des rouleaux (px scène)
    GAP_X: 19,                                  // espace entre colonnes
    COLS:  5,
    ROWS:  3
  };

  // Levier: position relative au bord droit/centre de la fenêtre de reels
  LEVER = {
    dx: 60,   // décalage horizontal (vers la gauche si négatif)
    dy: -64,   // décalage vertical (vers le haut si négatif)
    padRight: 60,   // marge à droite de la fenêtre
    anchor: 0.50,   // 0 = haut de la fenêtre, 0.5 = milieu, 1 = bas
    scale: 0.9
  };

  // Reels (strip)
  STRIP_W = 134; SYMBOL_H = 134; SYMBOL_CNT = 10;

  // Payout par LIGNE pour une mise unitaire (stake=1)
  PAYTABLE = { 3: 10, 4: 50, 5: 500 };

  // Mise par ligne (stake) → totalBet = lines * stake
  stake = 1;   // 1 crédit / ligne



  // HELPERS
  _hasAudio(k){ return this.cache?.audio?.exists?.(k); }
  _add(k,cfg={}){ return this._hasAudio(k) ? this.sound.add(k,cfg) : null; }
  _play(k,cfg={}){ if(this._hasAudio(k)) this.sound.play(k,cfg); }

  //Bouton home (haut droite)
  _makeHomeButton(){
    const pad = 14;           // marge au bord
    const targetW = 48;       // largeur visuelle en px (ajuste si besoin)
    const depth = 1000;       // au-dessus de tout

    // si déjà créé (recreate/wake), on le détruit proprement
    if (this.homeBtn && !this.homeBtn.destroyed) this.homeBtn.destroy();

    // calcule un scale pour garder le ratio du PNG
    const tex = this.textures.get('home').getSourceImage();
    const scale = targetW / tex.width;

    // création
    this.homeBtn = this.add.image(this.scale.width - pad, pad, 'home')
      .setOrigin(1, 0)
      .setScale(scale)
      .setAlpha(0.95)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true });

    // petits feedbacks visuels
    this.homeBtn
      .on('pointerover', () => this.homeBtn.setTint(0xa0e8ff))
      .on('pointerout',  () => this.homeBtn.clearTint())
      .on('pointerdown', () => { this._play?.('ui_click_down',{volume:0.5}); this.homeBtn.setTint(0x77d6ff); })
      .on('pointerup',   () => { this._play?.('ui_click_up',{volume:0.5}); this.scene.start('Menu'); });

    // repositionne si la fenêtre change
    this.scale.on('resize', (gs)=>{
      this.homeBtn.setPosition(gs.width - pad, pad);
    }, this);

    // Raccourcis clavier (ESC et H)
    this.input.keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.ESC, Phaser.Input.Keyboard.KeyCodes.H]);
    // évite d’empiler les handlers si la scène est recréée
    this._goMenu?.off?.(); // no-op si pas défini
    this._goMenu = ()=> this.scene.start('Menu');
    this.input.keyboard.off('keydown-ESC', this._goMenu, this);
    this.input.keyboard.off('keydown-H',   this._goMenu, this);
    this.input.keyboard.on('keydown-ESC', this._goMenu, this);
    this.input.keyboard.on('keydown-H',   this._goMenu, this);

    // clean
    this.events.once('shutdown', ()=>{
      this.input.keyboard.off('keydown-ESC', this._goMenu, this);
      this.input.keyboard.off('keydown-H',   this._goMenu, this);
    });
  }


  // overlay
  _prepSpin(){
    if (this.isSpinning) return;
    this._clearHighlights();               // <-- enlève l’overlay tout de suite
    this._play('ui_click_down',{volume:0.5});
    this.lever?.play('lever_pull');        // déclenche l’anim, qui appellera _doSpin() en complete
  }


  // ----- Crédits -----
  _getCredits(){
    const u = this.registry.get('user') || {};
    return Number.isFinite(u.credits) ? u.credits : 0;
  }
  _setCredits(next){
    const u = this.registry.get('user') || {};
    const val = Math.max(0, Math.floor(next));
    this.registry.set('user', { ...u, credits: val }); // <-- correct
    this.game.events.emit('credits:update', val);
    if (this.creditsDigits) this.creditsDigits.setValue(val);
  }

  _debitBet(){
    const cost = Math.max(0, (this.stake|0) * (this.lines|0)); // total = stake/ligne × nb lignes
    if (cost > 0){
      const cur  = this._getCredits();
      const next = Math.max(0, cur - cost);
      if (this.creditsDigits) this.creditsDigits.animateTo(next, 250);
      this._setCredits(next);
      // Mets aussi à jour la valeur affichée de mise totale si tu changes stake/lines ailleurs
      if (this.betDigits) this.betDigits.setValue(cost);
    }
  }

  _animateCreditGain(amount){
    if (!amount || amount <= 0) return;

    const start  = this._getCredits();
    const target = start + Math.floor(amount);
    const haveTick = this._hasAudio && (this._hasAudio('coin_tick') || this._hasAudio('win_small'));

    // Limite à ~250 ticks max pour ne pas traîner trop longtemps
    const maxTicks = 250;
    const step = 1;
    const intervalMs = 16; // ~60 fps

    let cur = start;
    const tickOnce = ()=>{
      if (cur >= target){
        this._setCredits(target);
        return;
      }
      cur = Math.min(target, cur + step);
      if (this.creditsDigits) this.creditsDigits.setValue(cur);
      if (haveTick){
        const k = this._hasAudio('coin_tick') ? 'coin_tick' : 'win_small';
        this._play(k, { volume: 0.35 });
      }
      this.time.delayedCall(intervalMs, tickOnce);
    };

    // petit déclencheur de “rattle” si dispo
    this._play && this._play('payout_rattle',{volume:0.5});
    tickOnce();
  }


  // ----- Outils de grille / lignes actives -----
  // novelle méthode
  // NOTE: orientation du strip
  // Si le strip défile vers le haut ou que l'ordre des symboles est inversé,
  // la rangée du milieu et du bas sont (top-1) et (top-2).
  // Si un jour tu inverses les strips, remets (top+1)/(top+2).

  _gridFromTops(tops){
    const N = this.SYMBOL_CNT;
    const rows = [[],[],[]];
    for (let c=0; c<this.COLS; c++){
      const t = ((tops[c] % N)+N)%N;
      rows[0].push(t);
      rows[1].push((t-1+N)%N);   // <-- sens inversé
      rows[2].push((t-2+N)%N);   // <-- sens inversé
    }
    return rows;
  }

  _activeRows(){
    // 1 ligne => milieu, 3 lignes => les 3 horizontales
    if (this.lines >= 3) return [0,1,2];
    return [1];
  }

  // ----- Évaluation des gains (joker=0, runs contigus n'importe où) -----
  // Calcule le payout total (joker=0, runs contigus n'importe où)
  _evaluatePayout(tops, stake=this.stake, lines=this.lines){
    const hits = this._findWinningSegments(tops, lines);
    let total = 0;
    for (const h of hits){
      const mult = this.PAYTABLE[h.len] || 0;     // ex: {3:10, 4:50, 5:500}
      total += mult * Math.max(1, stake|0);
    }
    return total;
  }


  // Renvoie les segments gagnants sur les lignes actives
  // -> [{ row, start, len }]
  _findWinningSegments(tops, lines=this.lines){
    const rows = this._gridFromTops(tops);              // [3][COLS]
    const active = (lines >= 3) ? [0,1,2] : [1];        // 3 lignes ou juste la du milieu
    const hits = [];

    // plus long run contigu n'importe où, avec 0=wild
    const bestRunWithWild = (arr)=>{
      let bestLen=0, bestStart=-1;
      for (let s=0; s<=this.COLS-3; s++){
        let match=null, len=0, hasReal=false;
        for (let c=s; c<this.COLS; c++){
          const sym = arr[c];
          if (sym === 0){                // joker → prolonge
            len++;
          } else if (match===null || sym===match){
            match=sym; len++; hasReal=true;
          } else {
            break;
          }
        }
        if (hasReal && len>bestLen){ bestLen=len; bestStart=s; }
      }
      return { len:bestLen, start:bestStart };
    };

    for (const r of active){
      const { len, start } = bestRunWithWild(rows[r]);
      if (len >= 3 && start >= 0) hits.push({ row:r, start, len });
    }
    return hits;
  }


  // ---- Lecture fiable des tops affichés ----
  _topIndex(tile){
    const N = this.SYMBOL_CNT;
    const r = Math.round(this._rowsFrom(tile));   // snap à l'entier
    return ((r % N) + N) % N;                     // modulo positif
  }

  _readTopIndices(){
    // renvoie un array [topCol0, topCol1, ...] LUS à l’écran
    return this.reels.map(t => this._topIndex(t));
  }



  async _refreshCredits(){
    try{
      const me = await api('api/me');
      if (me?.user && Number.isFinite(me.user.credits)) this._setCredits(me.user.credits);
    }catch{}
  }

  // Essaye d'enregistrer le gain côté back
  async _persistPayout(payout, tops){
    if (!payout || payout <= 0) return;
    try{
      const r = await api('api/slot/settle', {
        method:'POST',
        body:{ payout, bet:this.stake, lines:this.lines, grid: tops }
      });
      // console.debug('settle', r);
      if (Number.isFinite(r?.credits)) { this._setCredits(r.credits); return; }
    }catch(e){
      // console.warn('settle failed', e);
    }
  }








  //END HELPERS



  preload(){
    // Visuels
    //this.load.image('slot-bg',    'assets/slot/slot-background.png');
    this.load.video('slot-bg', 'assets/slot/bg.mp4', 'loadeddata', false, true);
    this.load.image('frame',      'assets/slot/cadre-slot.png');
    this.load.image('reel_clear', 'assets/slot/reel_clear.png');
    this.load.image('reel_blur',  'assets/slot/reel_blur.png');
    this.load.image('home', 'assets/slot/home.png');


    // digits 0..9 + blank
    for (let i=0; i<=9; i++) this.load.image(`digit${i}`, `assets/slot/ui/digit${i}.png`);
    this.load.image('digitblank', 'assets/slot/ui/digitblank.png');


    // Levier en spritesheet (5 frames horizontales)
    this.load.spritesheet('lever', 'assets/slot/ui/lever.png', {
      frameWidth: 77,   // ajuste si ton spritesheet a d'autres dimensions
      frameHeight: 351,
      endFrame: 4
    });

    // SFX (ignorés s’ils manquent)
    ['spin_start','spin_loop','stop1','stop2','stop3','stop4','stop5','win_small','win_big','ui_click_down','ui_click_up','payout_rattle']
      .forEach(k=> this.load.audio(k, `assets/slot/sfx/${k}.ogg`));
  }


  // État de jeu basique (mise & lignes)
  lines = 1;
  bet   = 1;


  _hl = [];
  _clearHighlights(){
    if (!this._hl || !this._hl.length) return;
    this._hl.forEach(o=>{
      this.tweens.killTweensOf(o); // stoppe le pulse
      o.destroy();
    });
    this._hl.length = 0;
  }

  _showHighlights(hits){
    if(!hits?.length) return;
    const { x, y, w, h } = this.win;
    const reelW = (w - (this.COLS-1)*this.reelGapX)/this.COLS;
    const cellH = h / this.ROWS;
    hits.forEach(({row,start,len})=>{
      for(let k=0;k<len;k++){
        const c = start + k;
        const cx = x + c*(reelW + this.reelGapX) + reelW/2;
        const cy = y + (row+0.5)*cellH;
        const r = this.add.rectangle(cx, cy, reelW*0.92, cellH*0.9, 0x00ff7f, 0.22)
          .setDepth(450).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets:r, alpha:0.8, duration:160, yoyo:true, repeat:2, ease:'Sine.InOut' });
        this._hl.push(r);
      }
    });
  }



  /**
   * Crée un affichage de chiffres monospaces.
   * cfg = { x, y, digits=4, height=48, spacing=0.88, align:'center', depth=300, pad:'blank'|'zero' }
   * Retourne un objet avec : setValue(n), animateTo(n,dur=700), setHeight(h), setPosition(x,y), setAlign(a)
   */
  _createDigits(cfg={}){
    const pad    = cfg.pad ?? 'blank';
    const n      = cfg.digits ?? 4;
    const height = cfg.height ?? 48;
    const spacing= cfg.spacing ?? 0.88;
    const depth  = cfg.depth ?? 300;
    const align  = cfg.align ?? 'center';
    const x0     = cfg.x ?? 0, y0 = cfg.y ?? 0;

    // taille native d'un digit (supposés identiques)
    const baseTex = this.textures.get('digit0').getSourceImage();
    const baseW = baseTex.width, baseH = baseTex.height;
    const scale = height / baseH;
    const dispW = baseW * scale, dispH = height;

    // conteneur
    const cont = this.add.container(x0, y0).setDepth(depth);

    // crée les sprites
    const sprites=[];
    for (let i=0;i<n;i++){
      const spr = this.add.image(0,0,'digitblank').setOrigin(0.5,0.5).setDepth(depth);
      spr.setDisplaySize(dispW, dispH);
      sprites.push(spr); cont.add(spr);
    }

    // aligne horizontalement
    const _layout = ()=>{
      const total = n * dispW + (n-1) * (dispW*(1-spacing));
      let left = 0;
      if (align==='center') left = -total/2 + dispW/2;
      else if (align==='left') left = dispW/2;
      else if (align==='right') left = -total + dispW/2;

      const step = dispW * spacing;
      sprites.forEach((spr,i)=> spr.setPosition(left + i*step, 0));
    };
    _layout();

    // méthodes publiques
    const api = {
      container: cont,
      setHeight: (h)=>{
        const s = h / baseH;
        const w = baseW * s;
        sprites.forEach(spr=> spr.setDisplaySize(w, h));
        _layout(); return api;
      },
      setPosition: (x,y)=>{ cont.setPosition(x,y); return api; },
      setAlign: (a)=>{ api.align=a; _layout(); return api; },
      setValue: (val)=>{
        // supporte number ou string; valeurs négatives affichées sans signe
        const sVal = String(Math.max(0, parseInt(val||0,10)));
        const chars = sVal.split('');
        const start = Math.max(0, n - chars.length);
        for (let i=0;i<n;i++){
          if (i < start){
            sprites[i].setTexture(pad==='zero' ? 'digit0' : 'digitblank');
          }else{
            const d = chars[i - start];
            sprites[i].setTexture(`digit${d}`);
          }
        }
        return api;
      },
      animateTo: (target, dur=700)=>{
        const obj={ v: 0 };
        // part de la valeur affichée actuelle (reconstruite)
        let cur='';
        for (const spr of sprites){
          const key = spr.texture?.key || 'digitblank';
          cur += (key.startsWith('digit') && key!=='digitblank') ? key.replace('digit','') : '';
        }
        obj.v = parseInt(cur||'0',10);
        this.tweens.add({
          targets: obj, v: target, duration: dur, ease: 'Cubic.Out',
          onUpdate: ()=> api.setValue(Math.floor(obj.v))
        });
        return api;
      }
    };
    return api.setHeight(height); // applique height + layout
  }




  create(){
    const W=this.scale.width, H=this.scale.height;
    this.add.image(W/2, H/2, 'slot-bg').setDisplaySize(W, H);

    //Backgroung animé
    const bgVideo = this.add.video(this.scale.width/2, this.scale.height/2, 'slot-bg')
      .setOrigin(0.5)
      .setDepth(0)     // mettre plus bas si besoin, ex: -10
      .setMute(true)
      .setLoop(true);

    // helper: couvre tout l’écran en gardant le ratio
    const fitVideoCover_bg = () => {
      const W_bg  = this.scale.width;
      const H_bg  = this.scale.height;
      const vw_bg = bgVideo.video?.videoWidth  || bgVideo.width  || 1;
      const vh_bg = bgVideo.video?.videoHeight || bgVideo.height || 1;
      const s_bg  = Math.max(W_bg / vw_bg, H_bg / vh_bg); // COVER (remplir)
      bgVideo.setDisplaySize(vw_bg * s_bg, vh_bg * s_bg);
      bgVideo.setPosition(W_bg / 2, H_bg / 2);
    };

    //bouton home
    this._makeHomeButton();


    // ajuste quand la vidéo démarre + maintenant + sur resize
    bgVideo.once('play', fitVideoCover_bg);
    bgVideo.play(true);
    fitVideoCover_bg();
    this.scale.on('resize', fitVideoCover_bg, this);

    // ===== Fenêtre FIXE des rouleaux =====
    const { WIN, GAP_X, COLS, ROWS } = this.FIXED_LAYOUT;
    this.win = { ...WIN };
    this.reelGapX = GAP_X;
    this.COLS = COLS; this.ROWS = ROWS;

    // ===== Crée les reels =====
    this._createReels();

    // ===== Cadre au-dessus (trou transparent) =====
    this.add.image(W/2, H/2, 'frame')
      .setDepth(500)
      .setDisplaySize(W*0.86, H*0.92);

    // ===== Levier animé (unique) =====
    this.anims.create({
      key:'lever_pull',
      frames:this.anims.generateFrameNumbers('lever',{start:0,end:4}),
      frameRate:24, yoyo:true
    });

    const leverX = this.win.x + this.win.w + this.LEVER.padRight + this.LEVER.dx;
    const leverY = this.win.y + this.win.h * this.LEVER.anchor + this.LEVER.dy;

    // (sécurité) si un levier existait déjà après un wake/restart, on le détruit
    if (this.lever && !this.lever.destroyed) this.lever.destroy();

    this.lever = this.add.sprite(leverX, leverY, 'lever', 0)
      .setScale(this.LEVER.scale)
      .setDepth(600)
      .setInteractive({ useHandCursor:true });

    this.lever.on('pointerdown', ()=> this._prepSpin());
    this.lever.on('pointerup',   ()=> this._play('ui_click_up',{volume:0.5}));
    this.lever.on('animationcomplete', a=>{ if(a.key==='lever_pull') this._doSpin(); });

    // ===== Clavier: barre d’espace =====
    this.input.keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    // évite d’empiler des listeners si la scène est recréée
    this.input.keyboard.off('keydown-SPACE', this._prepSpin, this);
    this.input.keyboard.on('keydown-SPACE', ()=> this._prepSpin(), this);

    // nettoie le listener si la scène est détruite
    this.events.once('shutdown', ()=>{
      this.input.keyboard.off('keydown-SPACE', this._prepSpin, this);
    });


    // HUD
    this.statusText = this.add.text(14,14,'Ready',{fontFamily:'system-ui,Arial',fontSize:'16px',color:'#fff'}).setDepth(999);

    // --- DIGITS (simple) — édite SEULEMENT ces nombres :
    const DIGITS_Y   = this.win.y + this.win.h + 82; // Y commun
    const DIGIT_H    = 58;    // hauteur des chiffres
    const DIGIT_SP   = 0.95;  // espacement entre chiffres
    const DIGIT_DEPTH= 300;   // ⬅️ profondeur voulue (doit être < depth du cadre, ex: cadre=900)

    const X_GAINS    = this.win.x + 115;
    const X_CREDITS  = this.win.x + 470;
    const X_MISE     = this.win.x + 675;

    // crée/replace les tableaux (⚠️ on passe depth)
    this.winDigits     = this._createDigits({ x:X_GAINS,   y:DIGITS_Y, digits:4, height:DIGIT_H, spacing:DIGIT_SP, align:'center', depth:DIGIT_DEPTH });
    this.creditsDigits = this._createDigits({ x:X_CREDITS, y:DIGITS_Y, digits:6, height:DIGIT_H, spacing:DIGIT_SP, align:'center', depth:DIGIT_DEPTH });
    this.betDigits     = this._createDigits({ x:X_MISE,    y:DIGITS_Y, digits:3, height:DIGIT_H, spacing:DIGIT_SP, align:'center', depth:DIGIT_DEPTH });




    // valeurs initiales
    this.lines = 3;                 // 3 lignes actives
    this.stake = this.stake ?? 1;   // 1 crédit / ligne
    this.bet   = this.lines * this.stake;



    this.winDigits.setValue(0);
    const u0 = this.registry.get('user') || {};
    this.creditsDigits.setValue(Number.isFinite(u0.credits)? u0.credits : 0);
    this.betDigits.setValue(this.bet);

    // maj auto crédits si l'app émet 'credits:update'
    this.game.events.on('credits:update', c=> this.creditsDigits.setValue(c));


    // Spin config
    this.cfg={ STAGGER:500, LIFT_ROWS:0.35, LIFT_MS:140, SPIN_MS:3000, STOP_MS:1100, BASE_CYCLES:6, DIR:-1 };
    this.isSpinning=false; this._spinLoop=null;
    this._stopKeys=['stop1','stop2','stop3','stop4','stop5'].filter(k=> this.cache.audio.exists(k));

    // --- Mise & lignes ---
    this.lines = 3;           // 3 lignes actives (horizontales)
    this.stake = 1;           // 1 crédit par ligne
    this.bet   = this.lines * this.stake; // mise totale du spin (affichée)

    // si tes digits existent déjà :
    if (this.betDigits)     this.betDigits.setValue(this.bet);
    if (this.creditsDigits) this.creditsDigits.setValue(this._getCredits ? this._getCredits() : 0);
    if (this.winDigits)     this.winDigits.setValue(0);


    // Dev helper (facultatif) : pour récupérer les valeurs actuelles depuis la console
    window.slot = this; // dans la console:  copy(JSON.stringify({ WIN: slot.win, GAP_X: slot.reelGapX }))
  }

  // ---------- Création des rouleaux à partir du layout fixe ----------
  _createReels(){
    const {x,y,w,h} = this.win;
    const reelW = (w - (this.COLS-1)*this.reelGapX) / this.COLS;
    const reelH = h;

    this.reels = [];
    for(let i=0;i<this.COLS;i++){
      const cx = x + i*(reelW + this.reelGapX) + reelW/2;
      const cy = y + reelH/2;
      const t  = this.add.tileSprite(cx, cy, reelW, reelH, 'reel_clear')
        .setOrigin(0.5).setDepth(400);
      t.tileScaleX = reelW / this.STRIP_W;
      t.tileScaleY = reelH / (this.ROWS*this.SYMBOL_H);
      const r0 = Phaser.Math.Between(0, this.SYMBOL_CNT-1);
      t.tilePositionY = -r0 * this.SYMBOL_H;
      this.reels.push(t);
    }
  }

  // =================== SPIN (timeline robuste) ===================
  async _doSpin(){

    // Audio (tolérant si tu as les helpers _add/_play)
    this._play && this._play('spin_start',{volume:0.7});
    this._spinLoop = this._add ? this._add('spin_loop',{loop:true,volume:0.35})
                                   : this.sound.add('spin_loop',{loop:true,volume:0.35});
    if(this._spinLoop) this._spinLoop.play();

    if(this.isSpinning) return;
    this.isSpinning = true;
    this._clearHighlights();
    this.statusText.setText('Spinning…');

    // Débit local de la mise (avant l'API)
    this._debitBet();


    // Cible API -> fallback local
    let targetTops=[];
    try{
      const res = await api('api/slot/spin',{ method:'POST', body:{ bet:this.bet, lines:this.lines } });

      if(res?.grid?.length===this.COLS) targetTops = res.grid.map(col => col[0] ?? Phaser.Math.Between(0,this.SYMBOL_CNT-1));
      this._pendingPayout = Number.isFinite(res?.payout) ? res.payout : null;
      this._pendingCredits= Number.isFinite(res?.credits)? res.credits : null;
    }catch(e){}
    if(targetTops.length!==this.COLS){
      targetTops = Array.from({length:this.COLS}, ()=> Phaser.Math.Between(0,this.SYMBOL_CNT-1));
      this._pendingPayout = this._pendingCredits = null;
    }

    const N=this.SYMBOL_CNT, DIR=this.cfg.DIR;
    const LIFT=this.cfg.LIFT_ROWS, CYC=this.cfg.BASE_CYCLES;
    const LIFT_MS=this.cfg.LIFT_MS, SPIN_MS=this.cfg.SPIN_MS, STOP_MS=this.cfg.STOP_MS, STAG=this.cfg.STAGGER;

    // Fin robuste + failsafe
    let finished=false, doneCols=0;
    const finalize=()=>{
      if (finished) return;
      finished = true;
      if (this._spinLoop) this._spinLoop.stop();

      // ⬇️ LIRE ce qui est vraiment affiché
      const shownTops = this._readTopIndices();
      this._onSpinEnd(shownTops);
    };

    const budget = LIFT_MS + SPIN_MS + STOP_MS + (this.reels.length-1)*STAG + 800;
    this.time.delayedCall(budget, finalize);

    // Chaîne de 3 tweens par colonne (un seul tileSprite)
    this.reels.forEach((tile, i)=>{
      const start = Math.round(-tile.tilePositionY / this.SYMBOL_H); // ENTIER
      const rLift = start + DIR*LIFT;
      const rSpin = rLift + DIR*((CYC+i)*N - LIFT);                  // ENTIER
      const at = ((rSpin % N) + N) % N;
      const tt = ((targetTops[i] % N) + N) % N;
      const steps = (DIR===-1) ? ((at - tt + N) % N) : ((tt - at + N) % N);
      const rStop = rSpin + DIR*steps;                               // ENTIER -> ENTIER

      const counter = { r:start };

      const stage3 = ()=>{
        this.tweens.add({
          targets: counter, r: rStop, duration: STOP_MS, ease: 'Cubic.Out',
          onStart: ()=> tile.setTexture('reel_clear'),
          onUpdate: ()=> { tile.tilePositionY = -counter.r * this.SYMBOL_H; },
          onComplete: ()=>{
            const rStopInt = Math.round(rStop);
            tile.tilePositionY = -rStopInt * this.SYMBOL_H;  // verrouille pile
            if(this._stopKeys?.length){
              const k = this._stopKeys[i % this._stopKeys.length];
              this._play ? this._play(k,{volume:0.6}) : this.sound.play(k,{volume:0.6});
            }
            if(++doneCols === this.reels.length) finalize();
          }
        });
      };

      const stage2 = ()=>{
        this.tweens.add({
          targets: counter, r: rSpin, duration: SPIN_MS, ease: 'Linear',
          onStart: ()=> tile.setTexture('reel_blur'),
          onUpdate: ()=> { tile.tilePositionY = -counter.r * this.SYMBOL_H; },
          onComplete: stage3
        });
      };

      const stage1 = ()=>{
        this.tweens.add({
          targets: counter, r: rLift, duration: LIFT_MS, ease: 'Sine.Out',
          onUpdate: ()=> { tile.tilePositionY = -counter.r * this.SYMBOL_H; },
          onComplete: stage2
        });
      };

      this.time.delayedCall(i*STAG, stage1);
    });
  }




  _onSpinEnd(targetTops){
    // 1) Déterminer le payout : API > sinon calcul local
    let p = Number.isFinite(this._pendingPayout) ? this._pendingPayout : null;
    if (!Number.isFinite(p)) {
      p = this._evaluatePayout(targetTops, this.stake, this.lines); // ← stake par ligne
    }


    // Surlignage des segments gagnants
    const hits = this._findWinningSegments(targetTops, this.lines);
    if (this._clearHighlights) this._clearHighlights();
    if (this._showHighlights)  this._showHighlights(hits);



    // 2) SFX + digits WIN
    if (p >= 100) this._play('win_big',{volume:0.9});
    else if (p > 0) this._play('win_small',{volume:0.8});

    if (this.winDigits){
      if (p > 0) this.winDigits.animateTo(p, 800);
      else       this.winDigits.setValue(0);
    }

    // 3) Crédits finaux
    // a) on applique le solde renvoyé par /spin (après débit)
    if (Number.isFinite(this._pendingCredits)) {
      this._setCredits(this._pendingCredits);
    }

    // b) si gain, on anime localement ET on crédite en DB via /api/slot/settle
    if (p > 0) {
      this._animateCreditGain(p); // animation +1 côté client
      void this._persistPayout(p, targetTops).then(() => this._refreshCredits());
    } else {
      void this._refreshCredits(); // pas de gain : on reste calé au back
    }



    // 4) Fin
    this.statusText.setText(`Top: ${targetTops.join(' ')}`);
    this.isSpinning = false;
    this._pendingPayout = null;
    this._pendingCredits = null;
  }



  // ---------- Helpers ----------
  _rowsFrom(tile){ return -tile.tilePositionY / this.SYMBOL_H; }
  _setRows(tile,r){ tile.tilePositionY = -r * this.SYMBOL_H; }
  _mod(a,b){ return ((a%b)+b)%b; }
  //_play(key,cfg={}){ if(this.cache.audio.exists(key)) this.sound.play(key,cfg); }
}
