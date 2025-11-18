// js/scenes/Slot.js
import { api } from '../utils/api.js';

export class Slot extends Phaser.Scene {
  constructor(){ super('Slot'); }

  preload(){
    // Décor
    this.load.image('slotBg',    'assets/slot/slot-background.png');
    this.load.image('slotFrame', 'assets/slot/cadre-slot.png');
    this.load.image('spinBtn',   'assets/slot/spin.png');
    // Symboles réseau
    this.load.image('5G',            'assets/slot/5G.png');
    this.load.image('documentation', 'assets/slot/documentation.png');
    this.load.image('firewall',      'assets/slot/firewall.png');
    this.load.image('optical-fiber', 'assets/slot/optical-fiber.png');
    this.load.image('rj45',          'assets/slot/rj45.png');
    this.load.image('routeur',       'assets/slot/routeur.png');
    this.load.image('server',        'assets/slot/server.png');
    this.load.image('wifi-signal',   'assets/slot/wifi-signal.png');
    this.load.image('antena',        'assets/slot/antena.png');
  }

  create(){
    const { width:W, height:H } = this.scale.gameSize;
    const DEPTH = { frame:100, reels:150, ui:220, overlay:230 };

    this.cameras.main.setBackgroundColor('#0d1117');
    this.add.image(W/2, H/2, 'slotBg').setDisplaySize(W, H);

    // === TUNING CADRE ===
    const FRAME_PAD_X = 0.80;   // 1.00 = pile à l’écran, >1 = plus large
    const FRAME_PAD_Y = 0.90;   // 1.00 = pile à l’écran, >1 = plus haut
    // ---------------------

    const frame = this.add.image(W/2, H/2, 'slotFrame').setDepth(100);
    frame.setScale((W / frame.width) * FRAME_PAD_X, (H / frame.height) * FRAME_PAD_Y);


    // --- Paramètres ---
    this.rows = 3;
    this.cols = 5;
    this.symbolKeys = ['5G','documentation','firewall','optical-fiber','rj45','routeur','server','wifi-signal','antena'];
    this.lineOptions = [1,3,5];
    this.lines = 3;
    this.bet = this.lines;
    this.spinning = false;

    // --- Zone des rouleaux ---
    const area = { rw: Math.min(640, W*0.72), rh: Math.min(420, H*0.60), gap: 10 };
    const reelW = (area.rw - (this.cols - 1)*area.gap) / this.cols;
    const reelH = area.rh;
    const winLeft = W/2 - area.rw/2;
    const winTop  = H/2 - reelH/2;
    this.visibleTopY = (this.scale.gameSize.height/2 - reelH/2);

    // Masque fenêtre — IMPORTANT: on NE détruit PAS le Graphics, on le rend invisible
    const gfx = this.add.graphics().setDepth(DEPTH.reels - 1);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(winLeft, winTop, area.rw, reelH);
    const windowMask = gfx.createGeometryMask();
    gfx.setVisible(false); // conserver pour que le mask reste valide

    // --- Rouleaux AU PREMIER PLAN ---
    this.reels = [];
    for(let i=0;i<this.cols;i++){
      const cont = this.add.container(winLeft + i*(reelW + area.gap) + reelW/2, winTop).setDepth(DEPTH.reels);
      cont.setSize(reelW, reelH).setMask(windowMask);

      const items = [];
      const visible = this.rows, extra = 6, total = visible + extra;
      for(let r=0;r<total;r++){
        const key = Phaser.Utils.Array.GetRandom(this.symbolKeys);
        const img = this.add.image(0, r*(reelH/visible), key).setOrigin(0.5,0).setDepth(DEPTH.reels+1);
        img.setScale((reelW*0.8)/img.width);
        items.push(img); cont.add(img);
      }
      this.reels.push({ cont, items, reelW, reelH, rowH: reelH/visible });
    }

    // --- Status AU-DESSUS DU CADRE ---
    this.status = this.add.text(W/2, winTop - 40, '', {
      fontFamily:'monospace', fontSize:18, color:'#e6f1ff'
    }).setOrigin(0.5,1).setDepth(DEPTH.ui);
    this._refreshStatus();

    // --- Boutons Lines (plus d'espace & plus haut) ---
    const linesY = winTop + reelH + 16; // remonté un chouïa
    this._lineButtonGroup(W/2, linesY);

    // --- Bouton SPIN: plus petit + au-dessus de tout ---
    const spinY = linesY + 44;
    this.spin = this.add.image(W/2, spinY, 'spinBtn').setDepth(DEPTH.overlay).setInteractive({ useHandCursor:true });
    const spinScale = Math.min(W, H) / 2000; // encore plus petit
    this.spin.setScale(0.25 * spinScale);
    this.spin.on('pointerdown', ()=> this.spin.setScale(0.235 * spinScale));
    this.spin.on('pointerup', async ()=>{
      this.spin.setScale(0.25 * spinScale);
      await this._doSpin();
    });

  }

