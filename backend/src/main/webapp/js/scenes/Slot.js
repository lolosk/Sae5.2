// js/scenes/Slot.js
import { api } from '../utils/api.js';

export class Slot extends Phaser.Scene {
  constructor(){ super('Slot'); }

  // ---------- PRELOAD ----------
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

  // ---------- CREATE ----------
  create(){
    const { width:W, height:H } = this.scale.gameSize;
    const DEPTH = { frame:100, reels:150, ui:220, overlay:230 };

    this.cameras.main.setBackgroundColor('#0d1117');
    this.add.image(W/2, H/2, 'slotBg').setDisplaySize(W, H);

    // === Cadre — on garde TES réglages actuels ===
    const FRAME_PAD_X = 0.80;
    const FRAME_PAD_Y = 0.98;
    const frame = this.add.image(W/2, H/2, 'slotFrame').setDepth(DEPTH.frame);
    frame.setScale((W / frame.width) * FRAME_PAD_X, (H / frame.height) * FRAME_PAD_Y);

    // === Réglages rouleaux — on garde TES valeurs ===
    const COLS = 5;
    const ROWS = 3;
    const REELS_WIDTH  = Math.min(680, W * 0.74);
    const REELS_HEIGHT = Math.min(440, H * 0.42);
    const REELS_OFFSET_X = 0;
    const REELS_OFFSET_Y = 45;
    const GAP_X = 15;
    const SYMBOL_GAP_Y = 4;
    const SYMBOL_FILL_X = 0.82;

    // Expose pour sizing cohérent partout
    this.SYMBOL_FILL_X = SYMBOL_FILL_X;
    this.SYMBOL_GAP_Y  = SYMBOL_GAP_Y;

    // UI (mises = nb de lignes)
    this.symbolKeys = ['5G','documentation','firewall','optical-fiber','rj45','routeur','server','wifi-signal','antena'];
    this.lineOptions = [1,3,5];
    this.lines = 3;
    this.bet = this.lines;
    this.spinning = false;

    // Fenêtre (centrée + offsets)
    const reelW = (REELS_WIDTH - (COLS - 1) * GAP_X) / COLS;
    const reelH = REELS_HEIGHT;
    const winLeft = (W - REELS_WIDTH) / 2 + REELS_OFFSET_X;
    const winTop  = (H - REELS_HEIGHT) / 2 + REELS_OFFSET_Y;
    const rowH    = reelH / ROWS;
    this.visibleTopY = winTop;

    // Masque (gardé vivant)
    const gfx = this.add.graphics().setDepth(DEPTH.reels - 1);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(winLeft, winTop, REELS_WIDTH, REELS_HEIGHT);
    const windowMask = gfx.createGeometryMask();
    gfx.setVisible(false);

    // --- Rideaux fins (adoucir les bords, évite effets visuels en haut/bas) ---
    const curtainH = Math.max(8, Math.floor(rowH * 0.08));
    this.add.rectangle(winLeft + REELS_WIDTH/2, winTop, REELS_WIDTH, curtainH, 0x0a0f14, 0.55)
      .setOrigin(0.5,0).setDepth(DEPTH.frame+1);
    this.add.rectangle(winLeft + REELS_WIDTH/2, winTop + REELS_HEIGHT - curtainH, REELS_WIDTH, curtainH, 0x0a0f14, 0.55)
      .setOrigin(0.5,0).setDepth(DEPTH.frame+1);

    // --- Rubans des rouleaux ---
    // IMPORTANT : longueur suffisante pour que la cible soit loin sous la fenêtre
    // on utilise 96 "lignes" par rouleau pour un spin long et fluide
    this.STRIP_LEN = 96;

    this.reels = [];
    for(let c=0;c<COLS;c++){
      const cont = this.add.container(winLeft + c*(reelW + GAP_X) + reelW/2, winTop).setDepth(DEPTH.reels);
      cont.setSize(reelW, reelH).setMask(windowMask);

      const items = [];
      const keys  = [];
      for(let i=0;i<this.STRIP_LEN;i++){
        const key = Phaser.Utils.Array.GetRandom(this.symbolKeys);
        keys.push(key);
        const img = this.add.image(0, i*rowH, key).setOrigin(0.5,0).setDepth(DEPTH.reels+1);
        const targetW = reelW * this.SYMBOL_FILL_X;
        const targetH = rowH - this.SYMBOL_GAP_Y;
        img.setScale(targetW / img.width, targetH / img.height);
        cont.add(img);
        items.push(img);
      }

      this.reels.push({
        cont, items, keys,
        reelW, reelH, rowH,
        scrollRows: 0  // scroll en unités "lignes"
      });
    }

    // --- UI ---
    this.status = this.add.text(W/2, winTop - 40, '', {
      fontFamily:'monospace', fontSize:18, color:'#e6f1ff'
    }).setOrigin(0.5,1).setDepth(DEPTH.ui);
    this._refreshStatus();

    const linesY = winTop + reelH + 16;
    this._lineButtonGroup(W/2, linesY);

    const spinY = linesY + 44;
    this.spin = this.add.image(W/2, spinY, 'spinBtn').setDepth(DEPTH.overlay).setInteractive({ useHandCursor:true });
    const spinScale = Math.min(W, H) / 2000;
    this.spin.setScale(0.25 * spinScale);
    this.spin.on('pointerdown', ()=> this.spin.setScale(0.235 * spinScale));
    this.spin.on('pointerup', async ()=>{
      this.spin.setScale(0.25 * spinScale);
      await this._doSpin();
    });
  }

