/*
 * Slot Machine Réseaux – Phaser 3 (simple & fonctionnel)
 * - 5 rouleaux, 3 rangées visibles
 * - Tous les rouleaux commencent à rouler vers le BAS en même temps
 * - Le 1er s'arrête à 3.0s, puis chaque 0.5s (2e, 3e, 4e, 5e)
 * - Stop = alignement au centre + normalisation (anti-trous)
 * - 5 lignes de paiement (haut/milieu/bas + 2 diagonales)
 */

class SlotScene extends Phaser.Scene {
  constructor() {
    super("slot");

    // Disposition
    this.REELS = 5;
    this.ROWS = 3;
    this.GAP_X = 28;
    this.PADDING = 24;
    this.SYMBOL_PADDING = 12;  // espace visuel autour du symbole (8–16 marche bien)


    // Animation
    this.SPIN_SPEED = 2600;         // px/s vers le BAS
    this.FIRST_STOP_MS = 1000;     // 3s avant arrêt du 1er
    this.STOP_STEP_MS  = 500;      // +0.5s par rouleau suivant
    this.STOP_EASE_MS  = 250;      // durée de l’alignement final
    this.KICK_UP_MS    = 90;      // petit "saut" initial vers le haut

    // Bande (longueur suffisante pour spinner sans souci)
    this.STRIP_REPEAT = 28;

    // Backend
    this.USE_SERVER = false;       // mettre à true si /api/spin dispo
  }

  preload() {
    // Chemins relatifs à slots-phaser.html
    this.load.image("wifi",     "imgs/slot/wifi-signal.png");
    this.load.image("rj45",     "imgs/slot/rj45.png");
    this.load.image("router",   "imgs/slot/routeur.png");
    this.load.image("server",   "imgs/slot/server.png");
    this.load.image("firewall", "imgs/slot/firewall.png");
    this.load.image("fiber",    "imgs/slot/optical-fiber.png");
    this.load.image("antenna",  "imgs/slot/antena.png");
    this.load.image("fiveg",    "imgs/slot/5G.png");
    this.load.image("doc",      "imgs/slot/documentation.png");

    this.load.image("slotBg",     "imgs/slot/slot-background.png");
    this.load.image("slotFrame",  "imgs/slot/cadre-slot.png");
    this.load.image("spinImg", "imgs/slot/spin.png");

  }

