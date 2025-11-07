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

    // === GAINS & FX === digits 0..9 + blank
    for (let d=0; d<=9; d++) this.load.image(`ui_digit_${d}`, `assets/slot/ui/digit${d}.png`);
    this.load.image('ui_digit_blank', 'assets/slot/ui/digitblank.png');
  }

  create(){
    const { width:W, height:H } = this.scale.gameSize;
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

    // Mémorise la géométrie (pour l’overlay)
    this.layout = { COLS, ROWS, reelW, reelH, winLeft, winTop, GAP_X, rowH: reelH/ROWS };

    // Mesure réelle du strip
    const src = this.textures.get('reel_clear')?.getSourceImage();
    const STRIP_W = src?.width  || 134;
    const STRIP_H = src?.height || 1340;
    const SYMBOL_CNT = Math.max(1, Math.round(STRIP_H / Math.round(STRIP_H/10)));
    const SYMBOL_H   = Math.floor(STRIP_H / SYMBOL_CNT);

    // Reels (tileSprite)
    this.reels = [];
    for (let i=0;i<COLS;i++){
      const x = winLeft + i*(reelW + GAP_X) + reelW/2;
      const y = winTop  + reelH/2;
      const spr = this.add.tileSprite(x, y, reelW, reelH, 'reel_clear')
        .setOrigin(0.5)
        .setDepth(DEPTH.reels);

      spr.tileScaleX = reelW / STRIP_W;
      spr.tileScaleY = reelH / (ROWS * SYMBOL_H);
      spr.tilePositionY = Phaser.Math.Between(0, STRIP_H-1);
      this.reels.push({ sprite:spr });
    }

    // Cadre (format exact demandé) + offsets
    const FRAME_PAD_X    = 0.80;
    const FRAME_PAD_Y    = 0.88;
    const FRAME_OFFSET_X = 0;
    const FRAME_OFFSET_Y = -48;

    const frame = this.add
      .image(W/2 + FRAME_OFFSET_X, H/2 + FRAME_OFFSET_Y, 'slotFrame')
      .setDepth(DEPTH.frame);

    frame.setScale((W / frame.width) * FRAME_PAD_X,
                   (H / frame.height) * FRAME_PAD_Y);

    // --- HUD utilisateur (haut-droite)
    const HUD_RIGHT_PAD = 14;
    const HUD_TOP       = 14;
    const HUD_FONT      = 16;
    const HUD_GAP       = 18;

    const hudStyle = { fontFamily:'system-ui, Arial', fontSize: `${HUD_FONT}px`, color:'#eaf4ff' };

    const user0 = this.registry.get('user') || {};
    const rightX = this.scale.gameSize.width - HUD_RIGHT_PAD;
    this.userText    = this.add.text(rightX, HUD_TOP, `👤 ${user0?.username ?? '—'}`, hudStyle).setOrigin(1, 0).setDepth(330);
    this.creditsText = this.add.text(rightX, HUD_TOP + HUD_GAP, `💰 ${user0?.credits ?? 0} crédits`, hudStyle).setOrigin(1, 0).setDepth(330);

    const setUserHUD = (u) => {
      if (!u) return;
      if (typeof u.username === 'string') this.userText.setText(`👤 ${u.username}`);
      if (typeof u.credits  === 'number') this.creditsText.setText(`💰 ${u.credits} crédits`);
    };
    const refreshUser = async () => {
      try {
        const me = await api('api/me');
        if (me?.user) { this.registry.set('user', me.user); setUserHUD(me.user); }
      } catch (_) {}
    };
    this.events.on('wake', refreshUser);
    this.game.events.on('credits:update', (newCredits) => {
      const u = this.registry.get('user') || {};
      const merged = { ...u, credits: newCredits };
      this.registry.set('user', merged);
      setUserHUD(merged);
    });
    if (!user0?.username) refreshUser();

    // ---- UI layout rapide
    const UI = {
      statusX: W / 2,
      statusY: winTop - 25,
      statusFontSize: 15,

      lineBtnsY: winTop + reelH + 160,
      lineBtnsGap: 165,
      lineBtnSize: { w: 140, h: 40 },
      lineBtnFont: 14,

      // Compteur de gain (digits)
      winCounterX: W/2,
      winCounterY: winTop - -420,  // au-dessus du cadre
      winDigits: 6,              // jusqu’à 6 chiffres

      spinX: W / 2.25,
      spinY: winTop + reelH + 70,
      spinScale: 0.10,
      spinPress: 0.94,
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

    this._lineButtons(W/2, UI.lineBtnsY, UI);

    const spin = this.add.image(UI.spinX, UI.spinY, 'spinBtn')
      .setDepth(DEPTH.overlay)
      .setInteractive({ useHandCursor:true })
      .setScale(UI.spinScale);
    spin.on('pointerdown', ()=> spin.setScale(UI.spinScale * UI.spinPress));
    spin.on('pointerup', async ()=>{
      spin.setScale(UI.spinScale);
      await this._doSpin({ SYMBOL_H, STRIP_H, SYMBOL_CNT, UI });
    });

    // === GAINS & FX === init conteneurs
    this.winFX = { highlights: [] }; // on ne garde plus "counter"

    // --- Deux groupes de digits sur la même ligne (BET | WIN)
    const DIGITS_H = 34;   // hauteur visuelle de chaque chiffre
    const BET_DIGS = 2;    // 2 cases suffisent pour 1/3/5
    const WIN_DIGS = 6;    // jusqu'à 6 chiffres pour le gain
    const ROW_Y    = UI.winCounterY;  // on réutilise ta coordonnée (au-dessus du cadre)
    const GAP_BET_WIN = 24;           // espace entre les deux groupes

    const betW = this._digitsTotalWidth(BET_DIGS, DIGITS_H);
    const winW = this._digitsTotalWidth(WIN_DIGS, DIGITS_H);
    const totalW = betW + GAP_BET_WIN + winW;
    const leftX = (this.scale.gameSize.width / 2) - totalW/2;

    // crée les deux afficheurs centrés globalement
    this.betDigits = this._createDigits(leftX + betW/2,          ROW_Y, BET_DIGS, DIGITS_H, DEPTH.ui);
    this.winDigits = this._createDigits(leftX + betW + GAP_BET_WIN + winW/2, ROW_Y, WIN_DIGS, DIGITS_H, DEPTH.ui);

    // valeurs initiales
    this.betDigits.setValue(this.bet); // 1 / 3 / 5
    this.winDigits.setValue(0);


    // Debug profondeur toggle
    this.input.keyboard.on('keydown-D', ()=>{
      const top = (this.reels[0].sprite.depth > frame.depth);
      this.reels.forEach(r=> r.sprite.setDepth(top ? DEPTH.frame - 1 : DEPTH.reels));
    });

    this.spinning = false;
  }

  // --- UI helpers
  _lineButtons(cx, y, UI){
    const gap = UI?.lineBtnsGap ?? 120;
    this.lineBtns = this.lineOptions.map((v, i)=>{
      const c  = this.add.container(cx + (i-1)*gap, y).setDepth(360);
      const w  = UI?.lineBtnSize?.w ?? 120;
      const h  = UI?.lineBtnSize?.h ?? 30;
      const bg = this.add.rectangle(0,0,w,h,0x14253a).setStrokeStyle(1,0x6fb1ff).setInteractive({useHandCursor:true});
      const tx = this.add.text(0,0,`${v} Lines`,{fontFamily:'monospace',fontSize:UI?.lineBtnFont ?? 14,color:'#eaffff'}).setOrigin(0.5);
      bg.on('pointerdown',()=> bg.setScale(0.98));
      bg.on('pointerup',()=>{
        bg.setScale(1);
        this.lines = v;
        this.bet   = v;
        this._refreshStatus();
        if (this.betDigits) this.betDigits.setValue(this.bet);
      });

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

  // --- util
  _rowsFromPos(tilePosY, SYMBOL_H, STRIP_H){
    const r = (tilePosY % STRIP_H + STRIP_H) % STRIP_H;
    return r / SYMBOL_H;
  }
  _posFromRows(rows, SYMBOL_H, STRIP_H){
    const px = rows * SYMBOL_H;
    return ((px % STRIP_H) + STRIP_H) % STRIP_H;
  }

  // === GAINS & FX === Digit counter
  createWinCounter(x, y, digits=6){
    if (this.winFX.counter) this.winFX.counter.destroy(true);
    const group = this.add.container(x, y).setDepth(999);
    const h = this.textures.get('ui_digit_0')?.getSourceImage()?.height || 48;
    const w = this.textures.get('ui_digit_0')?.getSourceImage()?.width  || 32;
    const targetH = 42; // hauteur visuelle
    const scale = targetH / h;
    const spacing = w*scale * 0.9;

    const sprites = [];
    for (let i=0; i<digits; i++){
      const s = this.add.image(i*spacing, 0, 'ui_digit_blank')
        .setOrigin(0.5, 0.5)
        .setScale(scale);
      group.add(s);
      sprites.push(s);
    }
    group.setSize(digits*spacing, targetH).setPosition(x - (digits*spacing)/2, y);

    group.setValue = (val)=>{
      const str = String(Math.max(0, Math.floor(val)));
      // right align
      let idx = sprites.length - 1;
      for (let i=str.length-1; i>=0 && idx>=0; i--, idx--){
        const d = str[i];
        sprites[idx].setTexture(`ui_digit_${d}`);
      }
      // blanks remaining
      for (; idx>=0; idx--) sprites[idx].setTexture('ui_digit_blank');
    };
    group.animateTo = (target, duration=900)=>{
      const obj = { v: 0 };
      group.setValue(0);
      this.tweens.add({
        targets: obj,
        v: target,
        duration,
        ease: 'Cubic.easeOut',
        onUpdate: ()=> group.setValue(obj.v)
      });
    };

    this.winFX.counter = group;
  }

  // === DIGITS helpers (générique pour BET / WIN) ===
  _digitsTotalWidth(count, targetH=42){
    const src = this.textures.get('ui_digit_0')?.getSourceImage();
    const h = src?.height || 48;
    const w = src?.width  || 32;
    const scale = targetH / h;
    const spacing = w * scale * 0.9;
    return count * spacing;
  }
  _createDigits(cx, cy, digits=4, targetH=42, depth=360){
    const grp = this.add.container(cx, cy).setDepth(depth);
    const src = this.textures.get('ui_digit_0')?.getSourceImage();
    const h = src?.height || 48;
    const w = src?.width  || 32;
    const scale = targetH / h;
    const spacing = w * scale * 0.9;

    const sprites = [];
    for (let i=0;i<digits;i++){
      const s = this.add.image((i - (digits-1)/2) * spacing, 0, 'ui_digit_blank')
        .setOrigin(0.5).setScale(scale);
      grp.add(s);
      sprites.push(s);
    }

    grp.setValue = (val)=>{
      const str = String(Math.max(0, Math.floor(val)));
      let idx = sprites.length - 1;
      for (let i=str.length-1; i>=0 && idx>=0; i--, idx--){
        sprites[idx].setTexture(`ui_digit_${str[i]}`);
      }
      for (; idx>=0; idx--) sprites[idx].setTexture('ui_digit_blank');
    };
    grp.animateTo = (target, duration=900)=>{
      const obj = { v: 0 };
      grp.setValue(0);
      this.tweens.add({
        targets: obj, v: target, duration, ease:'Cubic.easeOut',
        onUpdate: ()=> grp.setValue(obj.v)
      });
    };
    return grp;
  }


  // === GAINS & FX === Highlight overlay
  clearWinHighlights(){
    this.winFX.highlights.forEach(h => h.destroy());
    this.winFX.highlights = [];
  }
  highlightCells(cells){
    const { winLeft, winTop, reelW, rowH, GAP_X } = this.layout;
    const padX = reelW * 0.08;
    const padY = rowH * 0.10;

    cells.forEach(({col,row})=>{
      const x = winLeft + col*(reelW + GAP_X) + reelW/2;
      const y = winTop  + row*rowH + rowH/2;
      const r = this.add.rectangle(x, y, reelW - padX*2, rowH - padY*2, 0xffd54f, 0.45)
        .setDepth(980)
        .setStrokeStyle(2, 0xfff59d, 0.9)
        .setBlendMode(Phaser.BlendModes.ADD);
      //this.tweens.add({ targets:r, alpha: { from:0.35, to:0.12 }, duration:380, yoyo:true, repeat:3 });
      this.tweens.add({ targets:r, x: x+1, duration:30, yoyo:true, repeat:6 }); // mini shake
      this.winFX.highlights.push(r);
    });
  }

  // === GAINS & FX === Paylines + scoring
  paylinesFor(lines){
    // 0=top,1=mid,2=bot
    const middle   = [1,1,1,1,1];
    const top      = [0,0,0,0,0];
    const bottom   = [2,2,2,2,2];
    const diagDown = [0,1,2,1,0];
    const diagUp   = [2,1,0,1,2];

    if (lines === 1) return [middle];
    if (lines === 3) return [middle, top, bottom];
    return [middle, top, bottom, diagDown, diagUp]; // 5
  }
  evaluateWins(grid, lines){
    // grid = [ [top,mid,bot], ... 5 cols ], valeurs = indices 0..9
    const L = Math.min(grid.length, 5);
    const paths = this.paylinesFor(lines);
    const PAY = { 3:5, 4:15, 5:50 }; // table simple (par ligne)
    const totalCells = [];
    let totalWin = 0;

    for (const path of paths){
      // chemin: tableau de 5 rows (0/1/2)
      let seqVal = grid[0][path[0]];
      let len = 1;
      // on ne considère que les suites CONTIGUËS à partir de la 1ère colonne
      for (let c=1; c<L; c++){
        const v = grid[c][path[c]];
        if (v === seqVal) len++; else break;
      }
      if (len >= 3){
        totalWin += PAY[len] ?? 0;
        for (let c=0; c<len; c++){
          totalCells.push({ col:c, row:path[c] });
        }
      }
    }
    // Multiplie par la mise par ligne (ici 1) — si tu veux lier à bet: totalWin *= 1;
    return { win: totalWin, cells: this._dedupCells(totalCells) };
  }
  _dedupCells(cells){
    const seen = new Set();
    return cells.filter(({col,row})=>{
      const k = `${col}-${row}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  async _doSpin(ctx){
    if (this.spinning) return;
    this.spinning = true;

    // Efface les effets de gain précédents
    this.clearWinHighlights();
    if (this.winFX.counter) this.winFX.counter.setValue(0);

    let apiRes = null;
    let grid;
    try{
      apiRes = await api('api/slot/spin', { method:'POST', body:{ bet:this.bet, lines:this.lines } });
      grid = Array.isArray(apiRes.grid) ? apiRes.grid : null;
      if (typeof apiRes.credits === 'number') this.game.events.emit('credits:update', apiRes.credits);
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
              spr.setTexture('reel_blur');
              // SPIN rapide
              this.tweens.addCounter({
                from: rLift, to: rSpin, duration: SPIN_MS, ease:'Linear',
                onUpdate:(tw,o)=> spr.tilePositionY = this._posFromRows(o.value, ctx.SYMBOL_H, ctx.STRIP_H),
                onComplete: ()=>{
                  spr.setTexture('reel_clear'); // clear AVANT freinage
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

    // === GAINS & FX === après arrêt
    const { win, cells } = this.evaluateWins(grid, this.lines);
    if (cells.length) this.highlightCells(cells);

    // Si l’API renvoie un payout, on privilégie celui-ci
    let payout = (apiRes && typeof apiRes.payout === 'number') ? apiRes.payout : win;

    // anime l'afficheur WIN (digits)
    if (this.winDigits){
      if (payout > 0) this.winDigits.animateTo(payout, 900);
      else this.winDigits.setValue(0);
    }

    // Met à jour les crédits si l’API ne l’a pas fait
    if (!(apiRes && typeof apiRes.credits === 'number') && payout > 0){
      const u = this.registry.get('user') || {};
      const newCredits = (u.credits ?? 0) + payout;
      this.registry.set('user', { ...u, credits: newCredits });
      this.game.events.emit('credits:update', newCredits);
    }

    this.spinning = false;
  }

  _randomCol(rows){ return Array.from({length:rows}, ()=> Phaser.Utils.Array.GetRandom([0,1,2,3,4,5,6,7,8,9])); }
  _randomGrid(cols, rows){ return Array.from({length:cols}, ()=> this._randomCol(rows)); }
}
