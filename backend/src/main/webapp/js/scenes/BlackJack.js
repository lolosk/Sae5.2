import { addSoundToggle } from '../utils/soundToggle.js';
import { api } from '../utils/api.js';
import { playSfx } from '../utils/sfx.js';



export class BlackJack extends Phaser.Scene {
  constructor() {
    super('BlackJack');
  }

    // Bouton home (haut droite) + ESC/H => retour Menu
    _makeHomeButton(){
      const pad     = 14;   // marge au bord
      const targetW = 48;   // largeur visuelle (comme sur la Slot)
      const depth   = 1000; // au-dessus de tout

      // si déjà créé (wake/recreate), on le détruit proprement
      if (this.homeBtn && !this.homeBtn.destroyed) this.homeBtn.destroy();

      if (!this.textures.exists('home')) return; // sécurité

      const tex   = this.textures.get('home').getSourceImage();
      const scale = targetW / tex.width;

      this.homeBtn = this.add.image(this.scale.width - pad, pad, 'home')
        .setOrigin(1, 0)
        .setScale(scale)
        .setAlpha(0.95)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });

      // feedback visuel
      this.homeBtn
        .on('pointerover', () => this.homeBtn.setTint(0xa0e8ff))
        .on('pointerout',  () => this.homeBtn.clearTint())
        .on('pointerdown', () => {
          playSfx?.(this, 'ui_click_down', { volume: 0.5 });
          this.homeBtn.setTint(0x77d6ff);
        })
        .on('pointerup',   () => {
          playSfx?.(this, 'ui_click_up', { volume: 0.5 });
          this.scene.start('Menu');
        });

      // repositionner sur resize
      this.scale.on('resize', (gs)=>{
        this.homeBtn.setPosition(gs.width - pad, pad);
      }, this);

      // Raccourcis clavier ESC / H => Menu
      this.input.keyboard.addCapture([
        Phaser.Input.Keyboard.KeyCodes.ESC,
        Phaser.Input.Keyboard.KeyCodes.H
      ]);

      this._goMenu?.off?.(); // no-op si pas défini
      this._goMenu = () => this.scene.start('Menu');

      this.input.keyboard.off('keydown-ESC', this._goMenu, this);
      this.input.keyboard.off('keydown-H',   this._goMenu, this);
      this.input.keyboard.on('keydown-ESC', this._goMenu, this);
      this.input.keyboard.on('keydown-H',   this._goMenu, this);

      // clean à la destruction de la scène
      this.events.once('shutdown', ()=>{
        this.input.keyboard.off('keydown-ESC', this._goMenu, this);
        this.input.keyboard.off('keydown-H',   this._goMenu, this);
      });
    }

    /**
     * Recharge le user et les crédits via /api/me
     * pour être bien synchro après avoir joué à la Slot ou Roulette.
     */
    async _reloadUserFromMe(){
      try {
        const me = await api('api/me', { method: 'GET' });
        if (me && me.user) {
          const user = me.user;
          this.registry.set('user', user);
          if (this.creditsText) {
            this.creditsText.setText(`Crédits : ${user.credits ?? 0}`);
          }
        }
      } catch (e) {
        // si la session a sauté entre temps
        if (e.status === 401) {
          this.scene.start('Login');
        }
      }
    }



  preload() {
    // Fond blackjack
    this.load.image('bg_blackjack', 'assets/blackjack/bg_blackjack.png');

    //home bouton
    this.load.image('home', 'assets/blackjack/home.png');

    // Cartes :
    const ranksServer = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['C', 'D', 'H', 'S']; // trèfle, carreau, coeur, pique

    for (const r of ranksServer) {
      for (const s of suits) {
        const key = `${r}${s}`;
        const fileRank = (r === '10') ? 'T' : r;
        const fileName = `${fileRank}${s}`;
        this.load.image(key, `assets/blackjack/${fileName}.png`);
      }
    }

    // dos de carte
    this.load.image('BACK', 'assets/blackjack/BACK.png');

    // JETONS
    this.load.image('chip5',   'assets/blackjack/chip5.png');
    this.load.image('chip10',  'assets/blackjack/chip10.png');
    this.load.image('chip25',  'assets/blackjack/chip25.png');
    this.load.image('chip100', 'assets/blackjack/chip100.png');

    // JETONS HOVER
    this.load.image('chip5_hover',   'assets/blackjack/chip5_hover.png');
    this.load.image('chip10_hover',  'assets/blackjack/chip10_hover.png');
    this.load.image('chip25_hover',  'assets/blackjack/chip25_hover.png');
    this.load.image('chip100_hover', 'assets/blackjack/chip100_hover.png');
        // ... ton code existant (bg, cartes, chips, etc.)

        // SONS
    this.load.audio('flipcard',  'assets/blackjack/sfx/flipcard.mp3');
    this.load.audio('win_small_bj', 'assets/blackjack/sfx/win_small_bj.mp3');
    this.load.audio('blackjack','assets/blackjack/sfx/blackjack.mp3');
    this.load.audio('lose','assets/blackjack/sfx/lose.mp3');

  }

  create() {
    const { width, height } = this.scale.gameSize;
    const u0 = this.registry.get('user');
    if (!u0) return this.scene.start('Login');

    // On resynchronise les crédits avec le back (utile après avoir joué à la Slot)
    this._reloadUserFromMe();


    addSoundToggle(this);

    // --- BACKGROUND ---
    this.background = this.add.image(width / 2, height / 2, 'bg_blackjack')
      .setOrigin(0.5);
    this.background.displayWidth = width;
    this.background.displayHeight = height;

    // Bouton Home
    this._makeHomeButton();


    // --- POSITIONS DES MAINS ---
    const dealerY = height * 0.25;
    const playerY = height * 0.55;

    // --- GROUPES DE CARTES ---
    this.dGroup = this.add.container(width / 2, dealerY); // croupier
    this.pGroup = this.add.container(width / 2, playerY); // joueur

    this.cardScale = Math.min(0.35, width / 1500);
    this.cardGap = 65 * this.cardScale;

    this.deckX = width * 0.22;
    this.deckY = dealerY;

    // container pour le sabot + la pile
    this.deckContainer = this.add.container(this.deckX, this.deckY);

    // taille approximative d'une carte pour le sabot
    const cardW = 140 * this.cardScale;
    const cardH = 200 * this.cardScale;

    // sabot (support noir/gris sous la pile)
    const shoe = this.add.rectangle(-cardW * 0.1, cardH * 0.05, cardW * 1.2, cardH * 1.1, 0x000000, 0.25)
      .setOrigin(0.5)
      .setAngle(-6);
    this.deckContainer.add(shoe);

    // pile de dos de cartes, bien décalés
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const back = this.add.image(-i * 3, -i * 2, 'BACK')
        .setOrigin(0.5)
        .setScale(this.cardScale * 0.98)
      this.deckContainer.add(back);
    }


    // VALEURS DES MAINS → à droite, au niveau du bas des cartes
    const valueOffsetX = 120;
    const valueOffsetY = height * 0.06;

    this.dValueText = this.add.text(width / 2 + valueOffsetX, dealerY + valueOffsetY, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0, 0.5);

    this.pValueText = this.add.text(width / 2 + valueOffsetX, playerY + valueOffsetY, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0, 0.5);

    // --- FONCTION D'AFFICHAGE DES CARTES ---
    const renderHand = (codes, group) => {
      group.removeAll(true);
      if (!codes || !codes.length) return;

      const totalW = (codes.length - 1) * this.cardGap;
      let x = -totalW / 2;

      for (const code of codes) {
        const key = (code === '??') ? 'BACK' : code;
        const img = this.add.image(x, 0, key)
          .setOrigin(0.5)
          .setScale(this.cardScale);
        group.add(img);
        x += this.cardGap;
      }
    };

    // --- CALCUL LOCAL DE LA VALEUR D'UNE MAIN ---
    const handValue = (cards) => {
      if (!cards) return 0;
      let total = 0;
      let aces = 0;

      for (const c of cards) {
        if (c === '??') continue; // ignore la carte cachée
        const r = c.substring(0, c.length - 1); // "A","2","10","J"...

        if (r === 'A') {
          aces++;
          total += 11;
        } else if (r === 'K' || r === 'Q' || r === 'J') {
          total += 10;
        } else if (r === '10') {
          total += 10;
        } else {
          total += parseInt(r, 10);
        }
      }

      while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
      }
      return total;
    };

    // --- HUD TEXTE ---
    this.add.text(width / 2, height * 0.05, 'BlackJack', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.bet = 10;

    this.betText = this.add.text(width * 0.34, height * 0.88, `Mise : ${this.bet}`, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.creditsText = this.add.text(width * 0.78, height * 0.88, `Crédits : ${u0.credits ?? 0}`, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.statusText = this.add.text(width / 2, height * 0.70, 'Clique sur Start pour jouer', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.errorText = this.add.text(width / 2, height * 0.94, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ff8080'
    }).setOrigin(0.5);

    // --- BOUTONS RECTANGLES (Start / Hit / Stand / Double) ---
    const makeButtonRect = (x, y, w, h, label, onClick) => {
      const container = this.add.container(x, y);
      const rect = this.add.rectangle(0, 0, w, h, 0x0066cc, 0.9)
        .setStrokeStyle(2, 0xffffff)
        .setOrigin(0.5);
      const txt = this.add.text(0, 0, label, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff'
      }).setOrigin(0.5);

      container.add([rect, txt]);
      container.setSize(w, h);
      container.onClick = onClick;
      return container;
    };

    const setButtonEnabled = (btn, enabled) => {
      const rect = btn.list[0];
      rect.setFillStyle(enabled ? 0x0066cc : 0x555555, 0.9);
      if (enabled) {
        btn.setInteractive({ useHandCursor: true })
          .off('pointerup')
          .on('pointerup', btn.onClick);
      } else {
        btn.disableInteractive();
      }
    };

    // --- LOGIQUE DOUBLAGE ---
    const canDouble = (state) =>
      state &&
      state.status === 'playing' &&
      Array.isArray(state.player) &&
      state.player.length === 2;

    // --- FX BLACKJACK ---
    this.blackjackEffectDone = false;
    this.blackjackText = null;
    this.blackjackFlash = null;

    const resetBlackjackFx = () => {
      this.blackjackEffectDone = false;
      if (this.blackjackText) {
        this.blackjackText.destroy();
        this.blackjackText = null;
      }
      if (this.blackjackFlash) {
        this.blackjackFlash.destroy();
        this.blackjackFlash = null;
      }
      this.tweens.killTweensOf(this.pGroup);
      this.pGroup.setScale(1);
    };

    const triggerBlackjackFx = () => {
      if (this.blackjackEffectDone) return;
      this.blackjackEffectDone = true;

      // flash écran
      this.blackjackFlash = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0.6)
        .setDepth(20);
      this.tweens.add({
        targets: this.blackjackFlash,
        alpha: 0,
        duration: 250,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (this.blackjackFlash) {
            this.blackjackFlash.destroy();
            this.blackjackFlash = null;
          }
        }
      });

      // texte BLACKJACK !
      this.blackjackText = this.add.text(width / 2, playerY - height * 0.08, 'BLACKJACK !', {
        fontFamily: 'Arial',
        fontSize: '46px',
        color: '#ffd94c',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5)
        .setScale(0.1)
        .setDepth(21);

      this.tweens.add({
        targets: this.blackjackText,
        scale: 1.1,
        duration: 450,
        ease: 'Back.Out',
        yoyo: true
      });

      // main du joueur qui "pulse"
      this.tweens.add({
        targets: this.pGroup,
        scale: 1.1,
        duration: 200,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: 2
      });

      playSfx(this, 'blackjack', { volume: 1 });
    };

    // --- TRACKING POUR L'ANIMATION ---
    this.lastPlayer = [];
    this.lastDealer = [];
    this.animating = false;

    // --- BOUTONS (références pour showState) ---
    let startBtn, hitBtn, standBtn, doubleBtn;

    // --- MAJ DES VALEURS ET DU STATUT (gère payout & blackjack) ---
    const updateValuesAndStatus = (state, playerCards, dealerCards, payout) => {
      const pVal = handValue(playerCards);
      this.pValueText.setText(pVal ? String(pVal) : '');

      const dVal = handValue(dealerCards);
      this.dValueText.setText(dVal ? String(dVal) : '');

      // blackjack gagnant (21 en 2 cartes et victoire)
      const isBlackjackWin =
        state.status !== 'playing' &&
        Array.isArray(playerCards) &&
        playerCards.length === 2 &&
        handValue(playerCards) === 21 &&
        (state.status === 'player_win' || state.status === 'dealer_bust');

      if (state.status === 'playing') {
        this.statusText.setColor('#ffffff');
        this.statusText.setText('À toi de jouer…');
      } else {
        const win  = state.status === 'player_win' || state.status === 'dealer_bust';
        const push = state.status === 'push';

        this.statusText.setColor(win ? '#4cff7a' : push ? '#ffd24c' : '#ff7070');

        let suffix = '';
        if (typeof payout === 'number' && payout !== 0) {
          const sign = payout > 0 ? '+' : '';
          suffix = ` (${sign}${payout})`;
        }
        this.statusText.setText(`Résultat : ${state.status}${suffix}`);

        // Sons de fin de manche : une seule fois, uniquement quand
        // le payout est connu (=> manche terminée) et que ce n'est PAS un blackjack
        if (
          !this.roundResultSoundPlayed &&    // pas déjà joué
          !push &&                           // pas d'égalité
          typeof payout === 'number' &&      // on est sur le dernier showState
          !isBlackjackWin                    // les blackjack ont leur FX dédié
        ) {
          this.roundResultSoundPlayed = true;

          this.time.delayedCall(350, () => { // 0.35s après l'affichage du résultat
            if (win) {
              playSfx(this, 'win_small_bj', { volume: 0.7 });
            } else {
              playSfx(this, 'lose', { volume: 0.7 });
            }
          }, null, this);
        }
      }

      // Effet spécial blackjack (flash + texte + SON blackjack dans triggerBlackjackFx)
      if (isBlackjackWin) {
        triggerBlackjackFx();
      }

      if (doubleBtn) {
        setButtonEnabled(doubleBtn, this._playing && canDouble(state));
      }
    };





    // --- FONCTION showState AVEC ANIMATION DEPUIS LE DECK ---
    const showState = (state, payout) => {
      const newP = state.player || [];
      const newD = state.dealer || [];
      const prevP = this.lastPlayer || [];
      const prevD = this.lastDealer || [];

      // On cherche où il y a UNE nouvelle carte (joueur ou croupier)
      let target = null;

      if (newP.length > prevP.length) {
        target = { who: 'player', newCard: newP[newP.length - 1] };
      } else if (newD.length > prevD.length) {
        target = { who: 'dealer', newCard: newD[newD.length - 1] };
      }

      // Cas où aucune nouvelle carte (juste statut / reveal déjà géré) :
      if (!target) {
        renderHand(newP, this.pGroup);
        renderHand(newD, this.dGroup);
        updateValuesAndStatus(state, newP, newD, payout);
        this.lastPlayer = newP.slice();
        this.lastDealer = newD.slice();
        return;
      }

      // Il y a une nouvelle carte -> anim depuis le deck + flip
      this.animating = true;

      // On affiche la main SANS la nouvelle carte (suspense)
      const tmpPlayer = (target.who === 'player') ? newP.slice(0, -1) : newP.slice();
      const tmpDealer = (target.who === 'dealer') ? newD.slice(0, -1) : newD.slice();

      // Pendant l'anim, pas de payout final affiché
      updateValuesAndStatus(state, tmpPlayer, tmpDealer, undefined);
      renderHand(tmpPlayer, this.pGroup);
      renderHand(tmpDealer, this.dGroup);

      // Position finale de la nouvelle carte (dans le groupe)
      const group = (target.who === 'player') ? this.pGroup : this.dGroup;
      const finalHand = (target.who === 'player') ? newP : newD;
      const n = finalHand.length;
      const totalW = (n - 1) * this.cardGap;
      const finalLocalX = -totalW / 2 + (n - 1) * this.cardGap;
      const finalWorldX = group.x + finalLocalX;
      const finalWorldY = group.y;

      // Carte volante : DOS vers le haut
      const flying = this.add.image(this.deckX, this.deckY - 10, 'BACK')
        .setScale(this.cardScale)
        .setDepth(10);

      // 1) Animation depuis le deck jusqu'à la position finale
      this.tweens.add({
        targets: flying,
        x: finalWorldX,
        y: finalWorldY,
        duration: 280,
        ease: 'Cubic.easeOut',
        onComplete: () => {
      // 2) Flip : on "ferme" la carte (scaleX -> 0)
      this.tweens.add({
        targets: flying,
        scaleX: 0,
        duration: 120,
        ease: 'Cubic.easeIn',
        onStart: () => {
          // son de flip
          playSfx(this, 'flipcard', { volume: 0.7 });
        },
        onComplete: () => {
          // On met la vraie carte (AS, 9H, etc.)
          flying.setTexture(target.newCard);


              // 3) Flip inverse : on "réouvre" la carte (scaleX -> normal)
              this.tweens.add({
                targets: flying,
                scaleX: this.cardScale,
                duration: 120,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                  // On détruit la carte volante et on dessine la main "propre"
                  flying.destroy();

                  renderHand(newP, this.pGroup);
                  renderHand(newD, this.dGroup);

                  // on applique le payout + blackjack éventuel
                  updateValuesAndStatus(state, newP, newD, payout);

                  // On mémorise l'état courant
                  this.lastPlayer = newP.slice();
                  this.lastDealer = newD.slice();

                  this.animating = false;
                }
              });
            }
          });
        }
      });
    };



    // --- JETONS POUR LA MISE (hover textures) ---

    const baseChipScale = 0.12;

    const makeChip = (x, y, textureKey, hoverKey, value) => {
      const img = this.add.image(x, y, textureKey)
        .setOrigin(0.5)
        .setScale(baseChipScale)
        .setInteractive({ useHandCursor: true });

      const baseY = y;

      // HOVER : zoom léger + montée
      img.on('pointerover', () => {
        img.setTexture(hoverKey);
        img.setScale(baseChipScale * 1.12);

        this.tweens.add({
          targets: img,
          y: baseY - 8,
          duration: 100,
          ease: 'Sine.easeOut'
        });
      });

      // SORTIE HOVER : retour normal
      img.on('pointerout', () => {
        img.setTexture(textureKey);
        img.setScale(baseChipScale);

        this.tweens.add({
          targets: img,
          y: baseY,
          duration: 100,
          ease: 'Sine.easeIn'
        });
      });

      // CLICK : change la mise + petit pulse propre
      img.on('pointerup', () => {
        if (this._playing) return; // pas pendant une main

        this.errorText.setText('');
        this.bet = value;
        this.betText.setText(`Mise : ${this.bet}`);
        playSfx?.(this, 'ui_click');

        // mini animation de "pulse" (scale) sans bouger la position
        this.tweens.add({
          targets: img,
          scale: baseChipScale * 1.18,
          duration: 80,
          ease: 'Sine.easeOut',
          yoyo: true,
          onComplete: () => {
            img.setScale(baseChipScale * 1.12); // on revient au scale de hover
          }
        });
      });

      return img;
    };




    // positions des jetons : carré sous le deck (espacés)
    const chipSpacingX = 145;
    const chipSpacingY = 125;

    const col1X = this.deckX - chipSpacingX / 2;
    const col2X = this.deckX + chipSpacingX / 2;

    const row1Y = this.deckY + 155;
    const row2Y = row1Y + chipSpacingY;

    makeChip(col1X, row1Y, 'chip5',    'chip5_hover',    5);
    makeChip(col2X, row1Y, 'chip10',   'chip10_hover',   10);
    makeChip(col1X, row2Y, 'chip25',   'chip25_hover',   25);
    makeChip(col2X, row2Y, 'chip100',  'chip100_hover',  100);

    // --- BOUTONS START / HIT / STAND / DOUBLE ---

    // --- BOUTON START ---
    startBtn = makeButtonRect(width * 0.26, height * 0.78, 90, 40, 'Start', async () => {
      if (this.animating) return;
      this.errorText.setText('');

      const bet = this.bet | 0;
      if (bet <= 0) {
        this.errorText.setText('Mise invalide');
        return;
      }

      // Check local : si crédits < bet, on évite d'appeler le serveur pour rien
      const regUser = this.registry.get('user') || {};
      const credits = Number(regUser.credits ?? 0);
      if (credits < bet) {
        this.errorText.setText('Crédits insuffisants.');
        return;
      }

      this.roundResultSoundPlayed = false;
      resetBlackjackFx();

      setButtonEnabled(startBtn, false);
      setButtonEnabled(hitBtn,   false);
      setButtonEnabled(standBtn, false);
      setButtonEnabled(doubleBtn,false);

      let res;
      // 1) On isole les VRAIES erreurs réseau / HTTP
      try {
        res = await api('api/blackjack/start', { method: 'POST', body: { bet } });
        console.log('BJ /start response', res);
      } catch (e) {
        console.error('BJ /start HTTP error', e);

        if (e.status === 409) {
          this.errorText.setText('Crédits insuffisants.');
        } else if (e.status === 401) {
          this.errorText.setText('Session expirée.');
          this.scene.start('Login');
          return;
        } else {
          const detail =
            (e.body && (e.body.detail || e.body.error)) ||
            e.message ||
            '';
          this.errorText.setText(detail ? `Erreur serveur : ${detail}` : 'Erreur serveur.');
        }

        this._playing = false;
        setButtonEnabled(startBtn, true);
        return; // on ne continue pas si le serveur a vraiment répondu en erreur
      }

      // 2) Tout ce qui est purement côté client est dans un autre try/catch
      try {
        this.lastPlayer = [];
        this.lastDealer = [];

        // sécurité : vérifier que le serveur renvoie bien un state
        if (!res.state || !Array.isArray(res.state.player) || !Array.isArray(res.state.dealer)) {
          const msg = res.error || res.detail || 'réponse invalide';
          this.errorText.setText(`Erreur serveur : ${msg}`);
          this._playing = false;
          setButtonEnabled(startBtn, true);
          return;
        }

        const status = res.state.status || 'playing';
        const payout = (typeof res.payout === 'number') ? res.payout : undefined;

        // affiche les cartes + éventuel payout (blackjack direct)
        showState(res.state, payout);

        // MAJ crédits affichés
        const newCredits = (typeof res.credits === 'number') ? res.credits : credits;
        this.creditsText.setText(`Crédits : ${newCredits}`);

        // MAJ HUD global (registry)
        const user = this.registry.get('user') || {};
        user.credits = newCredits;
        this.registry.set('user', user);
        this.game.events.emit('credits:update', newCredits);

        if (status === 'playing') {
          // partie normale : on laisse jouer
          this._playing = true;
          setButtonEnabled(startBtn, false);
          setButtonEnabled(hitBtn,   true);
          setButtonEnabled(standBtn, true);
          setButtonEnabled(doubleBtn, canDouble(res.state));
        } else {
          // blackjack instantané -> manche terminée
          this._playing = false;
          setButtonEnabled(startBtn,  true);
          setButtonEnabled(hitBtn,    false);
          setButtonEnabled(standBtn,  false);
          setButtonEnabled(doubleBtn, false);
        }
      } catch (err) {
        // ICI, ce sont les erreurs JS (showState, updateValues...) après une réponse 200
        console.error('BJ /start JS error', err);
        this.errorText.setText('Erreur client (voir console F12).');

        this._playing = false;
        setButtonEnabled(startBtn, true);
      }
    });


    hitBtn = makeButtonRect(width * 0.42, height * 0.78, 90, 40, 'Hit', async () => {
      if (this.animating) return;
      this.errorText.setText('');
      setButtonEnabled(hitBtn, false);
      setButtonEnabled(standBtn, false);
      setButtonEnabled(doubleBtn, false);
      try {
        const res = await api('api/blackjack/hit', { method: 'POST' });
        showState(res.state);
        if (res.state.status !== 'playing') {
          this._playing = false;
          setButtonEnabled(startBtn, true);
          playSfx && playSfx(this, 'ui_hover');
        } else {
          setButtonEnabled(hitBtn, true);
          setButtonEnabled(standBtn, true);
        }
      } catch (e) {
        this.errorText.setText(e.status === 401 ? 'Session expirée.' : 'Erreur serveur.');
        if (e.status === 401) this.scene.start('Login');
      }
    });

      standBtn = makeButtonRect(width * 0.58, height * 0.78, 90, 40, 'Stand', async () => {
      if (this.animating) return;
      this.errorText.setText('');
      setButtonEnabled(hitBtn, false);
      setButtonEnabled(standBtn, false);
      setButtonEnabled(doubleBtn, false);

      try {
        const res = await api('api/blackjack/stand', { method: 'POST' });

        const finalState = res.state;
        const payout = res.payout;
        const finalCredits = res.credits;

        // main du croupier AVANT stand (déjà connue sur le client)
        const prevDealer = this.lastDealer || [];
        // main complète du croupier APRÈS stand (renvoyée par le serveur)
        const allDealer = finalState.dealer || [];
        const extra = allDealer.length - prevDealer.length; // nb de nouvelles cartes

        const applyEndOfRound = () => {
          // MAJ crédits + HUD + boutons quand le croupier a fini de piocher
          this.creditsText.setText(`Crédits : ${finalCredits}`);

          this._playing = false;
          setButtonEnabled(startBtn, true);

          const user = this.registry.get('user') || {};
          user.credits = finalCredits;
          this.registry.set('user', user);
          this.game.events.emit('credits:update', finalCredits);

          playSfx && playSfx(this, 'ui_click');
        };

        // Si le croupier ne pioche pas ou ne pioche qu'une carte, on garde l'ancien comportement
        if (extra <= 1) {
          showState(finalState, payout);
          applyEndOfRound();
          return;
        }

        // Sinon : ANIMATION CARTE PAR CARTE
        const steps = [];
        for (let i = 1; i <= extra; i++) {
          // clone profond de l'état final
          const s = JSON.parse(JSON.stringify(finalState));

          // on ne garde que les premières cartes déjà connues + i nouvelles
          s.dealer = allDealer.slice(0, prevDealer.length + i);

          // tant qu'on n'a pas révélé la dernière carte,
          // on garde status="playing" pour ne pas afficher le résultat/payout
          if (i < extra) {
            s.status = 'playing';
          }

          steps.push(s);
        }

        let idx = 0;
        const playNext = () => {
          const s = steps[idx];
          const isLast = (idx === steps.length - 1);

          // on n'affiche le payout que sur la DERNIÈRE carte
          showState(s, isLast ? payout : undefined);

          idx++;
          if (idx < steps.length) {
            // délai entre chaque tirage du croupier (ajuste 600 si on veux plus/moins rapide)
            this.time.delayedCall(800, playNext, null, this);
          } else {
            // fin de sequence : on applique crédits + boutons
            applyEndOfRound();
          }
        };

        // on démarre l'animation
        playNext();

      } catch (e) {
        this.errorText.setText(e.status === 401 ? 'Session expirée.' : 'Erreur serveur.');
        if (e.status === 401) this.scene.start('Login');
      }
    });


        doubleBtn = makeButtonRect(width * 0.74, height * 0.78, 90, 40, 'Double', async () => {
          if (this.animating) return;
          this.errorText.setText('');
          setButtonEnabled(hitBtn, false);
          setButtonEnabled(standBtn, false);
          setButtonEnabled(doubleBtn, false);
          try {
            const res = await api('api/blackjack/double', { method: 'POST' });

            showState(res.state, res.payout);

            this.creditsText.setText(`Crédits : ${res.credits}`);

            this._playing = false;
            setButtonEnabled(startBtn, true);

            const user = this.registry.get('user') || {};
            user.credits = res.credits;
            this.registry.set('user', user);
            this.game.events.emit('credits:update', res.credits);

            playSfx && playSfx(this, 'ui_click');
          } catch (e) {
            if (e.status === 409) {
              this.errorText.setText('Crédits insuffisants pour doubler.');
            } else if (e.status === 400) {
              this.errorText.setText('Impossible de doubler maintenant.');
            } else if (e.status === 401) {
              this.errorText.setText('Session expirée.');
              this.scene.start('Login');
              return;
            } else {
              this.errorText.setText('Erreur serveur.');
            }
            if (this._playing) {
              setButtonEnabled(hitBtn, true);
              setButtonEnabled(standBtn, true);
            } else {
              setButtonEnabled(startBtn, true);
            }
          }
        });







     this._playing = false;
     setButtonEnabled(startBtn, true);
     setButtonEnabled(hitBtn, false);
     setButtonEnabled(standBtn, false);

     setButtonEnabled(doubleBtn, false);
  }
}