  create() {
    // Taille symbole integer (anti sous-pixels)
    const W = this.scale.gameSize.width;
    const gaps = (this.REELS - 1) * this.GAP_X;
    this.SYMBOL = Math.floor((W - 2 * this.PADDING - gaps) / this.REELS);
    this.SYMBOL = Phaser.Math.Clamp(this.SYMBOL, 72, 160);

    // Fenêtre d’affichage
    this.winW = this.REELS * this.SYMBOL + gaps;
    this.winH = this.ROWS * this.SYMBOL;
    this.winX = Math.floor((W - this.winW) / 2);
    this.winY = 100;

    // ---- FOND GLOBAL (plein écran, "cover") ----
    const bg = this.add.image(this.scale.gameSize.width/2, this.scale.gameSize.height/2, "slotBg");
    bg.setDepth(-100);
    const sX = this.scale.gameSize.width  / bg.width;
    const sY = this.scale.gameSize.height / bg.height;
    bg.setScale(Math.max(sX, sY)); // couvre tout l'écran

    // (si tu avais un fillRect décoratif derrière: garde-le si tu veux un liseré, sinon supprime-le)


    // Titre
    //this.add.text(W/2, 40, "🎰 Slot Réseaux", { fontSize: "32px", color: "#fff" }).setOrigin(0.5);

    // Cadre + masque
    const g = this.add.graphics();
    g.fillStyle(0x0b1020, 1).fillRoundedRect(this.winX-12, this.winY-12, this.winW+24, this.winH+24, 12);
    g.lineStyle(2, 0x2a355a).strokeRoundedRect(this.winX-12, this.winY-12, this.winW+24, this.winH+24, 12);

    const maskG = this.make.graphics({ x: 0, y: 0, add: false });
    maskG.fillStyle(0xffffff).fillRect(this.winX, this.winY, this.winW, this.winH);
    this.windowMask = maskG.createGeometryMask();

    // HUD & bouton
    this.balance = 100; this.currWin = 0;
    this.balanceText = this.add.text(this.winX, this.winY + this.winH + 24, `Solde: ${this.balance.toFixed(2)}€`, { fontSize: "16px", color: "#e5e7eb" });
    this.winText     = this.add.text(this.winX + this.winW - 120, this.winY + this.winH + 24, `Gain: 0€`, { fontSize: "16px", color: "#e5e7eb" });

    // ---- BOUTON SPIN (image) ----
    const btnY = this.winY + this.winH + 64;

    // crée l'image
    this.spinBtn = this.add.image(this.scale.gameSize.width / 2, btnY, "spinImg");
    this.spinBtn.setOrigin(0.5);

    // mise à l’échelle : ajuste à ~160px de large (ou ce que tu veux)
    const targetBtnWidth = 160;
    const s = targetBtnWidth / this.spinBtn.width;
    this.spinBtn.setScale(s);

    // interactions
    this.spinBtn.setInteractive({ useHandCursor: true });

    // toujours au-dessus du cadre et des rouleaux
    this.spinBtn.setDepth(1000);

    // état visuel “enabled/disabled”
    this.updateSpinButtonState = (enabled) => {
      if (enabled) {
        this.spinBtn.clearTint();
        this.spinBtn.setAlpha(1);
        this.spinBtn.disableInteractive(false);
        this.spinBtn.setInteractive({ useHandCursor: true });
      } else {
        // un peu grisé quand ça tourne
        this.spinBtn.setTint(0xaaaaaa);
        this.spinBtn.setAlpha(0.85);
        this.spinBtn.disableInteractive(); // évite le spam click
      }
    };

    // petit helper d’animation press/release
    const pressAnim = (down) => {
      const toScale = down ? s * 0.92 : s;
      const toY = down ? btnY + 3 : btnY;
      this.tweens.add({
        targets: this.spinBtn,
        scaleX: toScale,
        scaleY: toScale,
        y: toY,
        duration: 90,
        ease: "Cubic.easeOut"
      });
    };

    // events
    this.spinBtn.on("pointerover", () => {
      if (this.isSpinning) return;
      this.tweens.add({ targets: this.spinBtn, scaleX: s * 1.04, scaleY: s * 1.04, duration: 120, ease: "Cubic.easeOut" });
    });
    this.spinBtn.on("pointerout", () => {
      if (this.isSpinning) return;
      this.tweens.add({ targets: this.spinBtn, scaleX: s, scaleY: s, duration: 120, ease: "Cubic.easeOut" });
      pressAnim(false);
    });
    this.spinBtn.on("pointerdown", () => {
      if (this.isSpinning) return;
      pressAnim(true);
    });
    this.spinBtn.on("pointerup", () => {
      if (this.isSpinning) return;
      pressAnim(false);
      // lance le spin
      this.onSpin();
    });


    // Symboles
    this.symbolKeys = ["wifi","rj45","router","server","firewall","fiber","antenna","fiveg","doc"];

    // Construire les rouleaux
    this.reels = [];
    for (let r = 0; r < this.REELS; r++) this.reels.push(this.buildReel(r));

    // Paylines (5)
    this.PAYLINES = [
      [1,1,1,1,1], // milieu
      [0,0,0,0,0], // haut
      [2,2,2,2,2], // bas
      [0,1,2,1,0], // V
      [2,1,0,1,2], // Λ
    ];
    this.paylineOverlay = this.add.graphics().setDepth(10);

    // Game loop
    this.events.on("update", this.updateLoop, this);
  }

  buildReel(reelIndex) {
    const x = this.winX + this.SYMBOL/2 + reelIndex*(this.SYMBOL + this.GAP_X);

    // séquence longue (mélangée)
    const base = Phaser.Utils.Array.Shuffle([...this.symbolKeys]);
    const keys = [];
    for (let i = 0; i < this.STRIP_REPEAT; i++) keys.push(...Phaser.Utils.Array.Shuffle([...base]));

    const strip = this.add.container(x, this.winY).setMask(this.windowMask);
    const sprites = [];
    for (let i = 0; i < keys.length; i++) {
      const spr = this.add.image(0, i*this.SYMBOL + this.SYMBOL/2, keys[i]);
      spr.setDisplaySize(
        this.SYMBOL - 2 * this.SYMBOL_PADDING,
        this.SYMBOL - 2 * this.SYMBOL_PADDING
      ).setOrigin(0.5);

      strip.add(spr);
      sprites.push(spr);
    }

    // ---- CADRE PAR-DESSUS (taille exacte) ----
    const FRAME_OUTER_W = this.winW + 400;  // largeur finale voulue
    const FRAME_OUTER_H = this.winH + 290;  // hauteur finale voulue

    const frame = this.add.image(
      this.winX + this.winW / 2,
      this.winY + this.winH / 2,
      "slotFrame"
    );
    frame.setDepth(50);

    // scale indépendants pour atteindre la taille exacte
    const scaleX = FRAME_OUTER_W / frame.width;
    const scaleY = FRAME_OUTER_H / frame.height;
    frame.setScale(scaleX, scaleY);

    this.spinBtn?.setDepth(1000);
    this.balanceText?.setDepth(1000);
    this.winText?.setDepth(1000);





    // position initiale alignée grille
    const maxTop = Math.max(0, keys.length - this.ROWS - this.symbolKeys.length*3);
    const startTop = Phaser.Math.Between(0, maxTop);
    strip.y = this.winY - startTop*this.SYMBOL;

    return {
      strip, keys, sprites,
      mode: "idle",     // "idle" | "spin" | "stopTween"
      speed: 0
    };
  }

