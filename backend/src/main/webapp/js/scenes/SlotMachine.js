// js/scenes/SlotMachine.js
import { api } from '../utils/api.js';

export class SlotMachine extends Phaser.Scene {
  constructor(){ super('SlotMachine'); }

  // ----------------------------------------------------
  // PRELOAD
  // ----------------------------------------------------
  preload(){
    // Décor
    this.load.image('slotBg',    'assets/menu/bg.png');
    this.load.image('slotFrame', 'assets/slot/Cadre_slot.png');

    // Reels (un strip clair + un strip flou, 134x1340 avec 10 symboles)
    this.load.image('reel_clear','assets/slot/reel_clear.png');
    this.load.image('reel_blur', 'assets/slot/reel_blur.png');

    // Bande d’UI avec tous les boutons (image unique)
    this.load.image('btnSheet',  'assets/slot/ui/buttons-en.png');
  }

  // ----------------------------------------------------
  // CREATE
  // ----------------------------------------------------
  create(){
    const { width:W, height:H } = this.scale.gameSize;
    const DEPTH = { bg:0, reels:150, frame:300, ui:320, overlay:330 };

    // --- décor
    this.cameras.main.setBackgroundColor('#0d1117');
    this.add.image(W/2, H/2, 'slotBg').setDisplaySize(W, H).setDepth(DEPTH.bg);

    // === Réglages visuels rapides ===========================================
    // Fenêtre des rouleaux (ajuste ces valeurs pour tomber pile dans le cadre)
    const COLS = 5, ROWS = 3;
    const REELS_WIDTH   = Math.min(680, W * 0.74);
    const REELS_HEIGHT  = Math.min(440, H * 0.446);
    const REELS_OFFSET_X= 0;
    const REELS_OFFSET_Y= 42.5;
    const GAP_X         = 15;

    // Cadre (échelle & offset)
    const FRAME_PAD_X   = 0.80;
    const FRAME_PAD_Y   = 0.98;
    const FRAME_OFF_X   = 0;
    const FRAME_OFF_Y   = 0;

    // Animation
    const STAGGER    = 500;   // décalage entre rouleaux (ms)
    const LIFT_ROWS  = 0.35;  // petit “hop” vers le haut
    const LIFT_MS    = 140;
    const SPIN_MS    = 3000;  // phase rapide
    const STOP_MS    = 1100;  // freinage
    const BASE_CYCLES= 6;     // tours minimaux par colonne
    const SPIN_DIR   = -1;    // -1 = descend (classique casino)
    // ========================================================================

    // --- géométrie fenêtre
    const reelW   = (REELS_WIDTH - (COLS - 1) * GAP_X) / COLS;
    const reelH   = REELS_HEIGHT;
    const winLeft = (W - REELS_WIDTH)/2 + REELS_OFFSET_X;
    const winTop  = (H - REELS_HEIGHT)/2 + REELS_OFFSET_Y;

    // --- dimensions réelles du strip (déjà chargé en preload)
    const src = this.textures.get('reel_clear').getSourceImage();
    const STRIP_W = src.width;         // 134
    const STRIP_H = src.height;        // 1340
    const SYMBOL_CNT = 10;             // 10 symboles dans le strip
    const SYMBOL_H   = Math.floor(STRIP_H / SYMBOL_CNT); // 134

    // --- création des rouleaux (tileSprite)
    this.reels = [];
    for (let i=0; i<COLS; i++){
      const x = winLeft + i*(reelW + GAP_X) + reelW/2;
      const y = winTop  + reelH/2;

      const spr = this.add.tileSprite(x, y, reelW, reelH, 'reel_clear')
        .setDepth(DEPTH.reels);

      // montre exactement 3 symboles visibles
      spr.tileScaleX = reelW / STRIP_W;
      spr.tileScaleY = reelH / (ROWS * SYMBOL_H);

      // position texture initiale
      spr.tilePositionY = Phaser.Math.Between(0, STRIP_H - 1);

      this.reels.push({ sprite: spr });
    }

    // --- cadre par-dessus
    const frame = this.add.image(W/2 + FRAME_OFF_X, H/2 + FRAME_OFF_Y, 'slotFrame')
      .setDepth(DEPTH.frame);
    frame.setScale((W / frame.width) * FRAME_PAD_X,
                   (H / frame.height) * FRAME_PAD_Y);

    // --- config d’animation (stockée pour le click SPIN)
    this.spinCfg = { SYMBOL_H, STRIP_H, SYMBOL_CNT, STAGGER, LIFT_ROWS, LIFT_MS, SPIN_MS, STOP_MS, BASE_CYCLES, SPIN_DIR };

    // --- état de la mise/nb lignes (simple)
    this.lines = 3;
    this.bet   = 3;

    // ------------------------------------------------------------------------
    // BOUTONS : on découpe buttons-en.png en rectangles (UP / PRESSED)
    // Ajuste ces coordonnées si besoin (utilise le petit helper de debug plus bas)
    const BTN = {
      play1: { up:{x:170,y:330,w:170,h:110}, pressed:{x:170,y:585,w:170,h:110} },
      play3: { up:{x:370,y:330,w:170,h:110}, pressed:{x:370,y:585,w:170,h:110} },
      play5: { up:{x:570,y:330,w:170,h:110}, pressed:{x:570,y:585,w:170,h:110} },
      spin:  { up:{x:930,y:315,w:220,h:140}, pressed:{x:930,y:570,w:220,h:140} },
    };
    // // Debug visuel pour ajuster les rectangles :
     Object.values(BTN).forEach(b=>{
       ['up','pressed'].forEach(k=>{
         const r=b[k]; const g=this.add.graphics().setDepth(999);
         g.lineStyle(2,0xff0000,0.6).strokeRect(r.x,r.y,r.w,r.h);
       });
     });

    // Placement façon FreeSlots (3 boutons centrés + un SPIN à droite)
    const rowY   = winTop + reelH + 90;
    const gap    = 170;
    const startX = W/2 - gap; // 3 boutons centrés

    this._makeSheetButton(BTN.play1.up, BTN.play1.pressed, startX - gap, rowY, 0.55, ()=>{
      this.lines = 1; this.bet = 1;
    });
    this._makeSheetButton(BTN.play3.up, BTN.play3.pressed, startX, rowY, 0.55, ()=>{
      this.lines = 3; this.bet = 3;
    });
    this._makeSheetButton(BTN.play5.up, BTN.play5.pressed, startX + gap, rowY, 0.55, ()=>{
      this.lines = 5; this.bet = 5;
    });

    const spinX = W/2 + gap*2;
    this._makeSheetButton(BTN.spin.up, BTN.spin.pressed, spinX, rowY, 0.55, async ()=>{
      await this._doSpin(this.spinCfg);
    });

    // Dev: touche D pour basculer reels devant/derrière le cadre
    this.input.keyboard.on('keydown-D', ()=>{
      const top = (this.reels[0].sprite.depth > frame.depth);
      this.reels.forEach(r=> r.sprite.setDepth(top ? DEPTH.frame - 1 : DEPTH.reels));
    });

    this.spinning = false;
  }

