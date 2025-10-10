// js/scenes/SlotMachine.js
import { api } from '../utils/api.js';

export class SlotMachine extends Phaser.Scene {
  constructor(){ super('SlotMachine'); }

  preload(){
    this.load.image('slotBg',    'assets/slot/slot-background.png');
    this.load.image('slotFrame', 'assets/slot/Cadre_slot.png');
    this.load.image('reel_clear','assets/slot/reel_clear.png');
    this.load.image('reel_blur', 'assets/slot/reel_blur.png');
    this.load.image('spinBtn',   'assets/slot/spin.png');
  }

  create(){
    const { width:W, height:H } = this.scale.gameSize;
    // >>> TEMP: reels DEVANT le cadre pour debug visibilité <<<
    const DEPTH = { bg:0, frame:300, reels:350, ui:360, overlay:370 };

    this.cameras.main.setBackgroundColor('#0d1117');
    this.add.image(W/2, H/2, 'slotBg').setDisplaySize(W, H).setDepth(DEPTH.bg);


    // Fenêtre des rouleaux (même logique que Slot.js)
    const COLS = 5, ROWS = 3;
    const REELS_WIDTH  = Math.min(680, W * 0.74);
    const REELS_HEIGHT = Math.min(440, H * 0.459);
    const REELS_OFFSET_X = 0;
    const REELS_OFFSET_Y = -30.5;
    const GAP_X = 15;

    const reelW   = (REELS_WIDTH - (COLS - 1) * GAP_X) / COLS;
    const reelH   = REELS_HEIGHT;
    const winLeft = (W - REELS_WIDTH)/2 + REELS_OFFSET_X;
    const winTop  = (H - REELS_HEIGHT)/2 + REELS_OFFSET_Y;

    // Mesure réelle du strip
    const src = this.textures.get('reel_clear')?.getSourceImage();
    const STRIP_W = src?.width  || 134;
    const STRIP_H = src?.height || 1340;
    // nb de symboles d’après l’image (ex: 10)
    const SYMBOL_CNT = Math.max(1, Math.round(STRIP_H / Math.round(STRIP_H/10)));
    const SYMBOL_H   = Math.floor(STRIP_H / SYMBOL_CNT);

    // Reels (tileSprite) — AU PREMIER PLAN TEMPORAIREMENT
    this.reels = [];
    for (let i=0;i<COLS;i++){
      const x = winLeft + i*(reelW + GAP_X) + reelW/2;
      const y = winTop  + reelH/2;
      const spr = this.add.tileSprite(x, y, reelW, reelH, 'reel_clear')
        .setOrigin(0.5)
        .setDepth(DEPTH.reels);

      // montrer 3 symboles
      spr.tileScaleX = reelW / STRIP_W;
      spr.tileScaleY = reelH / (ROWS * SYMBOL_H);

      // position texture initiale + petite teinte pour debug
      spr.tilePositionY = Phaser.Math.Between(0, STRIP_H-1);
      // spr.setTint(0x88ffffff); // décommente si besoin pour “voir” les reels

      this.reels.push({ sprite:spr });
    }

    // Cadre (format exact demandé) + offsets
    const FRAME_PAD_X    = 0.80;
    const FRAME_PAD_Y    = 0.88;
    const FRAME_OFFSET_X = 0;    // + => droite,  - => gauche
    const FRAME_OFFSET_Y = -48;   // + => bas,     - => haut

    const frame = this.add
      .image(W/2 + FRAME_OFFSET_X, H/2 + FRAME_OFFSET_Y, 'slotFrame')
      .setDepth(DEPTH.frame);

    frame.setScale((W / frame.width) * FRAME_PAD_X,
                   (H / frame.height) * FRAME_PAD_Y);


    // --- HUD utilisateur (haut-droite), compact
    const HUD_RIGHT_PAD = 14;
    const HUD_TOP       = 14;
    const HUD_FONT      = 16;
    const HUD_GAP       = 18;

    const hudStyle = { fontFamily:'system-ui, Arial', fontSize: `${HUD_FONT}px`, color:'#eaf4ff' };

    // user depuis le registry (sinon on tentera /api/me)
    const user0 = this.registry.get('user') || {};
    const startUsername = user0?.username ?? '—';
    const startCredits  = user0?.credits  ?? 0;

    // X aligné à droite + origin(1,0)
    const rightX = this.scale.gameSize.width - HUD_RIGHT_PAD;

    this.userText = this.add.text(rightX, HUD_TOP, `👤 ${startUsername}`, hudStyle)
      .setOrigin(1, 0)
      .setDepth(330);
    this.creditsText = this.add.text(rightX, HUD_TOP + HUD_GAP, `💰 ${startCredits} crédits`, hudStyle)
      .setOrigin(1, 0)
      .setDepth(330);

    // helpers de màj
    const setUserHUD = (u) => {
      if (!u) return;
      if (typeof u.username === 'string') this.userText.setText(`👤 ${u.username}`);
      if (typeof u.credits  === 'number') this.creditsText.setText(`💰 ${u.credits} crédits`);
    };

    // refresh API si pas d’info locale
    const refreshUser = async () => {
      try {
        const me = await api('api/me');           // { user:{ username, credits } }
        if (me?.user) {
          this.registry.set('user', me.user);
          setUserHUD(me.user);
        }
      } catch (_) { /* non bloquant */ }
    };

    // événements de mise à jour
    this.events.on('wake', refreshUser);
    this.game.events.on('credits:update', (newCredits) => {
      const u = this.registry.get('user') || {};
      const merged = { ...u, credits: newCredits };
      this.registry.set('user', merged);
      setUserHUD(merged);
    });

    // premier affichage si registry vide
    if (!user0?.username) refreshUser();


    // ---- UI layout (réglages rapides)
    const UI = {
      // Texte "Lines • Bet"
      statusX: W / 2,
      statusY: winTop - 25,
      statusFontSize: 15,

      // Boutons Lines
      lineBtnsY: winTop + reelH + 55,
      lineBtnsGap: 165,             // écart horizontal entre les 3 boutons
      lineBtnSize: { w: 140, h: 86 },
      lineBtnFont: 14,

      // Bouton SPIN
      spinX: W / 2,
      spinY: winTop + reelH + 100,
      spinScale: 0.10,
      spinPress: 0.94,              // effet "press"
    };



    // UI (lignes fixes + spin)
    this.lineOptions = [1,3,5];
    this.lines = 3; this.bet = 3;

    this.status = this.add.text(UI.statusX, UI.statusY, '', {
      fontFamily:'monospace',
      fontSize: UI.statusFontSize,
      color:'#e6f1ff'
    }).setOrigin(0.5,1).setDepth(DEPTH.ui);
    this._refreshStatus();

    // Boutons Lines (passe les réglages UI)
    this._lineButtons(W/2, UI.lineBtnsY, UI);

    // Bouton SPIN (position + taille via UI)
    const spin = this.add.image(UI.spinX, UI.spinY, 'spinBtn')
      .setDepth(DEPTH.overlay)
      .setInteractive({ useHandCursor:true })
      .setScale(UI.spinScale);

    spin.on('pointerdown', ()=> spin.setScale(UI.spinScale * UI.spinPress));
    spin.on('pointerup', async ()=>{
      spin.setScale(UI.spinScale);
      await this._doSpin({ SYMBOL_H, STRIP_H, SYMBOL_CNT });
    });


    // Touche D = toggle profondeur (reels devant/derrière pour vérifier le cadre)
    this.input.keyboard.on('keydown-D', ()=>{
      const top = (this.reels[0].sprite.depth > frame.depth);
      this.reels.forEach(r=> r.sprite.setDepth(top ? DEPTH.frame - 1 : DEPTH.reels));
    });

    this.spinning = false;
  }

