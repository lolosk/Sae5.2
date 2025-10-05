import { addSoundToggle } from '../utils/soundToggle.js';
import { playSfx } from '../utils/sfx.js';
import { api } from '../utils/api.js';

// src/scenes/Menu.js
export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  preload() {
    this.load.image('background', 'assets/menu/bg.png');
    this.load.image('logo', 'assets/menu/logo.png');

    // Slot
    this.load.image('btn_slot',        'assets/menu/btn_slot.png');
    this.load.image('btn_slot_hover',  'assets/menu/btn_slot_hover.png');

    // Roulette
    this.load.image('btn_roulette',        'assets/menu/btn_roulette.png');
    this.load.image('btn_roulette_hover',  'assets/menu/btn_roulette_hover.png');

    // Black Jack
    this.load.image('btn_blackjack',        'assets/menu/btn_blackjack.png');
    this.load.image('btn_blackjack_hover',  'assets/menu/btn_blackjack_hover.png');

    // (optionnel) générique pour d’autres jeux
    // this.load.image('btn_generic',        'assets/menu/btn_generic.png');
    // this.load.image('btn_generic_hover',  'assets/menu/btn_generic_hover.png');
  }

  create() {
    const { width, height } = this.scale.gameSize;

    //Bouton son
    addSoundToggle(this);

    // Guard: obligé d’être connecté
    const user0 = this.registry.get('user');
    if (!user0) { this.scene.start('Login'); return; }

    // --- HUD utilisateur (haut-droite), plus compact
    const HUD_RIGHT_PAD = 12;
    const HUD_TOP       = 14;
    const HUD_FONT      = 16;
    const HUD_GAP       = 18;

    const style = { fontFamily:'system-ui, Arial', fontSize: `${HUD_FONT}px`, color:'#eaf4ff' };

    this.userText = this.add.text(this.scale.gameSize.width - HUD_RIGHT_PAD, HUD_TOP,
      `👤 ${user0.username}`, style).setOrigin(1, 0).setDepth(999);

    this.creditsText = this.add.text(this.scale.gameSize.width - HUD_RIGHT_PAD, HUD_TOP + HUD_GAP,
      `💰 ${user0.credits ?? 0} crédits`, style).setOrigin(1, 0).setDepth(999);

    // Recalage si la fenêtre est redimensionnée
    this.scale.on('resize', ({ width }) => {
      this.userText.setPosition(width - HUD_RIGHT_PAD, HUD_TOP);
      this.creditsText.setPosition(width - HUD_RIGHT_PAD, HUD_TOP + HUD_GAP);
    });






    // --- Fond
    this.background = this.add
      .tileSprite(width/2, height/2, 1280, 720, 'background')
      .setOrigin(0.5);

    // --- Logo
    const logo = this.add.image(width/2, height * 0.22, 'logo').setOrigin(0.5);
    const maxW = width * 0.60, maxH = height * 0.32;
    const s = Math.min(maxW / logo.width, maxH / logo.height);
    logo.setScale(s);
    this.tweens.add({
      targets: logo,
      scaleX: s*1.025, scaleY: s*1.025,
      duration: 1400, ease: 'Sine.inOut', yoyo: true, loop: -1
    });

    // --- Paramètres boutons
    const btnMaxW   = Math.min(width * 0.42, 640);
    const BTN_SCALE = 0.60;                     // réduction uniforme
    const firstY    = height * 0.68;            // centre vertical de la grille
    const vGap      = Math.max(10, Math.min(width, height) * 0.020);  // espace vertical
    const hGap      = Math.max(16, Math.min(width, height) * 0.030);  // espace horizontal

    // Helper bouton image (normal + hover + SFX + onClick)
    const makeImgBtn = (keyBase, onClick) => {
      if (!this.textures.exists(keyBase)) return null;

      const img = this.add.image(0, 0, keyBase)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setDepth(10);

      const baseScale = (btnMaxW / img.width) * BTN_SCALE;
      img.setScale(baseScale);

      // petite anti-spam hover (optionnel)
      let lastHover = 0;
      const HOVER_COOLDOWN = 120; // ms

      img.on('pointerover', () => {
        if (this.textures.exists(keyBase + '_hover')) img.setTexture(keyBase + '_hover');
        this.input.setDefaultCursor('pointer');

        const now = this.time.now;
        if (now - lastHover > HOVER_COOLDOWN) {
          playSfx(this, 'ui_hover', { volume: 0.55 });
          lastHover = now;
        }
      });

      img.on('pointerout', () => {
        img.setTexture(keyBase);
        this.input.setDefaultCursor('default');
      });

      img.on('pointerdown', () => {
        img.y += 1; // press visuel léger
      });

      img.on('pointerup', () => {
        img.y -= 1;
        playSfx(this, 'ui_click', { volume: 0.65 });
        onClick?.();
      });

      img.on('pointerupoutside', () => {
        // si on sort du bouton pendant le clic, on “reset”
        img.y = img.y; // no-op si tu préfères; sinon mémorise la position initiale
        img.setTexture(keyBase);
        this.input.setDefaultCursor('default');
      });

      return img;
    };


    // --- Crée la liste des boutons disponibles (dans l'ordre d'affichage)
    const buttons = [];
    const slotBtn = makeImgBtn('btn_slot', () => this.scene.start('Slot'));
    if (slotBtn) buttons.push(slotBtn);

    const rouletteBtn = makeImgBtn('btn_roulette', () => this.scene.start('Roulette'));
    if (rouletteBtn) buttons.push(rouletteBtn);

    const bjBtn = makeImgBtn('btn_blackjack', () => this.scene.start('BlackJack'));
    if (bjBtn) buttons.push(bjBtn);

    // (optionnel) 4e bouton générique si tu as déjà les assets
    const hasGeneric = this.textures.exists('btn_generic');
    if (hasGeneric) {
      const genBtn = makeImgBtn('btn_generic', () => {/* à définir plus tard */});
      if (genBtn) buttons.push(genBtn);
    }

    // --- Placement en grille 2 colonnes
    const cols = 2;
    const rows = Math.ceil(buttons.length / cols);

    // On estime une largeur/hauteur "cellule" à partir du premier bouton
    const ref = buttons[0];
    const cellW = ref ? ref.displayWidth  + hGap : 400;
    const cellH = ref ? ref.displayHeight + vGap : 160;

    // Centre la grille sur l'axe X
    const totalW = cols * cellW - hGap;           // largeur totale sans l'écart de fin
    const startX = (width / 2) - (totalW / 2) + (cellW - hGap) / 2;

    // Centre la grille verticalement autour de firstY (2 lignes)
    const totalH = Math.max(1, rows) * cellH - vGap;
    const startY = firstY - totalH / 2 + (cellH - vGap) / 2;

    // Positionne chaque bouton
    buttons.forEach((btn, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;

      let x;
      if (rows > 1 && row === rows - 1 && buttons.length % cols === 1 && col === 0) {
        // Cas "3 boutons" : dernière ligne centrée (un seul bouton)
        x = width / 2;
      } else {
        x = startX + col * cellW;
      }
      const y = startY + row * cellH;

      btn.setPosition(x, y);
    });

    // Rafraîchir depuis /api/me au démarrage + quand la scène se réveille
    this.refreshUser();
    this.events.on('wake', () => this.refreshUser());


    // (Option) touche Échap pour revenir au Start
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Start'));
  }

  update() {
    this.background.tilePositionX += 2;
  }

  async refreshUser() {
    try {
      const { user } = await api('api/me'); // { username, credits }
      this.registry.set('user', user);
      this.userText.setText(`👤 ${user.username}`);
      this.creditsText.setText(`💰 ${user.credits} crédits`);
    } catch {
      // session expirée → retour Login
      this.registry.set('user', null);
      this.scene.start('Login');
    }
  }

}