  // ==== SPIN ====
  async onSpin() {
    if (this.isSpinning) return;
    this.isSpinning = true; this.spinBtn.setAlpha(0.6);
    this.paylineOverlay.clear(); this.winText.setText("Gain: 0€");

    // si tu veux imposer les résultats via backend, c'est ici
    // (ici on laisse le hasard du stop)
    // const midTargets = await this.getServerResult();

    // Kick-up instantané + départ simultané vers le BAS
    for (const reel of this.reels) {
      // petit saut vers le haut
      this.tweens.add({
        targets: reel.strip, y: reel.strip.y - this.SYMBOL/2,
        duration: this.KICK_UP_MS, ease: "Cubic.easeOut"
      });
      reel.mode = "spin";
      reel.speed = this.SPIN_SPEED; // px/s (⬇️ vers le bas car on augmente y)
    }

    // Planifie les arrêts: 1er à 3s, puis +0.5s chacun
    for (let r = 0; r < this.REELS; r++) {
      this.time.delayedCall(this.FIRST_STOP_MS + r*this.STOP_STEP_MS, () => this.stopReel(r));
    }

    // Quand tout est fini, calcule les gains
    const totalStopTime = this.FIRST_STOP_MS + (this.REELS - 1)*this.STOP_STEP_MS + this.STOP_EASE_MS + 50;
    this.time.delayedCall(totalStopTime, () => {
      const grid = this.readVisibleGrid();
      const res  = this.evaluateWin(grid, 1.0);
      this.currWin = res.total;
      this.winText.setText(`Gain: ${this.currWin.toFixed(2)}€`);
      this.highlightWins(res.hits);
      this.isSpinning = false; this.spinBtn.setAlpha(1);
    });
  }

  // Arrêt d’un rouleau: on aligne le symbole le plus proche du centre
  stopReel(index) {
    const reel = this.reels[index];
    if (reel.mode !== "spin") return;

    reel.mode = "stopTween";
    reel.speed = 0;

    const centerY = this.winY + Math.floor(this.ROWS/2)*this.SYMBOL + this.SYMBOL/2;

    // trouve le sprite le plus proche du centre
    let best = null, bestD = Infinity;
    for (const s of reel.sprites) {
      const wy = reel.strip.y + s.y;
      const d  = Math.abs(wy - centerY);
      if (d < bestD) { bestD = d; best = s; }
    }
    const delta = centerY - (reel.strip.y + best.y);

    // petit tween d’alignement
    this.tweens.add({
      targets: reel.strip,
      y: reel.strip.y + delta,
      duration: this.STOP_EASE_MS,
      ease: "Cubic.easeOut",
      onComplete: () => {
        // snap pile sur la grille + normalisation (espacement exact)
        reel.strip.y = Math.round((reel.strip.y - this.winY)/this.SYMBOL)*this.SYMBOL + this.winY;
        this.normalizeReel(reel);
        reel.mode = "idle";
      }
    });
  }

  // Boucle de jeu: fait descendre tous les rouleaux actifs + wrap anti-trous
  updateLoop(time, delta) {
    const dt = delta / 1000; // en secondes
    for (const reel of this.reels) {
      if (reel.mode !== "spin") continue;

      reel.strip.y += reel.speed * dt;          // ⬇️ descend
      reel.strip.y = Math.round(reel.strip.y);  // anti sous-pixels
      this.wrapDownward(reel);
    }
  }

  // Wrap vers le BAS: recycle les sprites sortis sous la fenêtre (au-dessus du plus haut)
  wrapDownward(reel) {
    const { strip, sprites } = reel;
    const bottom = this.winY + this.winH;

    let minY = Infinity;
    for (const s of sprites) if (s.y < minY) minY = s.y;

    for (const s of sprites) {
      // tant que le haut du sprite a dépassé le bas de la fenêtre
      while ((strip.y + s.y) - this.SYMBOL/2 >= bottom) {
        s.y = minY - this.SYMBOL;
        // snap centres
        s.y = Math.round((s.y - this.SYMBOL/2)/this.SYMBOL)*this.SYMBOL + this.SYMBOL/2;
        minY = s.y;
      }
    }
  }