  _lineButtons(cx, y){
    const gap = 120;
    this.lineBtns = this.lineOptions.map((v, i)=>{
      const c  = this.add.container(cx + (i-1)*gap, y).setDepth(360);
      const bg = this.add.rectangle(0,0,120,30,0x14253a).setStrokeStyle(1,0x6fb1ff).setInteractive({useHandCursor:true});
      const tx = this.add.text(0,0,`${v} Lines`,{fontFamily:'monospace',fontSize:14,color:'#eaffff'}).setOrigin(0.5);
      bg.on('pointerdown',()=> bg.setScale(0.98));
      bg.on('pointerup',()=>{ bg.setScale(1); this.lines=v; this.bet=v; this._refreshStatus(); });
      c.add([bg,tx]); c.bg = bg; return c;
    });
  }
  _refreshStatus(){
    this.status.setText(`Lines: ${this.lines}   •   Bet: ${this.bet}`);
    if(this.lineBtns){
      this.lineBtns.forEach((b,i)=>{
        const sel = (this.lineOptions[i] === this.lines);
        b.bg.setStrokeStyle(1, sel ? 0x8be9fd : 0x6fb1ff);
        b.bg.fillColor = sel ? 0x1a3b55 : 0x14253a;
      });
    }
  }

  _rowsFromPos(tilePosY, SYMBOL_H, STRIP_H){
    const r = (tilePosY % STRIP_H + STRIP_H) % STRIP_H;
    return r / SYMBOL_H;
  }
  _posFromRows(rows, SYMBOL_H, STRIP_H){
    const px = rows * SYMBOL_H;
    return ((px % STRIP_H) + STRIP_H) % STRIP_H;
  }

