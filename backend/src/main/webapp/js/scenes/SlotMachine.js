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

  // Helpers
  _hasAudio(k){ return this.cache?.audio?.exists?.(k); }
  _add(k,cfg={}){ return this._hasAudio(k) ? this.sound.add(k,cfg) : null; }
  _play(k,cfg={}){ if(this._hasAudio(k)) this.sound.play(k,cfg); }


  preload(){
    // Visuels
    this.load.image('slot-bg',    'assets/slot/slot-background.png');
    this.load.image('frame',      'assets/slot/cadre-slot.png');
    this.load.image('reel_clear', 'assets/slot/reel_clear.png');
    this.load.image('reel_blur',  'assets/slot/reel_blur.png');


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


  /**
   * Crée un affichage de chiffres monospaces.
   * cfg = { x, y, digits=4, height=48, spacing=0.88, align:'center', depth=520, pad:'blank'|'zero' }
   * Retourne un objet avec : setValue(n), animateTo(n,dur=700), setHeight(h), setPosition(x,y), setAlign(a)
   */
  _createDigits(cfg={}){
    const pad    = cfg.pad ?? 'blank';
    const n      = cfg.digits ?? 4;
    const height = cfg.height ?? 48;
    const spacing= cfg.spacing ?? 0.88;
    const depth  = cfg.depth ?? 520;
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

    // ===== Levier animé (repositionné à gauche/haut via dx/dy) =====
    this.anims.create({ key:'lever_pull',
      frames:this.anims.generateFrameNumbers('lever',{start:0,end:4}),
      frameRate:24, yoyo:true
    });
    const leverX = this.win.x + this.win.w + this.LEVER.padRight + this.LEVER.dx;
    const leverY = this.win.y + this.win.h * this.LEVER.anchor + this.LEVER.dy;

    const lever = this.add.sprite(leverX, leverY, 'lever', 0)
      .setScale(this.LEVER.scale)
      .setDepth(600)
      .setInteractive({ useHandCursor:true });

    lever.on('pointerdown', ()=>{ if(!this.isSpinning){ this._play('ui_click_down',{volume:0.5}); lever.play('lever_pull'); }});
    lever.on('pointerup',   ()=> this._play('ui_click_up',{volume:0.5}));
    lever.on('animationcomplete', a=>{ if(a.key==='lever_pull') this._doSpin(); });

    // HUD
    this.statusText = this.add.text(14,14,'Ready',{fontFamily:'system-ui,Arial',fontSize:'16px',color:'#fff'}).setDepth(999);

    // --- DIGITS (simple) — édite SEULEMENT ces nombres :
    const DIGITS_Y  = this.win.y + this.win.h + 82; // Y commun
    const DIGIT_H   = 58;    // hauteur des chiffres
    const DIGIT_SP  = 0.95;  // espacement entre chiffres (0.80 serré → 0.95 aéré)

    const X_GAINS   = this.win.x + 115; // centre "Gains"
    const X_CREDITS = this.win.x + 470; // centre "Crédits"
    const X_MISE    = this.win.x + 675; // centre "Mise"

    // crée/replace les tableaux
    this.winDigits     = this._createDigits({ x:X_GAINS,   y:DIGITS_Y, digits:4, height:DIGIT_H, spacing:DIGIT_SP, align:'center' });
    this.creditsDigits = this._createDigits({ x:X_CREDITS, y:DIGITS_Y, digits:6, height:DIGIT_H, spacing:DIGIT_SP, align:'center' });
    this.betDigits     = this._createDigits({ x:X_MISE,    y:DIGITS_Y, digits:3, height:DIGIT_H, spacing:DIGIT_SP, align:'center' });



    // valeurs initiales
    this.bet = this.bet ?? 1;
    this.lines = this.lines ?? 1;

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
    if(this.isSpinning) return;
    this.isSpinning = true;
    this.statusText.setText('Spinning…');

    // Audio (tolérant si tu as les helpers _add/_play)
    this._play && this._play('spin_start',{volume:0.7});
    this._spinLoop = this._add ? this._add('spin_loop',{loop:true,volume:0.35})
                               : this.sound.add('spin_loop',{loop:true,volume:0.35});
    if(this._spinLoop) this._spinLoop.play();

    // Cible API -> fallback local
    let targetTops=[];
    try{
      const res = await api('api/slot/spin',{method:'POST',body:{bet:1,lines:1}});
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
      if(finished) return; finished=true;
      if(this._spinLoop) this._spinLoop.stop();
      this._onSpinEnd(targetTops);
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
            tile.tilePositionY = -rStop * this.SYMBOL_H;
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
    const hasPayout   = Number.isFinite(this._pendingPayout);
    const hasCredits  = Number.isFinite(this._pendingCredits);
    const p           = hasPayout ? this._pendingPayout : 0;

    // SFX gains
    if (hasPayout){
      if (p >= 100) this._play('win_big',{volume:0.9});
      else if (p > 0) this._play('win_small',{volume:0.8});
      this._play('payout_rattle',{volume:0.5});
    }

    // DIGITS: Gains
    if (this.winDigits){
      if (p > 0) this.winDigits.animateTo(p, 800);
      else       this.winDigits.setValue(0);
    }

    // DIGITS: Crédits
    if (hasCredits){
      // si l'API fournit les crédits → on pousse l'event standard
      this.game.events.emit('credits:update', this._pendingCredits);
    } else if (hasPayout && p > 0){
      // fallback: incrémente localement les crédits affichés
      const u   = this.registry.get('user') || {};
      const cur = Number.isFinite(u.credits) ? u.credits : 0;
      const next = cur + p;
      this.registry.set('user', { ...u, credits: next });
      this.game.events.emit('credits:update', next);
    }

    this.statusText.setText(`Top: ${targetTops.join(' ')}`);
    this.isSpinning = false;
    this._pendingPayout = null;
    this._pendingCredits = null;
  }


  // ---------- Helpers ----------
  _rowsFrom(tile){ return -tile.tilePositionY / this.SYMBOL_H; }
  _setRows(tile,r){ tile.tilePositionY = -r * this.SYMBOL_H; }
  _mod(a,b){ return ((a%b)+b)%b; }
  _play(key,cfg={}){ if(this.cache.audio.exists(key)) this.sound.play(key,cfg); }
}