  // Aligne parfaitement l’espacement des sprites (… , n-1, n, n+1 …)
  normalizeReel(reel) {
    const arr = [...reel.sprites].sort((a,b)=>a.y-b.y);
    let y0 = arr[0].y;
    y0 = Math.round((y0 - this.SYMBOL/2)/this.SYMBOL)*this.SYMBOL + this.SYMBOL/2;
    arr[0].y = y0;
    for (let i = 1; i < arr.length; i++) arr[i].y = arr[i-1].y + this.SYMBOL;
  }

  // Lit la grille 5x3: pour chaque case, prend le sprite dont le centre est le plus proche
  readVisibleGrid() {
    const grid = [];
    const centers = [0,1,2].map(r => this.winY + r*this.SYMBOL + this.SYMBOL/2);
    for (let c = 0; c < this.REELS; c++) {
      const reel = this.reels[c];
      const col = [];
      for (const cy of centers) {
        let best = null, bestD = Infinity;
        for (const s of reel.sprites) {
          const wy = reel.strip.y + s.y;
          const d  = Math.abs(wy - cy);
          if (d < bestD) { bestD = d; best = s; }
        }
        col.push(best?.texture?.key || "?");
      }
      grid.push(col);
    }
    return grid; // [reel][row]
  }

  // 5 lignes de paiement basiques
  evaluateWin(grid, bet) {
    let total = 0;
    const hits = [];

    const PAYTABLE = {
      wifi:2.0, rj45:2.2, router:2.4, server:2.8,
      firewall:3.0, fiber:3.2, antenna:2.0, fiveg:3.5, doc:1.8
    };

    for (let li = 0; li < this.PAYLINES.length; li++) {
      const patt = this.PAYLINES[li];
      const seq = [];
      for (let r = 0; r < this.REELS; r++) seq.push(grid[r][patt[r]]);

      if (seq.every(k => k === seq[0])) {
        const key = seq[0], mult = PAYTABLE[key] || 0;
        const win = Math.round(bet * mult * 100) / 100;
        total += win; hits.push({ lineIndex: li, key, mult, count: 5 });
      } else {
        // 4/3 à gauche
        let streak = 1;
        for (let i = 1; i < seq.length; i++) { if (seq[i] === seq[i-1]) streak++; else break; }
        if (streak >= 3) {
          const key = seq[0], base = PAYTABLE[key] || 0;
          const factor = (streak === 4) ? 0.6 : 0.3;
          const win = Math.round(bet * base * factor * 100) / 100;
          total += win; hits.push({ lineIndex: li, key, mult: base*factor, count: streak });
        }
      }
    }
    return { total, hits };
  }

  highlightWins(hits) {
    this.paylineOverlay.clear();
    if (!hits || !hits.length) return;

    const cx = this.winX, cy = this.winY;
    this.paylineOverlay.lineStyle(3, 0xffffff, 0.28);

    for (const h of hits) {
      const patt = this.PAYLINES[h.lineIndex];
      const pts = [];
      for (let r = 0; r < this.REELS; r++) {
        const x = cx + r*(this.SYMBOL + this.GAP_X) + this.SYMBOL/2;
        const y = cy + patt[r]*this.SYMBOL + this.SYMBOL/2;
        pts.push(new Phaser.Math.Vector2(x,y));
      }
      this.paylineOverlay.beginPath();
      this.paylineOverlay.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) this.paylineOverlay.lineTo(pts[i].x, pts[i].y);
      this.paylineOverlay.strokePath();
    }

    this.add.tween({ targets: this.paylineOverlay, alpha: { from: 0.2, to: 1 }, duration: 180, yoyo: true, repeat: 2 });
  }

  // (Optionnel) backend: renvoyer { mid: string[5] } pour imposer la ligne du milieu
  async getServerResult() {
    if (!this.USE_SERVER) {
      return Array.from({ length: this.REELS }, () => Phaser.Utils.Array.GetRandom(this.symbolKeys));
    }
    const res = await fetch("/api/spin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bet: 1.0 }) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (Array.isArray(data.mid)) return data.mid.slice(0,this.REELS);
    throw new Error("Réponse invalide du serveur");
  }
}

// Boot
const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 760,
  backgroundColor: "#1a1d25",
  parent: "game-container",
  scene: [SlotScene],
  pixelArt: true,
  render: { roundPixels: true }, // évite les micro-trous
};
new Phaser.Game(config);