  async _doSpin(ctx){
    if (this.spinning) return;
    this.spinning = true;

    let grid;
    try{
      const res = await api('api/slot/spin', { method:'POST', body:{ bet:this.bet, lines:this.lines } });
      grid = Array.isArray(res.grid) ? res.grid : null;
      if (typeof res.credits === 'number') this.game.events.emit('credits:update', res.credits);
    }catch{ grid = null; }
    if (!grid || grid.length<5) grid = this._randomGrid(5,3);

    // Phases
    const STAGGER=500, LIFT_ROWS=0.35, LIFT_MS=140, SPIN_MS=3000, STOP_MS=1100, BASE_CYCLES=6;
    const SPIN_DIR=-1; // descend

    const promises = this.reels.map((rw, i)=>{
      const spr = rw.sprite;
      const targetTopIndex =
        (Array.isArray(grid[i]) && grid[i].length>=3 && Number.isInteger(grid[i][0]))
          ? grid[i][0] : Phaser.Math.Between(0, ctx.SYMBOL_CNT-1);

      return new Promise(resolve=>{
        this.time.delayedCall(i*STAGGER, ()=>{

          const startRows = Math.round(this._rowsFromPos(spr.tilePositionY, ctx.SYMBOL_H, ctx.STRIP_H));
          spr.tilePositionY = this._posFromRows(startRows, ctx.SYMBOL_H, ctx.STRIP_H);

          const rLift = startRows + SPIN_DIR * LIFT_ROWS;
          const rSpin = rLift    + SPIN_DIR * ((BASE_CYCLES + i) * ctx.SYMBOL_CNT);

          // distance à la cible (respecte le sens visuel)
          const rem = ((rSpin % ctx.SYMBOL_CNT) + ctx.SYMBOL_CNT) % ctx.SYMBOL_CNT;
          let delta;
          if (SPIN_DIR === 1) delta = (targetTopIndex - rem + ctx.SYMBOL_CNT) % ctx.SYMBOL_CNT;
          else { delta = (rem - targetTopIndex + ctx.SYMBOL_CNT) % ctx.SYMBOL_CNT; delta = -delta; }
          const rStop = rSpin + delta;

          // LIFT
          this.tweens.addCounter({
            from: startRows, to: rLift, duration: LIFT_MS, ease:'Sine.easeOut',
            onUpdate:(tw,o)=> spr.tilePositionY = this._posFromRows(o.value, ctx.SYMBOL_H, ctx.STRIP_H),
            onComplete: ()=>{
              spr.setTexture('reel_blur'); // BLUR au début du rapide
              // SPIN rapide
              this.tweens.addCounter({
                from: rLift, to: rSpin, duration: SPIN_MS, ease:'Linear',
                onUpdate:(tw,o)=> spr.tilePositionY = this._posFromRows(o.value, ctx.SYMBOL_H, ctx.STRIP_H),
                onComplete: ()=>{
                  spr.setTexture('reel_clear'); // CLEAR avant le freinage
                  // STOP
                  this.tweens.addCounter({
                    from: rSpin, to: rStop, duration: STOP_MS, ease:'Cubic.easeOut',
                    onUpdate:(tw,o)=> spr.tilePositionY = this._posFromRows(o.value, ctx.SYMBOL_H, ctx.STRIP_H),
                    onComplete: resolve
                  });
                }
              });
            }
          });

        });
      });
    });

    await Promise.all(promises);
    this.spinning = false;
  }

  _randomCol(rows){ return Array.from({length:rows}, ()=> Phaser.Utils.Array.GetRandom([0,1,2,3,4,5,6,7,8,9])); }
  _randomGrid(cols, rows){ return Array.from({length:cols}, ()=> this._randomCol(rows)); }
}
