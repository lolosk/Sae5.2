// js/scenes/Roulette.js
import { api } from '../utils/api.js';

/**
 * Scène Phaser gérant le jeu de roulette.
 * Cette scène s'occupe :
 * - du chargement des assets graphiques,
 * - de l'affichage de la table, de la roue et des jetons,
 * - de la gestion des mises et du solde joueur,
 * - de la communication avec l'API backend (état, mises, tirage).
 */
export class Roulette extends Phaser.Scene {

  /**
   * Crée une nouvelle instance de scène "Roulette".
   * Le nom "Roulette" est utilisé pour référencer cette scène dans Phaser.
   */
  constructor(){ super('Roulette'); }

  /**
   * Précharge toutes les images nécessaires à la scène de roulette.
   * On ne charge que les textures qui ne sont pas déjà présentes dans Phaser.
   */
  preload(){
    const L = (k,p)=>{ if(!this.textures.exists(k)) this.load.image(k,p); };

    // Images de décor et d'interface (fond, boutons principaux)
    L('rouletteBg',        'assets/roulette/bgRoulette.png');
    L('spinBtn',           'assets/roulette/spin-roulette.png');
    //L('clearBtn',          'assets/roulette/clear.png'); // Bouton pour effacer les mises

    // Jetons (boutons visuels pour ajuster la mise de base)
    L('GreenChipsBtn',     'assets/roulette/green-chips.png');
    L('RedChipsBtnchip',   'assets/roulette/red-chips.png');

    // Roue et curseur statique
    L('RouletteWheel_bg',  'assets/roulette/roulette_wheel_bg.png');
    L('RouletteWheel',     'assets/roulette/roulette_wheel.png');
    L('StaticCursor',      'assets/roulette/triangle.png');

    // Panneau affichant le détail des mises
    //L('panel',             'assets/roulette/panel.png');

    // --- SFX roulette ---
    this.load.audio('roulette_spin',      'assets/roulette/sfx/spinning_roulette.mp3');
    this.load.audio('roulette_win',       'assets/roulette/sfx/player_win.mp3');
    this.load.audio('roulette_place',     'assets/roulette/sfx/placing_bet.mp3');
    this.load.audio('roulette_timeout',   'assets/roulette/sfx/time_out_bet.mp3');
    this.load.audio('roulette_tic_slow',  'assets/roulette/sfx/slow_tic_tac.mp3');
    this.load.audio('roulette_tic_fast',  'assets/roulette/sfx/fast_tic_tac.mp3');

  }


// CREATE CREATE CREATE CREATE CREATE CREATE CREATE CREATE CREATE CREATE CREATE CREATE CREATE CREATE CREATE
  /**
   * Point d'entrée de la scène.
   * Installe tout ce qui est visible à l'écran :
   * - fond, texte de statut,
   * - roue, table de mise, boutons de pari rapide,
   * - panneau de récapitulatif des mises.
   */
  create(){
    // Récupération des dimensions utiles de la scène
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setBackgroundColor('#0d1117');

    // Affichage du fond (si l'image a bien été chargée)
    if (this.textures.exists('rouletteBg')) {
      this.add.image(W/2, H/2, 'rouletteBg').setDisplaySize(W, H);
    }

    // Variables locales de jeu
    this.betUnit = 10;
    this.localBets = [];

    // Conteneur dédié à l'affichage des jetons sur la table
    this.numCells = {};                 // n -> {cx, cy, w, h}
    this.chipsByNumber = new Map();     // n -> Image[]
    this.chipsLayer = this.add.container(0,0).setDepth(50);

    // Types de mises qui nécessitent un paramètre numérique
    this.needsParam = t => ['STRAIGHT','DOZEN','COLUMN'].includes(t);

    // Texte de statut en haut de l'écran (rappelle la mise de base)
    this.status = this.add.text(W/2, 14, 'Mise de base minimale : 10', {
      fontFamily:'monospace', fontSize:18, color:'#e6f1ff'
    }).setOrigin(0.5,0);

    // Solde actuel + dernier tirage connu
    this.balanceTxt = this.add.text(16, 16, 'Solde: —', { fontFamily:'monospace', fontSize:16, color:'#cfe7ff' });
    this.balance = 0;
    this.lastTxt    = this.add.text(16, 40, 'Dernier: —', { fontFamily:'monospace', fontSize:16, color:'#cfe7ff' });

    // Petit texte explicatif pour les boutons de jetons
    this.BetTxt    = this.add.text(16, 700, '*Jeton vert (augmenter mise), jeton rouge (réduire mise)', { fontFamily:'monospace', fontSize:16, color:'#cfe7ff' });

    // Création de la roue et de son curseur à droite de l'écran
    this._buildWheel(W, H);

    // === Panneau récap (position fixe) ===
    const panelW = 300, panelH = 420;     // taille fixe
    const panelX = 200,  panelY = 390;    // ↩ change juste ces 2 nombres pour déplacer

    let panelBg;
    if (this.textures.exists('panel')) {
      panelBg = this.add.image(panelX, panelY, 'panel')
        .setDisplaySize(panelW, panelH).setAlpha(0.9).setDepth(30);
    } else {
      panelBg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x0f1e2f, 0.8)
        .setStrokeStyle(1, 0x6fb1ff).setDepth(30);
    }
    this.betsTxt = this.add.text(panelX - panelW/2 + 12, panelY - panelH/2 + 10, 'Aucune mise.', {
      fontFamily:'monospace', fontSize:14, color:'#e6f1ff', wordWrap:{ width: panelW-24 }
    }).setDepth(31);



