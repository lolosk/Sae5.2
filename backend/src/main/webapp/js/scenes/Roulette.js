// js/scenes/Roulette.js
import { api } from '../utils/api.js';

export class Roulette extends Phaser.Scene {
  constructor(){ super('Roulette'); }

  preload(){
    const L = (k,p)=>{ if(!this.textures.exists(k)) this.load.image(k,p); };

    // Décor / UI
    L('rouletteBg',        'assets/roulette/bgRoulette.png');
    L('spinBtn',           'assets/roulette/spin-roulette.png');
    L('clearBtn',          'assets/roulette/clear.png'); // nouveau (fallback bouton texte si absent)

    // Jetons (utilisés pour Bet -/+)
    L('GreenChipsBtn',     'assets/roulette/green-chips.png');
    L('RedChipsBtnchip',   'assets/roulette/red-chips.png');

    // Roue + curseur
    L('RouletteWheel_bg',  'assets/roulette/roulette_wheel_bg.png');
    L('RouletteWheel',     'assets/roulette/roulette_wheel.png'); // si absent, fallback sur _bg
    L('StaticCursor',      'assets/roulette/triangle.png');

    // Panneau
    L('panel',             'assets/roulette/panel.png');
  }

  create(){
    // Compat Phaser 3.5x+
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setBackgroundColor('#0d1117');

    // Fond
    if (this.textures.exists('rouletteBg')) {
      this.add.image(W/2, H/2, 'rouletteBg').setDisplaySize(W, H);
    }

    // État local
    this.betUnit = 1;
    this.localBets = [];
    this.needsParam = t => ['STRAIGHT','DOZEN','COLUMN'].includes(t);

    // Bandeau statut
    this.status = this.add.text(W/2, 14, 'Bet: 1', {
      fontFamily:'monospace', fontSize:18, color:'#e6f1ff'
    }).setOrigin(0.5,0);

    // Solde + dernier résultat
    this.balanceTxt = this.add.text(16, 16, 'Solde: —', { fontFamily:'monospace', fontSize:16, color:'#cfe7ff' });
    this.lastTxt    = this.add.text(16, 40, 'Dernier: —', { fontFamily:'monospace', fontSize:16, color:'#cfe7ff' });

    // Roue à droite
    this._buildWheel(W, H);

    // Panneau des mises
    const panelW = Math.min(360, W*0.32), panelH = Math.min(240, H*0.35);
    const panelX = W - panelW/2 - 16, panelY = 16 + panelH/2;
    if (this.textures.exists('panel')) {
      this.add.image(panelX, panelY, 'panel').setDisplaySize(panelW, panelH).setAlpha(0.9);
    } else {
      this.add.rectangle(panelX, panelY, panelW, panelH, 0x0f1e2f, 0.8).setStrokeStyle(1, 0x6fb1ff);
    }
    this.betsTxt = this.add.text(panelX - panelW/2 + 12, panelY - panelH/2 + 10, 'Aucune mise.', {
      fontFamily:'monospace', fontSize:14, color:'#e6f1ff', wordWrap:{ width: panelW-24 }
    });

    // Bet -/+ avec jetons
    const chipY = H - 64;
    const minus = this._imageBtn(W/2 - 160, chipY, 'RedChipsBtnchip', ()=>{
      this.betUnit = Math.max(1, this.betUnit-1); this._setStatus(); this._toast(`Bet − : ${this.betUnit}`);
    });
    minus && minus.setScale(0.6);

    const plus = this._imageBtn(W/2 + 160, chipY, 'GreenChipsBtn', ()=>{
      this.betUnit += 1; this._setStatus(); this._toast(`Bet + : ${this.betUnit}`);
    });
    plus && plus.setScale(0.6);

    // Spin & Clear
    const spin = this._imageBtn(W/2, H-110, 'spinBtn', async ()=>{ await this._doSpin(); });
    if (spin) spin.setScale(0.9);

    const clear = this._imageBtn(W/2, H-60, 'clearBtn', async ()=>{
      await this._clearBets(); this._toast('Mises effacées.');
    });
    if (clear) clear.setScale(0.7);

    // Raccourcis (pari rapides)
    const quicks = [
      {label:'RED',   type:'RED'},
      {label:'BLACK', type:'BLACK'},
      {label:'EVEN',  type:'EVEN'},
      {label:'ODD',   type:'ODD'},
      {label:'1-18',  type:'LOW'},
      {label:'19-36', type:'HIGH'}
    ];
    const qY = H-150, qStart = 24, qGap = 86;
    quicks.forEach((q,i)=>{
      this._btn(qStart + i*qGap, qY, q.label, async ()=>{
        try{
          await this._addBet({ type:q.type, amount:this.betUnit });
          this._toast(`Mise ${q.label} +${this.betUnit}`);
        }catch{}
      }, 80);
    });

    // Grille 0..36 (clic = plein)
    this._buildNumberGrid({ left: 24, top: 100, cellW: 56, cellH: 40, gap: 6 });

    // Dozens / Columns
    this._btn(24,       24+56,      'Dozen 1',  async ()=> this._placeParamBet('DOZEN',1));
    this._btn(24+100,   24+56,      'Dozen 2',  async ()=> this._placeParamBet('DOZEN',2));
    this._btn(24+200,   24+56,      'Dozen 3',  async ()=> this._placeParamBet('DOZEN',3));
    this._btn(24,       24+56+40,   'Column 1', async ()=> this._placeParamBet('COLUMN',1));
    this._btn(24+100,   24+56+40,   'Column 2', async ()=> this._placeParamBet('COLUMN',2));
    this._btn(24+200,   24+56+40,   'Column 3', async ()=> this._placeParamBet('COLUMN',3));

    // Init
    this._setStatus();
    this._getState().catch(()=>{});
  }

