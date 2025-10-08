// js/scenes/SlotMachine.js
import { api } from '../utils/api.js';

export class SlotMachine extends Phaser.Scene {
  constructor(){ super('SlotMachine'); }

  preload(){
    // --- mêmes clés que ton Slot.js ---
    this.load.image('slotBg',    'assets/slot/slot-background.png');
    this.load.image('slotFrame', 'assets/slot/cadre-slot.png');

    // Strip unique du rouleau (net + blur) — une colonne de symboles empilés verticalement
    this.load.image('reel_clear', 'assets/slot/reel_clear.png');
    this.load.image('reel_blur',  'assets/slot/reel_blur.png');

    // UI
    this.load.image('spinBtn', 'assets/slot/spin.png');
  }

  create(){
    const { width:W, height:H } = this.scale.gameSize;
    const DEPTH = { bg:0, reels:150, frame:300, ui:320, overlay:330 };

    // --- sécurité assets
    ['slotBg','slotFrame','reel_clear','reel_blur','spinBtn'].forEach(k=>{
      if (!this.textures.exists(k)) console.warn(`[SlotMachine] Texture manquante: ${k}`);
    });

    // --- BG derrière tout
    this.cameras.main.setBackgroundColor('#0d1117');
    this.add.image(W/2, H/2, 'slotBg').setDisplaySize(W, H).setDepth(DEPTH.bg);

    // === RÉGLAGES VISUELS (dans l’esprit de Slot.js) ===
    const COLS = 5, ROWS = 3;
    const REELS_WIDTH   = Math.min(680, W * 0.74);
    const REELS_HEIGHT  = Math.min(440, H * 0.42);
    const REELS_OFFSET_X= 0;
    const REELS_OFFSET_Y= 45;
    const GAP_X         = 15;

    // Fenêtre des rouleaux
    const reelW   = (REELS_WIDTH - (COLS - 1) * GAP_X) / COLS;
    const reelH   = REELS_HEIGHT;
    const winLeft = (W - REELS_WIDTH)/2 + REELS_OFFSET_X;
    const winTop  = (H - REELS_HEIGHT)/2 + REELS_OFFSET_Y;

    // --- Lecture dynamique des dimensions du strip
    const stripImg = this.textures.get('reel_clear')?.getSourceImage();
    const STRIP_W  = stripImg?.width  || 134;   // fallback safe
    const STRIP_H  = stripImg?.height || 1340;  // fallback safe

    // Si ton strip a 10 symboles, ça donnera ~10. Si différent, adapte ici.
    const SYMBOL_CNT = Math.max(1, Math.round(STRIP_H / Math.round(STRIP_H / 10)));
    const SYMBOL_H   = Math.floor(STRIP_H / SYMBOL_CNT);

    // --- REELS entre BG et FRAME (donc visibles)
    this.reels = [];
    for (let i=0;i<COLS;i++){
      const x = winLeft + i*(reelW + GAP_X) + reelW/2;
      const y = winTop  + reelH/2;
      const spr = this.add.tileSprite(x, y, reelW, reelH, 'reel_clear').setDepth(DEPTH.reels);

      // Montrer exactement 3 symboles dans la fenêtre :
      // - on remplit la largeur (strip = 1 colonne) → scaleX par rapport à la largeur réelle du strip
      // - on montre 3 symboles en hauteur → scaleY tel que 3*SYMBOL_H = reelH
      spr.tileScaleX = reelW / STRIP_W;
      spr.tileScaleY = reelH / (ROWS * SYMBOL_H);

      // Position texture de départ (px)
      spr.tilePositionY = Phaser.Math.Between(0, STRIP_H - 1);

      this.reels.push({ sprite: spr });
    }

    // --- CADRE par-dessus (ton format exact)
    const FRAME_PAD_X = 0.80;
    const FRAME_PAD_Y = 0.98;
    const frame = this.add.image(W/2, H/2, 'slotFrame').setDepth(DEPTH.frame);
    frame.setScale((W / frame.width) * FRAME_PAD_X, (H / frame.height) * FRAME_PAD_Y);

    // --- (Optionnel) DEBUG pour vérifier la fenêtre des rouleaux
    const SHOW_DEBUG = false;
    if (SHOW_DEBUG){
      const dbg = this.add.graphics().setDepth(DEPTH.frame - 1);
      dbg.lineStyle(2, 0x00ff00, 0.7);
      dbg.strokeRect(winLeft, winTop, REELS_WIDTH, REELS_HEIGHT);
    }

    // --- UI lignes + spin
    this.lineOptions = [1,3,5];
    this.lines = 3;
    this.bet = this.lines;

    this.status = this.add.text(W/2, winTop - 40, '', {
      fontFamily:'monospace', fontSize:18, color:'#e6f1ff'
    }).setOrigin(0.5,1).setDepth(DEPTH.ui);
    this._refreshStatus();

    const linesY = winTop + reelH + 16;
    this._lineButtonGroup(W/2, linesY);

    const spinY = linesY + 44;
    const spin = this.add.image(W/2, spinY, 'spinBtn')
      .setDepth(DEPTH.overlay)
      .setInteractive({ useHandCursor:true });

    const spinScale = Math.min(W, H) / 2000;
    spin.setScale(0.25 * spinScale);
    spin.on('pointerdown', ()=> spin.setScale(0.235 * spinScale));
    spin.on('pointerup', async ()=>{
      spin.setScale(0.25 * spinScale);
      await this._doSpin({ SYMBOL_H, STRIP_H, SYMBOL_CNT });
    });

    this.spinning = false;
  }