    // --- SFX instanciés ---
    this.sfx = {
      spin:    this.sound.add('roulette_spin'),
      win:     this.sound.add('roulette_win'),
      place:   this.sound.add('roulette_place'),
      timeout: this.sound.add('roulette_timeout'),
      slow:    this.sound.add('roulette_tic_slow', { loop:true }),
      fast:    this.sound.add('roulette_tic_fast', { loop:true })
    };

    // --- Timer de manche (30s + spin auto) ---
    this.roundDuration = 30;
    this.roundTimeLeft = this.roundDuration;
    this.bettingOpen   = true;   // true = on peut miser
    this.timerPhase    = null;   // 'slow' | 'fast' | 'locked' | 'none'

    // Affichage du temps en haut-droite
    this.timerTxt = this.add.text(W-16, 40, 'Temps: 30s', {
      fontFamily:'monospace', fontSize:16, color:'#ffeb99'
    }).setOrigin(1,0);

    this._updateTimerText();
    this._switchTimerPhase('slow'); // 30s -> 20s : tic tac lent

    // Événement qui décrémente chaque seconde
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this._onTimerTick()
    });



    // Bouton "Spin" : lance un tirage de roulette via le backend
    if (this.wheel) {
      const wheelBottom = this.wheelGroup.y + (this.wheel.displayHeight / 2);

      const spin = this._imageBtn(
        this.wheelGroup.x,        // centré sous la roue
        wheelBottom + 100,        // 100 px sous la roue
        'spinBtn',
        async ()=>{ await this._doSpin(); }
      );
      if (spin){
        spin.setScale(0.15);
        this.spinBtn = spin;      // on garde une référence pour _setSpinEnabled
      }
    }


    // Paramètres de base pour la grille de numéros
    const cellW = 56;
    const cellH = 40;
    const gap   = 6;

    // Calcul de la largeur de la grille et position horizontale (avec un léger décalage à gauche)
    const tableWidth = 3 * cellW + 2 * gap;
    const tableLeft  = (W - tableWidth) / 2 - 250; // décalage à gauche pour laisser la place à la roue

    // Position verticale de départ pour la table
    const top = 100;

    // Objet de configuration pour la grille
    const grid = {
      left:  tableLeft,
      top:   top,
      cellW: cellW,
      cellH: cellH,
      gap:   gap
    };

    // Construction de la grille 0..36
    this._buildNumberGrid(grid);

    /**
     * Ajoute les deux boutons de jetons sous la table :
     * - jeton rouge (diminue la mise) sous le 34,
     * - bouton "clear" sous le 35,
     * - jeton vert (augmente la mise) sous le 36.
     */
    const placeBetButtons = () => {
      const c34 = this.numCells[34];
      const c35 = this.numCells[35];
      const c36 = this.numCells[36];
      if (!c34 || !c35 || !c36) return; // Si la grille n'est pas encore prête, on retente plus tard

      // On prend la ligne la plus basse des trois cases et on ajoute un petit offset
      const yBelow = Math.max(
        c34.cy + c34.h / 2,
        c35.cy + c35.h / 2,
        c36.cy + c36.h / 2
      ) + 27;

      // Jeton rouge sous le 34 (miser moins)
      const small_chip = this._imageBtn(c34.cx, yBelow, 'RedChipsBtnchip', () => {
        this.betUnit = Math.max(10, this.betUnit - 10);
        this._setStatus();
        this._toast(`Bet − : ${this.betUnit}`);
      });
      if (small_chip) small_chip.setScale(0.045).setDepth(60);

      // Bouton CLEAR sous le 35
      const clearBtn = this._imageBtn(c35.cx, yBelow, 'clearBtn', () => {
        // On affiche le message tout de suite
        this._toast('Mises effacées.');

        // On lance le nettoyage des mises (asynchrone, mais on ne l’attend pas ici)
        this._clearBets().catch(()=>{});
      });
      if (clearBtn) clearBtn.setScale(0.6).setDepth(60);

      // Jeton vert sous le 36 (miser plus)
      const big_chip = this._imageBtn(c36.cx, yBelow, 'GreenChipsBtn', () => {
        this.betUnit += 10;
        this._setStatus();
        this._toast(`Bet + : ${this.betUnit}`);
      });
      if (big_chip) big_chip.setScale(0.045).setDepth(60);
    };

    // On essaie d'ajouter les boutons immédiatement puis une fois la grille finalisée
    placeBetButtons();
    this.time.delayedCall(0, placeBetButtons);

    // --- Boutons COLUMN 1/2/3 au-dessus des cases 1, 2 et 3 ---
    const placeColumnButtons = () => {
    const c1 = this.numCells[1];
    const c2 = this.numCells[2];
    const c3 = this.numCells[3];
    if (!c1 || !c2 || !c3) return;
        // Y au-dessus de la première ligne (cases 1,2,3)
          const margin = 12; // marge verticale au-dessus de la case
          const yAbove = c1.cy - c1.h / 2 - margin;

          // Largeur = largeur d'une case (optionnel, sinon _btn utilise w=90 par défaut)
          const btnW = c1.w;

          this._btn(c1.cx, yAbove, 'Column 1',
            async () => await this._placeParamBet('COLUMN', 1),
            btnW
          );
          this._btn(c2.cx, yAbove, 'Column 2',
            async () => await this._placeParamBet('COLUMN', 2),
            btnW
          );
          this._btn(c3.cx, yAbove, 'Column 3',
            async () => await this._placeParamBet('COLUMN', 3),
            btnW
          );
        };

        placeColumnButtons();
        this.time.delayedCall(0, placeColumnButtons);

    // --- Boutons RED / BLACK / EVEN / ODD / 1-18 / 19-36 sur le côté du tapis ---

    const quicks = [
      { label: '1-18',  type: 'LOW',   colorBg: 0x14253a },
      { label: 'EVEN',  type: 'EVEN',  colorBg: 0x14253a },
      { label: 'RED',   type: 'RED',   colorBg: 0xb00000 }, // ROUGE
      { label: 'BLACK', type: 'BLACK', colorBg: 0x000000 }, // NOIR
      { label: 'ODD',   type: 'ODD',   colorBg: 0x14253a },
      { label: '19-36', type: 'HIGH',  colorBg: 0x14253a }
    ];

    // Décalage horizontal à droite de la grille
    const offsetX = 109;

    // Hauteur du bouton
    const btnH = 91;

    // Écart vertical entre les boutons
    const spacing = 0;

    // Position de départ
    const startX = tableLeft + tableWidth + offsetX;
    const startY = top + 46;

    quicks.forEach((q, i) => {
      const y = startY + i * (btnH + spacing);

      // Création manuelle d’un bouton custom plus haut & coloré
      const btn = this.add.container(startX, y);

      const bg = this.add.rectangle(0, 0, 90, btnH, q.colorBg)
        .setStrokeStyle(1, 0x6fb1ff)
        .setInteractive({ useHandCursor: true })
        .setOrigin(0.5);

      const tx = this.add.text(0, 0, q.label, {
        fontFamily: 'monospace',
        fontSize: 16,
        color: '#eaffff'
      }).setOrigin(0.5);

      bg.on('pointerdown', () => bg.setScale(0.97));
      bg.on('pointerup', () => {
        bg.setScale(1);
        this._addBet({ type: q.type, amount: this.betUnit })
          .then(() => this._toast(`Mise ${q.label} +${this.betUnit}`))
          .catch(() => {});
      });

      btn.add([bg, tx]);
    });

    // Boutons pour les douzaines et les colonnes (mises de type DOZEN / COLUMN)
    this._btn(100,       24+56,      'Dozen 1',  async ()=> this._placeParamBet('DOZEN',1));
    this._btn(100+100,   24+56,      'Dozen 2',  async ()=> this._placeParamBet('DOZEN',2));
    this._btn(100+200,   24+56,      'Dozen 3',  async ()=> this._placeParamBet('DOZEN',3));

    // Lecture de l'état initial (solde, mises, dernier tirage) auprès de l'API
    this._setStatus();
    this._getState().catch(()=>{});
  }


  /**
   * Construit la roue de roulette et le curseur sur le côté droit de l'écran.
   * @param {number} W largeur de la zone de jeu
   * @param {number} H hauteur de la zone de jeu
   */
  _buildWheel(W,H){
    const rightMargin = 16;
    const wheelAreaW = Math.min(W*0.42, W*0.5);
    const maxSize     = Math.min(wheelAreaW, H*0.62);

    // ➜ décalage supplémentaire vers la gauche
    const offsetLeft = 80; // augmente cette valeur pour pousser encore plus à gauche

    const wheelX = W - rightMargin - maxSize/2 - offsetLeft;
    const wheelY = Math.max(H*0.45, 220);

    this.wheelGroup = this.add.container(wheelX, wheelY);


    // Image principale de la roue qui sera animée lors du tirage
    this.wheel = null;
    if (this.textures.exists('RouletteWheel')){
      this.wheel = this.add.image(0,0,'RouletteWheel');
      const s2 = Math.min(maxSize*0.96/this.wheel.width, maxSize*0.96/this.wheel.height);
      this.wheel.setScale(s2);
      this.wheelGroup.add(this.wheel);
    } else {
      // Si la texture n'est pas disponible, on dessine un cercle simple pour garder un repère visuel
      const r = this.add.circle(0,0, Math.floor(maxSize*0.45), 0x444444);
      this.wheelGroup.add(r);
    }

    // Ajout du "moyeu" au centre (image décorative)
    if (this.textures.exists('RouletteWheel_bg')){
      const hub = this.add.image(0,0,'RouletteWheel_bg');

      // Ajustement de la taille du moyeu par rapport au diamètre de la roue
      const refW = this.wheel ? this.wheel.displayWidth : maxSize;
      const ratio = 1.3;
      const target = refW * ratio;
      const sHub = Math.min(target / hub.width, target / hub.height);
      hub.setScale(sHub);

      // Le moyeu est placé derrière la roue pour ne pas cacher ses cases
      this.wheelGroup.addAt(hub, 0);
    }

    // Curseur statique qui indique la case gagnante lorsque la roue s'arrête
    if (this.textures.exists('StaticCursor')){
      const ref = this.wheel;
      const radius = ref ? (ref.displayWidth/2) : (maxSize/2);
      const cursor = this.add.image(0, -radius - 0, 'StaticCursor');
      if (cursor.width && cursor.height){
        const cs = Math.min(40/cursor.width, 40/cursor.height);
        cursor.setScale(cs);
      }
      this.wheelGroup.add(cursor);
    }
  }

      /**
       * Mapping de la roue (roulette européenne, 0 en haut).
       * On part de 0 en haut puis on tourne DANS LE SENS HORAIRE (vers la droite).
       * 32 est donc juste à droite de 0 et 26 juste à gauche.
       */
      _initWheelMapping(){
        if (this._wheelOrder) return;

        // Ordre complet en tournant dans le sens horaire à partir de 0
        this._wheelOrder = [
          0,
          32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
          10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];

        // 37 cases -> angle d'un secteur
        this._sectorAngle = 360 / this._wheelOrder.length; // ≈ 9.7297°

        // Si jamais le curseur n’est pas pile sur le centre de la case,
        // tu pourras jouer sur cette valeur (0 au début, on ajuste ensuite).
        this._pointerOffsetDeg = 0;
      }


      /**
       * Calcule l'angle final de la roue pour qu'un numéro donné soit sous le curseur.
       * @param {number} num Numéro gagnant (0..36)
       * @returns {number} angle absolu cible en degrés
       */
      _angleForNumber(num){
        if (!this.wheel) return 0;

        this._initWheelMapping();

        const n = Number(num);
        const idx = this._wheelOrder.indexOf(n);
        if (idx === -1){
          // Si le numéro est invalide on fait juste 2 tours de plus
          return this.wheel.angle + 720;
        }

        // Orientation de base : 0 en haut quand angle = 0.
        // Pour mettre l’index idx sous le curseur (en haut),
        // on veut une rotation de -idx * secteurAngle (sens anti-horaire),
        // plus un éventuel décalage global du curseur.
        const baseAngle = -idx * this._sectorAngle + this._pointerOffsetDeg;

        const current = this.wheel.angle;
        let target = baseAngle;

        // On ajoute des tours complets pour toujours avoir au moins 2 tours
        while (target <= current + 720){
          target += 360;
        }
        return target;
      }


      /**
       * Anime la roue pour qu'elle s'arrête sur un numéro donné.
       * @param {number} num Numéro gagnant
       * @param {number} [duration=2000] Durée de l'anim en ms
       * @returns {Promise<void>}
       */
      _spinWheelToNumber(num, duration = 8000){
        if (!this.wheel) return Promise.resolve();

        const targetAngle = this._angleForNumber(num);

        return new Promise(resolve=>{
          this.tweens.add({
            targets: this.wheel,
            angle:   targetAngle,
            duration,
            ease: 'Cubic.Out',
            onComplete: resolve
          });
        });
      }



  /**
   * Crée un bouton rectangulaire simple avec un label centré.
   * @param {number} x position X
   * @param {number} y position Y
   * @param {string} label texte à afficher
   * @param {Function} on callback appelé au clic
   * @param {number} [w=120] largeur du bouton
   * @returns {Phaser.GameObjects.Container} conteneur du bouton
   */
  _btn(x, y, label, on, w = 90) {
    const c = this.add.container(x, y);

    // Couleur par défaut
    let bgColor = 0x14253a;
    let textColor = '#eaffff';

    // Cas particuliers : RED et BLACK
    if (label === 'RED') {
      bgColor = 0xb00000;   // rouge
    }
    if (label === 'BLACK') {
      bgColor = 0x000000;   // noir
    }

    const bg = this.add.rectangle(0, 0, w, 60, bgColor)
      .setStrokeStyle(1, 0x6fb1ff)
      .setInteractive({ useHandCursor: true });

    const tx = this.add.text(0, 0, label, {
      fontFamily: 'monospace',
      fontSize: 14,
      color: textColor
    }).setOrigin(0.5);

    bg.on('pointerdown', () => bg.setScale(0.98));
    bg.on('pointerup', () => { bg.setScale(1); on && on(); });

    c.add([bg, tx]);
    return c;
  }

  /**
   * Crée un bouton basé sur une image si la texture existe,
   * sinon bascule sur un bouton rectangulaire classique avec le même label.
   * @param {number} x position X
   * @param {number} y position Y
   * @param {string} key clé de texture Phaser
   * @param {Function} on callback appelé au clic
   * @returns {Phaser.GameObjects.Image|Phaser.GameObjects.Container} bouton image ou bouton de secours
   */
  _imageBtn(x,y,key,on){
    if(this.textures.exists(key)){
      const node = this.add.image(x,y,key).setInteractive({useHandCursor:true});
      // Animation légère au clic pour donner un retour visuel
      node.on('pointerdown', ()=> node.setScale(node.scale * 0.96));
      node.on('pointerup',   ()=> { node.setScale(node.scale / 0.96); on&&on(); });
      return node;
    }
    else {
      return this._btn(x,y,key, on, 120);
    }
  }

  /**
   * Met à jour le message affiché dans la zone de statut.
   * @param {string} [t] texte à afficher, ou message par défaut si omis
   */
  _setStatus(t){ if(this.status && this.status.setText) this.status.setText(t || `Bet: ${this.betUnit}`); }

  /**
   * Formatte une valeur numérique en euros avec deux décimales.
   * @param {number} n montant
   * @returns {string} montant formaté (ex: "10.00 €")
   */
  _euro(n){ return Number(n).toFixed(2) + ' €'; }

  /**
   * Affiche un message temporaire dans la zone de statut puis rétablit le texte par défaut.
   * @param {string} t message à afficher brièvement
   */
  _toast(t){
    this._setStatus(t);
    this.time.delayedCall(900, ()=> this._setStatus(), null, this);
  }

  // --- Gestion du solde en local (vue côté client) ---

  /**
   * Initialise le solde local du joueur.
   * @param {number} n valeur initiale du solde
   */
  _initBalance(n){
    this.balanceVal = Number(n) || 0;
    if (this.balanceTxt) this.balanceTxt.setText('Solde: ' + this._euro(this.balanceVal));
  }

  /**
   * Ajoute un montant positif au solde local.
   * @param {number} n montant à créditer
   */
  _applyCredit(n){
    this.balanceVal = (Number(this.balanceVal)||0) + (Number(n)||0);
    if (this.balanceTxt) this.balanceTxt.setText('Solde: ' + this._euro(this.balanceVal));
  }

  /**
   * Retire un montant du solde local si les fonds sont suffisants.
   * @param {number} n montant à débiter
   * @returns {boolean} true si le débit a été effectué, false sinon
   */
  _applyDebit(n){
    n = Number(n)||0;
    if ((Number(this.balanceVal)||0) < n) return false;
    this.balanceVal -= n;
    if (this.balanceTxt) this.balanceTxt.setText('Solde: ' + this._euro(this.balanceVal));
    return true;
  }

  /**
   * Calcule la somme de toutes les mises actuellement enregistrées localement.
   * @returns {number} total des mises
   */
  _currentStake(){
    return this.localBets.reduce((t,b)=> t + Number(b.amount||0), 0);
  }

  /**
   * Met à jour la variable de solde principale utilisée pour l'affichage.
   * @param {number} v nouveau solde
   */
  _setBalance(v){
    this.balance = Math.max(0, Number(v) || 0);
    if (this.balanceTxt) this.balanceTxt.setText('Solde: ' + this._euro(this.balance));
  }

  /**
   * Indique si le joueur peut miser un certain montant au vu de son solde.
   * @param {number} amt montant à miser
   * @returns {boolean} true si le solde est suffisant
   */
  _canStake(amt){ return this.balance >= Number(amt || 0); }

  /**
   * Débite le solde principal d'un certain montant.
   * @param {number} amt montant à débiter
   */
  _applyDebit(amt){ this._setBalance(this.balance - Number(amt || 0)); }

  /**
   * Crédite le solde principal d'un certain montant.
   * @param {number} amt montant à créditer
   */
  _applyCredit(amt){ this._setBalance(this.balance + Number(amt || 0)); }

  /**
   * Recalcule le montant total actuellement engagé dans les mises locales.
   * @returns {number} total des mises
   */
  _currentStake(){
    return this.localBets.reduce((s,b)=> s + Number(b.amount || 0), 0);
  }

  /**
   * Construit la grille de numéros de 0 à 36.
   * @param {Object} param0 configuration (left, top, cellW, cellH, gap)
   */
  _buildNumberGrid({ left, top, cellW, cellH, gap }){
    // Case spéciale pour le 0, placée à gauche
    this._registerCell(0, left, top, cellW, cellH);
    const zero = this._gridCell(left, top, cellW, cellH, '0', 0x0aa44a);
    zero.on('pointerup', async ()=>{ await this._placeStraight(0); });

    // Construction des numéros 1 à 36 en 3 colonnes et 12 lignes
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

  /**
   * Crée une case de la table (rectangle + texte) et retourne le rectangle interactif.
   * @param {number} x position X
   * @param {number} y position Y
   * @param {number} w largeur
   * @param {number} h hauteur
   * @param {string} label texte à afficher (numéro)
   * @param {number} bgColor couleur de fond
   * @returns {Phaser.GameObjects.Rectangle} rectangle cliquable
   */
  _gridCell(x,y,w,h,label,bgColor){
    const c = this.add.container(x + w/2, y + h/2).setSize(w,h);
    const r = this.add.rectangle(0,0,w,h,bgColor).setStrokeStyle(1,0x6fb1ff).setInteractive({useHandCursor:true});
    const t = this.add.text(0,0,label,{fontFamily:'monospace',fontSize:14,color:'#e6f1ff'}).setOrigin(0.5);
    c.add([r,t]);
    r.on('pointerdown',()=> c.setScale(0.98));
    r.on('pointerup',()=> c.setScale(1));
    return r;
  }

  /**
   * Mémorise les coordonnées et dimensions d'une case de la table pour pouvoir y placer des jetons.
   * @param {number} n numéro de la case (0..36)
   * @param {number} x position X d'origine
   * @param {number} y position Y d'origine
   * @param {number} w largeur
   * @param {number} h hauteur
   */
  _registerCell(n, x, y, w, h){
    this.numCells[n] = { cx: x + w/2, cy: y + h/2, w, h };
  }

  /**
   * Ajoute un jeton visuel sur une case donnée en l'empilant avec les précédents.
   * @param {number} n numéro de case ciblée
   */
  _addChipOnNumber(n){
    const cell = this.numCells[n]; if (!cell) return;
    if (!this.chipsByNumber.has(n)) this.chipsByNumber.set(n, []);
    const stack = this.chipsByNumber.get(n);

    const key = (stack.length % 2 === 0) ? 'GreenChipsBtn' : 'RedChipsBtnchip';
    const chip = this.add.image(cell.cx, cell.cy, key);
    this.chipsLayer.add(chip);

    // Mise à l'échelle automatique pour que le jeton tienne dans la case
    const target = Math.min(cell.w, cell.h) * 0.78;
    const base = Math.max(chip.width || 64, chip.height || 64);
    chip.setScale(target / base);

    // Décalage léger pour simuler une pile de jetons
    const off = Math.min(cell.w, cell.h) * 0.14;
    const col = stack.length % 3;
    const row = Math.floor(stack.length / 3);
    chip.x += (col - 1) * off;
    chip.y -= row * (off * 0.9);

    // Petite animation d'apparition
    chip.setAlpha(0).setScale(chip.scale * 0.8);
    this.tweens.add({ targets: chip, alpha:1, scale: chip.scale/0.8, duration:120, ease:'Cubic.Out' });

    stack.push(chip);
  }

  /**
   * Supprime tous les jetons visuels de la table.
   */
  _clearChips(){
    for (const [,list] of this.chipsByNumber){ list.forEach(s=> s.destroy()); }
    this.chipsByNumber.clear();
  }

  /**
   * Reconstruit l'affichage des jetons à partir de la liste des mises locales.
   */
  _rebuildChipsFromLocalBets(){
    this._clearChips();
    for (const b of this.localBets){
      if (b.type === 'STRAIGHT' && b.param != null){
        const count = Math.max(1, Number(b.amount) | 0);
        for (let i=0;i<count;i++) this._addChipOnNumber(b.param);
      }
    }
  }

  /**
   * Récupère l'état de jeu auprès du backend :
   * - solde,
   * - liste de mises en cours,
   * - dernier tirage.
   */
  async _getState(){
    try{
      const s = await api('api/roulette/state', { method:'GET' });
      if (typeof s.balance !== 'undefined'){
        this._setBalance(s.balance);
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
      // Si le serveur n'est pas joignable, on part sur un solde fictif local
      this._setBalance(1000);
    }
  }

    /**
     * Ajoute une mise (plein, dozen, colonne, etc.) côté client et côté serveur.
     * Gère aussi le débit du solde local + SFX.
     */
    async _addBet({ type, amount, param }){
      // Mises interdites quand le timer <= 10s
      if (this.bettingOpen === false){
        this._toast('Mises closes pour ce tour');
        return;
      }

      const body  = { type, amount:Number(amount) };
      const stake = Number(amount);

      if (!this._canStake(stake)) {
        this._toast("Solde insuffisant");
        return;
      }

      // Débit local + son de mise
      this._applyDebit(stake);
      this._playSfx('place');

      if (param!=null) body.param = param;
      try{
        const r = await api('api/roulette/bets', { method:'POST', body });
        if (r.balance != null) this._setBalance(r.balance);
        if (Array.isArray(r.bets)){
          this.localBets = r.bets.map(b=>({ type:b.type, amount:b.amount, param:b.param ?? null }));
        } else {
          this.localBets.push({ type, amount:Number(amount), param: param ?? null });
        }
        this._renderBets();
        if (type==='STRAIGHT' && param!=null) this._addChipOnNumber(param);
      }catch(e){
        // Si la requête échoue, on garde au moins la logique locale des mises
        this.localBets.push({ type, amount:Number(amount), param: param ?? null });
        this._renderBets();
        if (type==='STRAIGHT' && param!=null) this._addChipOnNumber(param);
        throw e;
      }
    }


  /**
   * Efface toutes les mises courantes.
   * Si des mises étaient engagées, on crédite le solde local du montant total remboursé.
   */
  async _clearBets(){
    // On calcule d'abord ce qu'il faut rendre au joueur
    const refund = this._currentStake();

    try {
      await api('api/roulette/bets', { method:'DELETE' });
    } catch (e) {
      // En cas d'erreur côté serveur, on continue quand même à nettoyer la vue
    } finally {
      if (refund > 0) this._applyCredit(refund);
      this.localBets = [];
      this._renderBets();
      this._clearChips();
      this._setSpinEnabled(false);
    }
  }

    /**
     * Lance un tour de roulette synchronisé :
     * - appelle l’API qui renvoie le numéro gagnant,
     * - joue le son de spin,
     * - anime la roue (8s) jusqu'au bon numéro,
     * - met à jour solde, mises, dernier tirage,
     * - relance un nouveau timer de 30s.
     */
    async _doSpin(){
      if (this._spinning) return;
      this._spinning = true;
      this.bettingOpen = false;          // on ferme les mises pendant le spin
      this._setStatus('Spinning...');
      this._switchTimerPhase('none');    // on coupe les tic-tac
      this._playSfx('spin');             // son de 8s

      try {
        // 1) Appel backend
        const r = await api('api/roulette/spin', { method:'POST' });

        const resultNumber = (r.result && typeof r.result.number !== 'undefined')
          ? Number(r.result.number)
          : Phaser.Math.Between(0,36);

        // 2) Animation de la roue jusqu'au bon numéro (8s)
        await this._spinWheelToNumber(resultNumber);

        // 3) MAJ affichage (dernier tirage, solde, mises...)
        if (r.result){
          const { number, color } = r.result;
          this.lastTxt.setText(`Dernier: ${number} (${String(color).toUpperCase()})`);
        }

        if (r.balance != null){
          this._setBalance(r.balance);
          this.game.events.emit('credits:update', r.balance);
        }

        this.localBets = [];
        this._renderBets();
        this._clearChips();

        if (r.gain && Number(r.gain) > 0){
          this._playSfx('win');
          this._flashWin();
          this._setStatus(`WIN +${this._euro(r.gain)}`);
        } else {
          this._setStatus('No win');
        }

      } catch(e){
        // Fallback offline : on garde la synchro roue ↔ numéro
        const n = Phaser.Math.Between(0,36);
        await this._spinWheelToNumber(n);

        const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
        const color = (n===0) ? 'GREEN' : (reds.has(n)?'RED':'BLACK');
        this.lastTxt.setText(`Dernier: ${n} (${color})`);

        this.localBets = [];
        this._renderBets();
        this._clearChips();
        this._setStatus('No win (offline)');
      }

      // Nouveau round : on réarme le timer 30s et on rouvre les mises
      this.roundTimeLeft = this.roundDuration || 30;
      this.bettingOpen   = true;
      this._updateTimerText();
      this._switchTimerPhase('slow'); // on repart sur tic-tac lent
      this._setSpinEnabled(false);    // plus de mises -> spin désactivé jusqu'à nouvelle mise

      this._spinning = false;
    }




  /**
   * Ajoute une mise pleine (numéro unique).
   * @param {number} n numéro misé
   */
  async _placeStraight(n){
    try{
      await this._addBet({ type:'STRAIGHT', amount:this.betUnit, param:n });
      this._toast(`Plein ${n} +${this.betUnit}`);
    }catch(e){ this._toast('Mise enregistrée (offline)'); }
  }

  /**
   * Ajoute une mise paramétrée (douzaine, colonne, etc.).
   * @param {string} type type de mise (DOZEN, COLUMN, ...)
   * @param {number} param paramètre de la mise (numéro de colonne, numéro de douzaine, etc.)
   */
  async _placeParamBet(type, param){
    try{
      await this._addBet({ type, amount:this.betUnit, param });
      this._toast(`${type} ${param} +${this.betUnit}`);
    }catch(e){ this._toast('Mise enregistrée (offline)'); }
  }

  /**
   * Met à jour le texte du panneau de récapitulatif des mises.
   * Affiche chaque mise et le total engagé.
   */
  _renderBets(){
    if(this.localBets.length===0){ this.betsTxt.setText('Aucune mise.'); return; }
    let total = 0;
    const lines = this.localBets.map(b=>{
      total += Number(b.amount);
      return `• ${b.type}${b.param!=null?' '+b.param:''} : ${this._euro(b.amount)}`;
    });
    lines.push(`\nTotal engagé : ${this._euro(total)}`);
    this.betsTxt.setText(lines.join('\n'));

    // Spin possible uniquement s'il y a des mises ET que les mises sont ouvertes
    this._setSpinEnabled(this.localBets.length > 0 && this.bettingOpen !== false);
  }

  /**
   * Affiche un flash vert transparent sur tout l'écran pour signaler un gain.
   */
  _flashWin(){
    const W = this.scale.width, H = this.scale.height;
    const r = this.add.rectangle(W/2, H/2, W, H, 0x00ff88, 0.12).setDepth(999);
    this.tweens.add({ targets:r, alpha:0, duration:420, onComplete:()=>r.destroy() });
  }


  /**
   * Lecture sécurisée d'un SFX (on stop si déjà en cours pour éviter les overlaps moches).
   */
  _playSfx(key){
    if (!this.sfx || !this.sfx[key]) return;
    const snd = this.sfx[key];
    if (snd.isPlaying) snd.stop();
    snd.play();
  }

  /**
   * Change la phase du timer (slow / fast / locked / none) et gère les tic-tac.
   */
  _switchTimerPhase(phase){
    if (!this.sfx) return;
    if (this.timerPhase === phase) return;

    // On coupe les loops existants si on quitte slow/fast
    if (this.timerPhase === 'slow' && this.sfx.slow && this.sfx.slow.isPlaying){
      this.sfx.slow.stop();
    }
    if (this.timerPhase === 'fast' && this.sfx.fast && this.sfx.fast.isPlaying){
      this.sfx.fast.stop();
    }

    this.timerPhase = phase;

    if (phase === 'slow' && this.sfx.slow){
      this.sfx.slow.play();
    } else if (phase === 'fast' && this.sfx.fast){
      this.sfx.fast.play();
    }
    // 'locked' et 'none' -> juste silence
  }

  /**
   * MAJ du texte du timer.
   */
  _updateTimerText(){
    if (!this.timerTxt) return;
    const t = Math.max(0, Math.round(this.roundTimeLeft || 0));
    this.timerTxt.setText(`Temps: ${t}s`);
  }

  /**
   * Tick du timer de manche (appelé toutes les secondes).
   * 30->20 : tic tac lent, 20->10 : tic tac rapide, 10 : son de timeout + lock,
   * 0 : spin auto.
   */
  _onTimerTick(){
    if (this._spinning) return;
    if (typeof this.roundTimeLeft !== 'number') return;

    if (this.roundTimeLeft > 0){
      this.roundTimeLeft--;
      this._updateTimerText();

      if (this.roundTimeLeft === 20){
        this._switchTimerPhase('fast');  // 20->10 : tic-tac rapide
      }
      else if (this.roundTimeLeft === 10){
        this._switchTimerPhase('locked'); // plus de tic-tac
        this.bettingOpen = false;         // plus possible de bet < 10s
        this._playSfx('timeout');         // son de timeout
        this._toast('Mises closes');
        this._setSpinEnabled(this.localBets.length > 0 && this.bettingOpen !== false);
      }
      else if (this.roundTimeLeft === 0){
        this._switchTimerPhase('none');
        this._autoSpinFromTimer();
      }
    }
  }

  /**
   * Lance un spin automatiquement quand le timer atteint 0.
   */
  _autoSpinFromTimer(){
    // On spin même si pas de mises, comme un vrai casino en continu
    this._doSpin();
  }

  /**
   * Active / désactive visuellement et fonctionnellement le bouton Spin.
   */
  _setSpinEnabled(enabled){
    this.canSpinManually = !!enabled;
    if (this.spinBtn){
      if (enabled){
        this.spinBtn.setAlpha(1).setInteractive({ useHandCursor:true });
      } else {
        this.spinBtn.setAlpha(0.4);
        this.spinBtn.disableInteractive();
      }
    }
  }



}