  // ---------- Construction roue ----------
  _buildWheel(W,H){
    const rightMargin = 16;
    const wheelAreaW = Math.min(W*0.42, W*0.5);
    const maxSize = Math.min(wheelAreaW, H*0.62);
    const wheelX = W - rightMargin - maxSize/2;
    const wheelY = Math.max(H*0.48, 220);

    this.wheelGroup = this.add.container(wheelX, wheelY);

    // BG
    if (this.textures.exists('RouletteWheel_bg')){
      const bg = this.add.image(0,0,'RouletteWheel_bg');
      const s = Math.min(maxSize/bg.width, maxSize/bg.height);
      bg.setScale(s);
      this.wheelGroup.add(bg);
    }

    // Wheel rotative (fallback sur bg si l’asset n’existe pas)
    let baseKey = this.textures.exists('RouletteWheel') ? 'RouletteWheel' :
                  (this.textures.exists('RouletteWheel_bg') ? 'RouletteWheel_bg' : null);
    if (baseKey){
      this.wheel = this.add.image(0,0,baseKey);
      const s2 = Math.min(maxSize*0.96/this.wheel.width, maxSize*0.96/this.wheel.height);
      this.wheel.setScale(s2);
      this.wheelGroup.add(this.wheel);
    } else {
      this.wheel = null;
    }

    // Curseur
    if (this.textures.exists('StaticCursor')){
      const ref = this.wheel ?? this.wheelGroup.list[0];
      const radius = ref ? (ref.displayWidth/2) : (maxSize/2);
      const cursor = this.add.image(0, -radius - 14, 'StaticCursor');
      if (cursor.width && cursor.height){
        const cs = Math.min(28/cursor.width, 28/cursor.height);
        cursor.setScale(cs);
      }
      cursor.setDepth(10);
      this.wheelGroup.add(cursor);
    }
  }

  // ---------- UI helpers ----------
  _btn(x,y,label,on,w=120){
    const c = this.add.container(x,y);
    const bg = this.add.rectangle(0,0,w,30,0x14253a).setStrokeStyle(1,0x6fb1ff).setInteractive({useHandCursor:true});
    const tx = this.add.text(0,0,label,{fontFamily:'monospace',fontSize:14,color:'#eaffff'}).setOrigin(0.5);
    bg.on('pointerdown',()=> bg.setScale(0.98));
    bg.on('pointerup',()=>{ bg.setScale(1); on&&on(); });
    c.add([bg,tx]); return c;
  }
  _imageBtn(x,y,key,on){
    if(this.textures.exists(key)){
      const node = this.add.image(x,y,key).setInteractive({useHandCursor:true});
      const base =  node.scale || 1;
      node.on('pointerdown',()=> node.setScale(base*0.96));
      node.on('pointerup',()=>{ node.setScale(base); on&&on(); });
      return node;
    }
    else {
      return this._btn(x,y,key, on, 120);
    }
  }
  _setStatus(t){ if(this.status && this.status.setText) this.status.setText(t || `Bet: ${this.betUnit}`); }
  _euro(n){ return Number(n).toFixed(2) + ' €'; }
  _toast(t){
    this._setStatus(t);
    this.time.delayedCall(900, ()=> this._setStatus(), null, this);
  }

  // ---------- Grille numéros ----------
  _buildNumberGrid({ left, top, cellW, cellH, gap }){
    // 0
    const zero = this._gridCell(left, top, cellW, cellH, '0', 0x0aa44a);
    zero.on('pointerup', async ()=>{ await this._placeStraight(0); });

    // 1..36
    const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    for(let row=0; row<12; row++){
      for(let col=0; col<3; col++){
        const n = row*3 + (col+1);
        const x = left + cellW + gap + col*(cellW+gap);
        const y = top + row*(cellH+gap);
        const color = reds.has(n) ? 0xb02121 : 0x111111;
        const c = this._gridCell(x, y, cellW, cellH, String(n), color);
        c.on('pointerup', async ()=>{ await this._placeStraight(n); });
      }
    }
  }
  _gridCell(x,y,w,h,label,bgColor){
    const c = this.add.container(x + w/2, y + h/2).setSize(w,h);
    const r = this.add.rectangle(0,0,w,h,bgColor).setStrokeStyle(1,0x6fb1ff).setInteractive({useHandCursor:true});
    const t = this.add.text(0,0,label,{fontFamily:'monospace',fontSize:14,color:'#e6f1ff'}).setOrigin(0.5);
    c.add([r,t]);
    r.on('pointerdown',()=> c.setScale(0.98));
    r.on('pointerup',()=> c.setScale(1));
    return r;
  }

