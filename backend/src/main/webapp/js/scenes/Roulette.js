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
    this.betUnit = 10;
    this.localBets = [];

    // --- chips overlay ---
    this.numCells = {};                 // n -> {cx, cy, w, h}
    this.chipsByNumber = new Map();     // n -> Image[]
    this.chipsLayer = this.add.container(0,0).setDepth(50);


    this.needsParam = t => ['STRAIGHT','DOZEN','COLUMN'].includes(t);

    // Bandeau statut
    this.status = this.add.text(W/2, 14, 'Mise de base minimale : 10', {
      fontFamily:'monospace', fontSize:18, color:'#e6f1ff'
    }).setOrigin(0.5,0);

    // Solde + dernier résultat
    this.balanceTxt = this.add.text(16, 16, 'Solde: —', { fontFamily:'monospace', fontSize:16, color:'#cfe7ff' });
    this.lastTxt    = this.add.text(16, 40, 'Dernier: —', { fontFamily:'monospace', fontSize:16, color:'#cfe7ff' });
    this.BetTxt    = this.add.text(16, 700, '*Jeton vert (réduire mise), jeton rouge (augmenter mise)', { fontFamily:'monospace', fontSize:16, color:'#cfe7ff' });

    // Roue à droite
    this._buildWheel(W, H);

    // Panneau des mises
    const panelW = Math.min(360, W*0.32), panelH = Math.min(240, H*0.35);
    const panelX = W - panelW/2 - 16, panelY = 16 + panelH/2;
    if (this.textures.exists('panel')) {
      this.add.image(panelX, panelY, 'panel').setDisplaySize(panelW, panelH).setAlpha(0.9).setDepth(30);
    } else {
      this.add.rectangle(panelX, panelY, panelW, panelH, 0x0f1e2f, 0.8).setStrokeStyle(1, 0x6fb1ff).setDepth(30);
    }
    this.betsTxt = this.add.text(panelX - panelW/2 + 12, panelY - panelH/2 + 10, 'Aucune mise.', {
      fontFamily:'monospace', fontSize:14, color:'#e6f1ff', wordWrap:{ width: panelW-24 }
    }).setDepth(31);


    // Spin & Clear
    const spin = this._imageBtn(W/2, H-110, 'spinBtn', async ()=>{ await this._doSpin(); });
    if (spin) spin.setScale(0.4);

    const clear = this._imageBtn(W/2, H-60, 'clearBtn', async ()=>{
      await this._clearBets(); this._toast('Mises effacées.');
    });
    if (clear) clear.setScale(0.4);

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
    const grid = { left: 24, top: 100, cellW: 56, cellH: 40, gap: 6 };
    this._buildNumberGrid(grid);

    // mettre les types de mises sous la table
    const placeBetButtons = ()=>{
      const c34 = this.numCells[34];
      const c36 = this.numCells[36];
      if (!c34 || !c36) return; // sécurité : si pas encore prêts, on réessaie au tick suivant

      const yBelow = Math.max(c34.cy + c34.h/2, c36.cy + c36.h/2) + 18;

      const small_chip = this._imageBtn(c34.cx, yBelow, 'RedChipsBtnchip', ()=>{
        this.betUnit = Math.max(10, this.betUnit-10);
        this._setStatus(); this._toast(`Bet − : ${this.betUnit}`);
      });
      if (small_chip) small_chip.setScale(0.03).setDepth(60);

      const big_chip = this._imageBtn(c36.cx, yBelow, 'GreenChipsBtn', ()=>{
        this.betUnit += 10;
        this._setStatus(); this._toast(`Bet + : ${this.betUnit}`);
      });
      if (big_chip) big_chip.setScale(0.03).setDepth(60);
    };

    // Appel immédiat + re-try au tick suivant si nécessaire
    placeBetButtons();
    this.time.delayedCall(0, placeBetButtons);



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

    // 1) Crée la roue qui TOURNE
    this.wheel = null;
    if (this.textures.exists('RouletteWheel')){
      this.wheel = this.add.image(0,0,'RouletteWheel');
      const s2 = Math.min(maxSize*0.96/this.wheel.width, maxSize*0.96/this.wheel.height);
      this.wheel.setScale(s2);
      this.wheelGroup.add(this.wheel); // ajoutée AVANT le hub si on veut le hub DEVANT
    } else {
      // fallback visuel si l'asset n'existe pas
      const r = this.add.circle(0,0, Math.floor(maxSize*0.45), 0x444444);
      this.wheelGroup.add(r);
    }

    // 2) Ajoute le "moyeu" centré (fixe). IMPORTANT : ordre d'ajout !
    if (this.textures.exists('RouletteWheel_bg')){
      const hub = this.add.image(0,0,'RouletteWheel_bg');

      // Taille ~32% du diamètre de la roue
      const refW = this.wheel ? this.wheel.displayWidth : maxSize;
      const ratio = 1.10; // ajuste entre 0.25 et 0.45
      const target = refW * ratio;
      const sHub = Math.min(target / hub.width, target / hub.height);
      hub.setScale(sHub);

      // Si tu veux que le hub soit DEVANT la roue :
      // this.wheelGroup.add(hub);

      // Si ton hub est opaque et recouvre tout, mets-le DERRIÈRE la roue :
      this.wheelGroup.addAt(hub, 0);
    }

    // 3) Curseur au-dessus
    if (this.textures.exists('StaticCursor')){
      const ref = this.wheel;
      const radius = ref ? (ref.displayWidth/2) : (maxSize/2);
      const cursor = this.add.image(0, -radius - 14, 'StaticCursor');
      if (cursor.width && cursor.height){
        const cs = Math.min(28/cursor.width, 28/cursor.height);
        cursor.setScale(cs);
      }
      this.wheelGroup.add(cursor); // ajouté en dernier ⇒ au-dessus
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
      // anime toujours autour de l'échelle courante (quel que soit le setScale appliqué après)
      node.on('pointerdown', ()=> node.setScale(node.scale * 0.96));
      node.on('pointerup',   ()=> { node.setScale(node.scale / 0.96); on&&on(); });
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
    this._registerCell(0, left, top, cellW, cellH);
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
        this._registerCell(n, x, y, cellW, cellH);
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

   _registerCell(n, x, y, w, h){
     this.numCells[n] = { cx: x + w/2, cy: y + h/2, w, h };
   }

   // ---------- Chips (affichage) ----------
   _addChipOnNumber(n){
     const cell = this.numCells[n]; if (!cell) return;
     if (!this.chipsByNumber.has(n)) this.chipsByNumber.set(n, []);
     const stack = this.chipsByNumber.get(n);

     const key = (stack.length % 2 === 0) ? 'GreenChipsBtn' : 'RedChipsBtnchip';
     const chip = this.add.image(cell.cx, cell.cy, key);
     this.chipsLayer.add(chip);

     // scale auto en fonction de la case
     const target = Math.min(cell.w, cell.h) * 0.78;
     const base = Math.max(chip.width || 64, chip.height || 64);
     chip.setScale(target / base);

     // léger décalage pour l'empilement
     const off = Math.min(cell.w, cell.h) * 0.14;
     const col = stack.length % 3;
     const row = Math.floor(stack.length / 3);
     chip.x += (col - 1) * off;
     chip.y -= row * (off * 0.9);

     // petite anim
     chip.setAlpha(0).setScale(chip.scale * 0.8);
     this.tweens.add({ targets: chip, alpha:1, scale: chip.scale/0.8, duration:120, ease:'Cubic.Out' });

     stack.push(chip);
   }

   _clearChips(){
     for (const [,list] of this.chipsByNumber){ list.forEach(s=> s.destroy()); }
     this.chipsByNumber.clear();
   }

   _rebuildChipsFromLocalBets(){
     this._clearChips();
     for (const b of this.localBets){
       if (b.type === 'STRAIGHT' && b.param != null){
         const count = Math.max(1, Number(b.amount) | 0);
         for (let i=0;i<count;i++) this._addChipOnNumber(b.param);
       }
     }
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
        this._rebuildChipsFromLocalBets();
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
      if (type==='STRAIGHT' && param!=null) this._addChipOnNumber(param);
    }catch(e){
      // Fallback local
      this.localBets.push({ type, amount:Number(amount), param: param ?? null });
      this._renderBets();
      if (type==='STRAIGHT' && param!=null) this._addChipOnNumber(param);
      throw e;
    }
  }

  async _clearBets(){
    try{
      await api('api/roulette/bets', { method:'DELETE' });
    }catch{}
    this.localBets = [];
    this._renderBets();
    this._clearChips();
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
      this._clearChips();
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
      this._clearChips();
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