  // ---------- UI ----------
  _lineButtonGroup(cx, y){
    const gap = 120;
    this.lineBtns = this.lineOptions.map((v, idx)=>{
      return this._btn(cx + (idx-1)*gap, y, `${v} Lines`, ()=>{
        this.lines = v; this.bet = v; this._refreshStatus();
      });
    });
  }
  _btn(x,y,label,on){
    const c  = this.add.container(x,y).setDepth(320);
    const bg = this.add.rectangle(0,0,120,30,0x14253a).setStrokeStyle(1,0x6fb1ff).setInteractive({useHandCursor:true});
    const tx = this.add.text(0,0,label,{fontFamily:'monospace',fontSize:14,color:'#eaffff'}).setOrigin(0.5);
    bg.on('pointerdown',()=> bg.setScale(0.98));
    bg.on('pointerup',()=>{ bg.setScale(1); on&&on(); });
    c.add([bg,tx]); c.bg = bg; return c;
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

  // ---------- util ----------
  _rowsFromPos(tilePosY, SYMBOL_H, STRIP_H){
    const r = (tilePosY % STRIP_H + STRIP_H) % STRIP_H;
    return r / SYMBOL_H;
  }
  _posFromRows(rows, SYMBOL_H, STRIP_H){
    const px = rows * SYMBOL_H;
    return ((px % STRIP_H) + STRIP_H) % STRIP_H;
  }

  // ---------- SPIN ----------
  async _doSpin(ctx){
    if (this.spinning) return;
    this.spinning = true;

    // Résultat backend (fallback local)
    let grid;
    try {
      const res = await api('api/slot/spin', { method:'POST', body:{ bet:this.bet, lines:this.lines } });
      grid = Array.isArray(res.grid) ? res.grid : null;
      if (typeof res.credits === 'number') this.game.events.emit('credits:update', res.credits);
    } catch { grid = null; }
    if (!grid || grid.length < 5) grid = this._randomGrid(5,3);

    // Phases : lift → spin (BLUR) → clear → stop
    const STAGGER     = 500;
    const LIFT_ROWS   = 0.35;
    const LIFT_MS     = 140;
    const SPIN_MS     = 3000;
    const STOP_MS     = 1100;
    const BASE_CYCLES = 6;
    const SPIN_DIR    = -1;  // -1 = descend (sens slot)

    const promises = this.reels.map((rw, i)=>{
      const spr = rw.sprite;

      // Cible: index du symbole qui devra apparaître en haut à l’arrêt
      // (si ton backend te renvoie [top, mid, bot], ici on prend top = grid[i][0])
      const targetTopIndex =
        (Array.isArray(grid[i]) && grid[i].length >= 3 && Number.isInteger(grid[i][0]))
          ? grid[i][0]
          : Phaser.Math.Between(0, ctx.SYMBOL_CNT-1);

      return new Promise(resolve=>{
        this.time.delayedCall(i * STAGGER, ()=>{

          // Aligne la position texture de départ sur une ligne entière (évite jitters)
          const startRows = Math.round(this._rowsFromPos(spr.tilePositionY, ctx.SYMBOL_H, ctx.STRIP_H));
          spr.tilePositionY = this._posFromRows(startRows, ctx.SYMBOL_H, ctx.STRIP_H);

          // Distances en "lignes"
          const rLift = startRows + SPIN_DIR * LIFT_ROWS;
          const spinRows = (BASE_CYCLES + i) * ctx.SYMBOL_CNT;
          const rSpin = rLift + SPIN_DIR * spinRows;

          // On veut (rStop mod N) == targetTopIndex (dans le sens du spin)
          const rem = ((rSpin % ctx.SYMBOL_CNT) + ctx.SYMBOL_CNT) % ctx.SYMBOL_CNT;
          let delta;
          if (SPIN_DIR === 1) {
            // monte (visuel monte)
            delta = (targetTopIndex - rem + ctx.SYMBOL_CNT) % ctx.SYMBOL_CNT;
          } else {
            // descend (visuel descend) => on remonte la "distance" en rows
            delta = (rem - targetTopIndex + ctx.SYMBOL_CNT) % ctx.SYMBOL_CNT;
            delta = -delta;
          }
          const rStop = rSpin + delta;

          // 1) LIFT
          this.tweens.addCounter({
            from: startRows, to: rLift, duration: LIFT_MS, ease: 'Sine.easeOut',
            onUpdate: (tw, obj)=> spr.tilePositionY = this._posFromRows(obj.value, ctx.SYMBOL_H, ctx.STRIP_H),
            onComplete: ()=>{
              // Passe en BLUR au début du spin rapide
              spr.setTexture('reel_blur');

              // 2) SPIN rapide
              this.tweens.addCounter({
                from: rLift, to: rSpin, duration: SPIN_MS, ease: 'Linear',
                onUpdate: (tw, obj)=> spr.tilePositionY = this._posFromRows(obj.value, ctx.SYMBOL_H, ctx.STRIP_H),
                onComplete: ()=>{
                  // repasse en net AVANT le freinage
                  spr.setTexture('reel_clear');

                  // 3) STOP doux jusqu’à la cible exacte
                  this.tweens.addCounter({
                    from: rSpin, to: rStop, duration: STOP_MS, ease: 'Cubic.easeOut',
                    onUpdate: (tw, obj)=> spr.tilePositionY = this._posFromRows(obj.value, ctx.SYMBOL_H, ctx.STRIP_H),
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

  // ---------- random helpers ----------
  _randomCol(rows){ return Array.from({length:rows}, ()=> Phaser.Utils.Array.GetRandom([0,1,2,3,4,5,6,7,8,9])); }
  _randomGrid(cols, rows){ return Array.from({length:cols}, ()=> this._randomCol(rows)); }
}