  // ---------- UI helpers ----------
  _lineButtonGroup(cx, y){
    const gap = 120;
    this.lineBtns = this.lineOptions.map((v, idx)=>{
      return this._btn(cx + (idx-1)*gap, y, `${v} Lines`, ()=>{
        this.lines = v; this.bet = v; this._refreshStatus();
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

  // ---------- Helpers ruban ----------
  _normalizeReel(reel){
    // Aligne le symbole du haut sur l'index 0 et met scrollRows=0, sans changer visuellement
    const total = this.STRIP_LEN;
    const topIdx = Math.round(((reel.scrollRows % total) + total) % total);
    if (topIdx !== 0){
      // rotation logique des "keys"
      reel.keys = reel.keys.slice(topIdx).concat(reel.keys.slice(0, topIdx));
      // rotation des sprites (on ne recrée rien)
      const items = reel.items.slice(topIdx).concat(reel.items.slice(0, topIdx));
      reel.items = items;
    }
    // repositionne proprement, haut = 0,1,2...
    reel.items.forEach((img, i)=>{ img.y = i * reel.rowH; });
    reel.scrollRows = 0;
  }

  _applyKeysToSprites(reel, startIndex=0){
    // met à jour les textures à partir de "keys" (évite de toucher aux 3 visibles si startIndex>=3)
    const total = this.STRIP_LEN;
    for (let i=startIndex; i<total; i++){
      const key = reel.keys[i];
      const img = reel.items[i];
      if (img.texture.key !== key){
        img.setTexture(key);
        const targetW = reel.reelW * this.SYMBOL_FILL_X;
        const targetH = reel.rowH - this.SYMBOL_GAP_Y;
        img.setScale(targetW / img.width, targetH / img.height);
      }
    }
  }

  _setReelScrollRows(reel, rowsFloat){
    // rowsFloat = combien de lignes on a défilé (peut être fractionnaire)
    const total = this.STRIP_LEN;
    reel.scrollRows = rowsFloat;
    const offset = ((rowsFloat % total) + total) % total; // [0,total)
    reel.items.forEach((img, i)=>{
      // position locale dans [0,total) * rowH
      const pos = ((i - offset) % total + total) % total;
      img.y = pos * reel.rowH;
    });
  }

  // ---------- Spin principal ----------
  async _doSpin(){
    if (this.spinning) return;
    this.spinning = true;

    // Récupère le résultat (fallback local si API down)
    let grid;
    try{
      const res = await api('api/slot/spin', { method:'POST', body:{ bet:this.bet, lines:this.lines } });
      grid = this._ensureGridCols(res.grid, this.reels.length);
      if (typeof res.credits === 'number') this.game.events.emit('credits:update', res.credits);
    } catch(e){
      grid = this._randomGrid(this.reels.length, 3);
    }

    await this._animateTo(grid);
    this.spinning = false;
  }

  _ensureGridCols(grid, cols){
    if (Array.isArray(grid) && grid.length === cols) return grid;
    if (!Array.isArray(grid)) return this._randomGrid(cols,3);
    const out = [];
    for(let i=0;i<cols;i++) out.push(grid[i] || this._randomCol(3));
    return out;
  }
  _randomCol(rows){ return Array.from({length:rows}, ()=> Phaser.Utils.Array.GetRandom(this.symbolKeys)); }
  _randomGrid(cols, rows){ return Array.from({length:cols}, ()=> this._randomCol(rows)); }

  // ---------- Animation sans “TP”: on prépare le ruban, puis on défile (aucun remap à la fin) ----------
  async _animateTo(grid){
    // Phases et distances (en LIGNES) — choisies pour que la somme soit un ENTIER
    const STAGGER_MS = 500;     // décalage entre rouleaux
    const LIFT_ROWS  = 0.35;    // petit lift vers le haut
    const LIFT_MS    = 140;
    const SPIN_ROWS  = 64;      // spin rapide (grandes distances => plus "vite")
    const SPIN_MS    = 3000;
    const STOP_INT   = 6;       // freinage en nb de lignes entières
    const STOP_ROWS  = STOP_INT + LIFT_ROWS; // ajoute LIFT pour que -LIFT+SPIN+STOP soit ENTIER
    const STOP_MS    = 1100;

    // = Somme finale = -LIFT + SPIN + STOP = SPIN_ROWS + STOP_INT (ENTIER) ⇒ arrêt net sur une cellule
    const FINAL_DELTA = SPIN_ROWS + STOP_INT; // e.g. 64 + 6 = 70 lignes

    const promises = this.reels.map((reel, i)=>{
      // 1) Normalise le rouleau (aucun saut au clic)
      this._normalizeReel(reel); // top visible = index 0, scrollRows=0

      // 2) Prépare le ruban: on place le TRIPLET CIBLE à l’index "FINAL_DELTA"
      // (loin sous la fenêtre, donc jamais visible avant la fin)
      const target = grid[i]; // ['top','mid','bot']
      const total  = this.STRIP_LEN;
      const idxTop = FINAL_DELTA % total;
      const idxMid = (idxTop + 1) % total;
      const idxBot = (idxTop + 2) % total;

      // On remplit le ruban de clés random, sauf TOP/MID/BOT cibles
      for(let k=3;k<total;k++){
        const idx = (k < idxTop || k > idxBot) ? k : (idxBot+1); // éviter d'écraser la cible
        if (idx >= total) break;
        // pas besoin de tout réécrire si déjà ok
        if (reel.keys[idx] === undefined) reel.keys[idx] = Phaser.Utils.Array.GetRandom(this.symbolKeys);
      }
      // FORCER la cible aux indices réservés (loin sous la fenêtre)
      reel.keys[idxTop] = target[0];
      reel.keys[idxMid] = target[1];
      reel.keys[idxBot] = target[2];

      // Applique les keys aux sprites **à partir de l’index 3** (on ne touche pas aux 3 visibles)
      this._applyKeysToSprites(reel, 3);

      // 3) Trajectoire sur scrollRows
      const start = 0;
      const lift  = start - LIFT_ROWS;
      const spin  = lift  + SPIN_ROWS;
      const stop  = spin  + STOP_ROWS; // = FINAL_DELTA + petit epsilon (LIFT_ROWS compensé)

      return new Promise(resolve=>{
        this.time.delayedCall(i * STAGGER_MS, ()=>{

          // LIFT (vers le haut, discret)
          this.tweens.add({
            targets: { r: start },
            r: lift,
            duration: LIFT_MS,
            ease: 'Sine.easeOut',
            onUpdate: (tw, o)=> this._setReelScrollRows(reel, o.r),
            onComplete: ()=>{

              // SPIN (linéaire, 3s)
              this.tweens.add({
                targets: { r: lift },
                r: spin,
                duration: SPIN_MS,
                ease: 'Linear',
                onUpdate: (tw, o)=> this._setReelScrollRows(reel, o.r),
                onComplete: ()=>{

                  // STOP (ease-out) jusqu’à "stop"
                  this.tweens.add({
                    targets: { r: spin },
                    r: stop,
                    duration: STOP_MS,
                    ease: 'Cubic.easeOut',
                    onUpdate: (tw, o)=> this._setReelScrollRows(reel, o.r),
                    onComplete: ()=>{
                      // On est naturellement à FINAL_DELTA lignes (car -lift+spin+stop = ENTIER)
                      // Pas de remap, pas de snap, pas de TP. C’est DÉJÀ la cible.
                      // Pour le prochain spin, on renormalisera au clic (scrollRows→0) sans bouger visuellement.
                      resolve();
                    }
                  });

                }
              });

            }
          });

        });
      });
    });

    await Promise.all(promises);
  }
}