  // ---------- API wrappers (fallback local si serveur HS) ----------
  async _getState(){
    try{
      const s = await api('api/roulette/state', { method:'GET' });
      if (typeof s.balance !== 'undefined'){
        this.balanceTxt.setText('Solde: ' + this._euro(s.balance));
      }
      if (Array.isArray(s.bets)){
        this.localBets = s.bets.map(b=>({ type:b.type, amount:b.amount, param:b.param ?? null }));
        this._renderBets();
      }
      if (s.lastResult){
        const { number, color } = s.lastResult;
        this.lastTxt.setText(`Dernier: ${number} (${String(color).toUpperCase()})`);
      }
    }catch(e){
      // Pas de serveur : démarre avec un solde fictif
      this.balanceTxt.setText('Solde: ' + this._euro(1000));
    }
  }

  async _addBet({ type, amount, param }){
    const body = { type, amount:Number(amount) };
    if (param!=null) body.param = param;
    try{
      const r = await api('api/roulette/bets', { method:'POST', body });
      if (r.balance!=null) this.balanceTxt.setText('Solde: ' + this._euro(r.balance));
      if (Array.isArray(r.bets)){
        this.localBets = r.bets.map(b=>({ type:b.type, amount:b.amount, param:b.param ?? null }));
      } else {
        this.localBets.push({ type, amount:Number(amount), param: param ?? null });
      }
      this._renderBets();
    }catch(e){
      // Fallback local
      this.localBets.push({ type, amount:Number(amount), param: param ?? null });
      this._renderBets();
      throw e;
    }
  }

  async _clearBets(){
    try{
      await api('api/roulette/bets', { method:'DELETE' });
    }catch{}
    this.localBets = [];
    this._renderBets();
  }

  async _doSpin(){
    if (this._spinning) return;
    this._spinning = true;
    this._setStatus('Spinning...');

    // Animation roue (si asset dispo)
    const tweenPromise = this.wheel ? new Promise(res=>{
      const extra = Phaser.Math.Between(0, 359);
      this.tweens.add({
        targets: this.wheel,
        angle: this.wheel.angle + 720 + extra,
        duration: 1600,
        ease: 'Cubic.Out',
        onComplete: res
      });
    }) : Promise.resolve();

    try{
      const r = await api('api/roulette/spin', { method:'POST' });
      await tweenPromise;

      if (r.result){
        const { number, color } = r.result;
        this.lastTxt.setText(`Dernier: ${number} (${String(color).toUpperCase()})`);
      }
      if (r.balance!=null) this.balanceTxt.setText('Solde: ' + this._euro(r.balance));
      this.localBets = []; this._renderBets();
      if (r.gain && Number(r.gain)>0){ this._flashWin(); this._setStatus(`WIN +${this._euro(r.gain)}`); }
      else { this._setStatus('No win'); }
      this.game.events.emit('credits:update', r.balance);
    } catch(e){
      // Fallback offline : tirage local
      const n = Phaser.Math.Between(0,36);
      const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
      const color = (n===0) ? 'green' : (reds.has(n)?'red':'black');
      await tweenPromise;
      this.lastTxt.setText(`Dernier: ${n} (${color.toUpperCase()})`);
      this.localBets = []; this._renderBets();
      this._setStatus('No win (offline)');
    }
    this._spinning = false;
  }

  // ---------- Actions haut niveau ----------
  async _placeStraight(n){
    try{
      await this._addBet({ type:'STRAIGHT', amount:this.betUnit, param:n });
      this._toast(`Plein ${n} +${this.betUnit}`);
    }catch(e){ this._toast('Mise enregistrée (offline)'); }
  }
  async _placeParamBet(type, param){
    try{
      await this._addBet({ type, amount:this.betUnit, param });
      this._toast(`${type} ${param} +${this.betUnit}`);
    }catch(e){ this._toast('Mise enregistrée (offline)'); }
  }

  // ---------- Rendu des mises ----------
  _renderBets(){
    if(this.localBets.length===0){ this.betsTxt.setText('Aucune mise.'); return; }
    let total = 0;
    const lines = this.localBets.map(b=>{
      total += Number(b.amount);
      return `• ${b.type}${b.param!=null?' '+b.param:''} : ${this._euro(b.amount)}`;
    });
    lines.push(`\nTotal engagé : ${this._euro(total)}`);
    this.betsTxt.setText(lines.join('\n'));
  }

  // ---------- Effet gain ----------
  _flashWin(){
    const W = this.scale.width, H = this.scale.height;
    const r = this.add.rectangle(W/2, H/2, W, H, 0x00ff88, 0.12).setDepth(999);
    this.tweens.add({ targets:r, alpha:0, duration:420, onComplete:()=>r.destroy() });
  }
}
