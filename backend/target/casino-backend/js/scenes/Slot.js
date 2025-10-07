// js/scenes/Slot.js
import { post } from '../utils/api.js';

export class Slot extends Phaser.Scene {
  constructor(){ super('Slot'); }

  preload(){
    const L = (k,p)=>{ if(!this.textures.exists(k)) this.load.image(k,p); };

    // Décor
    L('slotBg',    'assets/slot/slot-background.png');
    L('slotFrame', 'assets/slot/cadre-slot.png');
    L('spinBtn',   'assets/slot/spin.png');

    // Symboles (clés = noms sans extension)
    [
      '5G','documentation','firewall','optical-fiber','rj45',
      'routeur','server','wifi-signal','antena'
    ].forEach(k=> L(k, `assets/slot/${k}.png`));
  }

  create(){
    const { width:W, height:H } = this.scale.gameSize;
    this.cameras.main.setBackgroundColor('#0d1117');

    // Fond + cadre
    this.add.image(W/2, H/2, 'slotBg').setDisplaySize(W, H);
    const frame = this.add.image(W/2, H/2, 'slotFrame').setDepth(100);
    frame.setScale(W / frame.width, H / frame.height); // scale indépendant X/Y

    // Paramètres
    this.rows = 3;
    this.symbolKeys = [
      '5G','documentation','firewall','optical-fiber','rj45',
      'routeur','server','wifi-signal','antena'
    ];
    this.bet = 1; this.stopped = true;

    // Zone visuelle des rouleaux
    const area = { rw: Math.min(360, W*0.30), rh: Math.min(420, H*0.60), gap: 12 };
    const reelW = (area.rw*3 + area.gap*2)/3, reelH = area.rh;
    const winLeft = W/2 - (reelW*3 + area.gap*2)/2, winTop = H/2 - reelH/2;

    // Masque fenêtre
    const g = this.add.graphics();
    g.fillStyle(0xffffff,1);
    g.fillRect(winLeft, winTop, reelW*3 + area.gap*2, reelH);
    const mask = g.createGeometryMask(); g.destroy();

    // Crée 3 rouleaux
    this.reels = [];
    for(let i=0;i<3;i++){
      const cont = this.add.container(winLeft + i*(reelW + area.gap) + reelW/2, winTop).setMask(mask);
      cont.setSize(reelW, reelH);

      const items = [];
      const visible = this.rows, extra = 5, total = visible + extra;
      for(let r=0;r<total;r++){
        const key = Phaser.Utils.Array.GetRandom(this.symbolKeys);
        const img = this.add.image(0, r*(reelH/visible), key).setOrigin(0.5,0);
        img.setScale((reelW*0.8)/img.width);
        items.push(img); cont.add(img);
      }
      this.reels.push({ cont, items, reelW, reelH, rowH: reelH/visible });
    }

    // UI
    this.status = this.add.text(W/2, 28, 'Bet: 1', { fontFamily:'monospace', fontSize:18, color:'#e6f1ff' }).setOrigin(0.5,0);
    this._btn(W/2-150, winTop + reelH + 64, '- Bet', ()=>{ this.bet = Math.max(1, this.bet-1); this._setStatus(); }, 90);
    this._btn(W/2+150, winTop + reelH + 64, '+ Bet', ()=>{ this.bet += 1; this._setStatus(); }, 90);

    this.spin = this.add.image(W/2, winTop + reelH + 64, 'spinBtn')
      .setInteractive({useHandCursor:true})
      .on('pointerdown', ()=> this.spin.setScale(0.96))
      .on('pointerup', async ()=>{
        this.spin.setScale(1);
        await this._doSpin();
      });

    this.add.text(W/2, H-26,
      'Payline: milieu — 5G×50, BAR=routeur? (×10), firewall×5, le reste ×2',
      { fontFamily:'monospace', fontSize:14, color:'#bcd' }).setOrigin(0.5);
  }

  _btn(x,y,label,on,w=120){
    const c = this.add.container(x,y);
    const bg = this.add.rectangle(0,0,w,32,0x14253a).setStrokeStyle(1,0x6fb1ff).setInteractive({useHandCursor:true});
    const tx = this.add.text(0,0,label,{fontFamily:'monospace',fontSize:14,color:'#eaffff'}).setOrigin(0.5);
    bg.on('pointerdown',()=> bg.setScale(0.98));
    bg.on('pointerup',()=>{ bg.setScale(1); on&&on(); });
    c.add([bg,tx]); return c;
  }
  _setStatus(t){ this.status.setText(t || `Bet: ${this.bet}`); }

  async _doSpin(){
    if(!this.stopped) return;
    this.stopped = false; this._setStatus('Spinning...');
    try{
      const { grid, payout, credits } = await post('api/slot/spin', { bet: this.bet });
      await this._animateTo(grid);
      this.game.events.emit('credits:update', credits);
      if(payout>0){ this._flashWin(); this._setStatus(`WIN +${payout}`); }
      else this._setStatus('No win');
    } catch(e){ console.error(e); this._setStatus('Server error'); }
    this.stopped = true;
  }

  async _animateTo(grid){
    const dur = 1100, stagger = 200;
    const promises = this.reels.map((reel, i)=>{
      const { cont, rowH, reelH } = reel;
      // rebuild pile vers la cible: [random x5] + top,mid,bot + [random x3]
      cont.removeAll(true);
      reel.items.length = 0;

      const col = grid[i]; // ex: ['rj45','5G','server']
      const pre=5, post=3, seq=[];
      for(let k=0;k<pre;k++) seq.push(Phaser.Utils.Array.GetRandom(this.symbolKeys));
      seq.push(...col);
      for(let k=0;k<post;k++) seq.push(Phaser.Utils.Array.GetRandom(this.symbolKeys));

      seq.forEach((key, idx)=>{
        const img = this.add.image(0, idx*rowH, key).setOrigin(0.5,0);
        img.setScale((reel.reelW*0.8)/img.width);
        cont.add(img); reel.items.push(img);
      });

      const topStart = (this.scale.gameSize.height/2 - reelH/2) - (reel.items.length-3)*rowH;
      cont.y = topStart;

      return new Promise(resolve=>{
        this.tweens.add({
          targets: cont,
          y: this.scale.gameSize.height/2 - reelH/2,
          duration: dur + i*stagger,
          ease: 'Cubic.easeOut',
          onComplete: resolve
        });
      });
    });
    await Promise.all(promises);
  }

  _flashWin(){
    const { width:W, height:H } = this.scale.gameSize;
    const r = this.add.rectangle(W/2, H/2, W, H, 0x00ff88, 0.12).setDepth(999);
    this.tweens.add({ targets:r, alpha:0, duration:420, onComplete:()=>r.destroy() });
  }
}