  _lineButtonGroup(cx, y){
    const gap = 120; // plus grand espace
    this.lineBtns = this.lineOptions.map((v, idx)=>{
      return this._btn(cx + (idx-1)*gap, y, `${v} Lines`, ()=>{
        this.lines = v;
        this.bet = v;
        this._refreshStatus();
      }, 120);
    });
  }

  _btn(x,y,label,on,w=120){
    const c = this.add.container(x,y).setDepth(220);
    const bg = this.add.rectangle(0,0,w,30,0x14253a).setStrokeStyle(1,0x6fb1ff).setInteractive({useHandCursor:true});
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

  async _doSpin(){
    if(this.spinning) return;
    this.spinning = true;
    try{
      const res = await api('api/slot/spin', { method:'POST', body:{ bet:this.bet, lines:this.lines } });
      const grid = this._ensureGridCols(res.grid, this.cols);
      await this._animateTo(grid);
      if (typeof res.credits === 'number') this.game.events.emit('credits:update', res.credits);
    } catch(e){
      console.warn('Slot: fallback local (API error):', e);
      const grid = this._randomGrid(this.cols, this.rows);
      await this._animateTo(grid);
    }
    this.spinning = false;
  }

  _ensureGridCols(grid, cols){
    if (!Array.isArray(grid) || grid.length === cols) return grid;
    const out = [];
    for (let i=0;i<cols;i++){
      if (i < grid.length) out.push(grid[i]);
      else out.push(this._randomCol(this.rows));
    }
    return out;
  }
  _randomCol(rows){ return Array.from({length:rows}, ()=> Phaser.Utils.Array.GetRandom(this.symbolKeys)); }
  _randomGrid(cols, rows){ return Array.from({length:cols}, ()=> this._randomCol(rows)); }

  async _animateTo(grid){
    const baseDuration = 1200;
    const stopInterval = 500;      // 0.5 s entre arrêts
    const preNudge = 140;
    const preOffset = 0.5;

    const promises = this.reels.map((reel, i)=>{
      const { cont, rowH, reelH } = reel;

      // Rebuild pile: [random x6] + (top,mid,bot) + [random x4]
      cont.removeAll(true);
      reel.items.length = 0;

      const col = grid[i];
      const pre=6, post=4, seq=[];
      for(let k=0;k<pre;k++)  seq.push(Phaser.Utils.Array.GetRandom(this.symbolKeys));
      seq.push(...col);
      for(let k=0;k<post;k++) seq.push(Phaser.Utils.Array.GetRandom(this.symbolKeys));

      seq.forEach((key, idx)=>{
        const img = this.add.image(0, idx*rowH, key).setOrigin(0.5,0).setDepth(151);
        img.setScale((reel.reelW*0.8)/img.width);
        cont.add(img);
        reel.items.push(img);
      });

      const startY = this.visibleTopY - (reel.items.length - this.rows)*rowH;
      const nudgeY = startY - preOffset*rowH;
      const finalY = this.visibleTopY;

      cont.y = startY;

      return new Promise(resolve=>{
        this.tweens.add({
          targets: cont,
          y: nudgeY,
          duration: preNudge,
          ease: 'Sine.easeOut',
          onComplete: ()=>{
            this.time.delayedCall(i*stopInterval, ()=>{
              this.tweens.add({
                targets: cont,
                y: finalY,
                duration: baseDuration + Phaser.Math.Between(-120,120),
                ease: 'Cubic.easeOut',
                onComplete: resolve
              });
            });
          }
        });
      });
    });

    await Promise.all(promises);
  }
}