  // ----------------------------------------------------
  // HELPER bouton découpé depuis 'btnSheet'
  // ----------------------------------------------------
  _makeSheetButton(rectUp, rectDown, x, y, scale = 1, onClick){
    const base = this.add.image(0, 0, 'btnSheet').setOrigin(0.5);
    base.setCrop(rectUp.x, rectUp.y, rectUp.w, rectUp.h);
    base.setDisplaySize(rectUp.w * scale, rectUp.h * scale);

    // zone interactive = rectangle visible
    base.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-base.displayWidth/2, -base.displayHeight/2, base.displayWidth, base.displayHeight),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });

    const c = this.add.container(x, y, [base]).setDepth(320);

    base.on('pointerdown', ()=>{
      base.setCrop(rectDown.x, rectDown.y, rectDown.w, rectDown.h);
    });
    base.on('pointerup', ()=>{
      base.setCrop(rectUp.x, rectUp.y, rectUp.w, rectUp.h);
      onClick && onClick();
    });
    base.on('pointerout', ()=>{
      base.setCrop(rectUp.x, rectUp.y, rectUp.w, rectUp.h);
    });

    return c;
  }

  // ----------------------------------------------------
  // SPIN principal (lift -> spin flou -> stop net)
  // ----------------------------------------------------
  async _doSpin(ctx){
    if (this.spinning) return;
    this.spinning = true;

    // 1) Demande résultat au backend (fallback local sinon)
    let grid;
    try {
      const res = await api('api/slot/spin', { method:'POST', body:{ bet:this.bet, lines:this.lines } });
      // attendu: res.grid = [ [top,mid,bot], ... 5 colonnes ] (indices 0..9)
      grid = Array.isArray(res.grid) ? res.grid : null;
      if (typeof res.credits === 'number') this.game.events.emit('credits:update', res.credits);
    } catch {
      grid = null;
    }
    if (!grid || grid.length < this.reels.length) {
      grid = Array.from({length:this.reels.length}, ()=> [
        Phaser.Math.Between(0, ctx.SYMBOL_CNT-1),
        Phaser.Math.Between(0, ctx.SYMBOL_CNT-1),
        Phaser.Math.Between(0, ctx.SYMBOL_CNT-1),
      ]);
    }

    // 2) Anime chaque rouleau vers l’indice top demandé
    const promises = this.reels.map((reel, i)=>{
      const spr = reel.sprite;
      const targetTopIndex =
        (Array.isArray(grid[i]) && grid[i].length>=3 && Number.isInteger(grid[i][0]))
          ? grid[i][0] : Phaser.Math.Between(0, ctx.SYMBOL_CNT-1);

      return new Promise(resolve=>{
        this.time.delayedCall(i*ctx.STAGGER, ()=>{

          // Snap de départ sur une ligne entière
          const startRows = Math.round(this._rowsFromPos(spr.tilePositionY, ctx.SYMBOL_H, ctx.STRIP_H));
          spr.tilePositionY = this._posFromRows(startRows, ctx.SYMBOL_H, ctx.STRIP_H);

          // LIFT -> SPIN -> STOP avec atterrissage exact
          const rLift = startRows + ctx.SPIN_DIR * ctx.LIFT_ROWS;
          const rSpin = rLift    + ctx.SPIN_DIR * ((ctx.BASE_CYCLES + i) * ctx.SYMBOL_CNT);

          // distance jusqu’à la cible (respect du sens)
          const rem = ((rSpin % ctx.SYMBOL_CNT) + ctx.SYMBOL_CNT) % ctx.SYMBOL_CNT;
          let delta;
          if (ctx.SPIN_DIR === 1) delta = (targetTopIndex - rem + ctx.SYMBOL_CNT) % ctx.SYMBOL_CNT;
          else { delta = (rem - targetTopIndex + ctx.SYMBOL_CNT) % ctx.SYMBOL_CNT; delta = -delta; }
          const rStop = rSpin + delta;

          // LIFT
          this.tweens.addCounter({
            from:startRows, to:rLift, duration:ctx.LIFT_MS, ease:'Sine.easeOut',
            onUpdate:(tw,o)=> spr.tilePositionY = this._posFromRows(o.value, ctx.SYMBOL_H, ctx.STRIP_H),
            onComplete: ()=>{
              spr.setTexture('reel_blur'); // flou pendant la phase rapide

              // SPIN rapide
              this.tweens.addCounter({
                from:rLift, to:rSpin, duration:ctx.SPIN_MS, ease:'Linear',
                onUpdate:(tw,o)=> spr.tilePositionY = this._posFromRows(o.value, ctx.SYMBOL_H, ctx.STRIP_H),
                onComplete: ()=>{
                  spr.setTexture('reel_clear'); // net AVANT le freinage

                  // STOP doux
                  this.tweens.addCounter({
                    from:rSpin, to:rStop, duration:ctx.STOP_MS, ease:'Cubic.easeOut',
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

  // ----------------------------------------------------
  // Utilitaires positions <-> lignes
  // ----------------------------------------------------
  _rowsFromPos(tilePosY, SYMBOL_H, STRIP_H){
    const r = (tilePosY % STRIP_H + STRIP_H) % STRIP_H;
    return r / SYMBOL_H;
  }
  _posFromRows(rows, SYMBOL_H, STRIP_H){
    const px = rows * SYMBOL_H;
    return ((px % STRIP_H) + STRIP_H) % STRIP_H;
  }
}
