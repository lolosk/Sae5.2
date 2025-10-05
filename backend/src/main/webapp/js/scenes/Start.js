import { addSoundToggle } from '../utils/soundToggle.js';
import { playSfx } from '../utils/sfx.js';

export class Start extends Phaser.Scene {
  constructor() {
    super('Start');
  }

  preload() {
    this.load.image('background', 'assets/menu/bg.png');
    this.load.image('logo', 'assets/menu/logo.png');

    // Login
    this.load.image('btn_login',       'assets/menu/btn_login.png');        // <-- corrigé
    this.load.image('btn_login_hover', 'assets/menu/btn_login_hover.png');

    // Register
    this.load.image('btn_register',       'assets/menu/btn_register.png');
    this.load.image('btn_register_hover', 'assets/menu/btn_register_hover.png');
  }

  create() {
    const { width, height } = this.scale.gameSize;

    //Bouton son
    addSoundToggle(this);

    // --- Fond
    this.background = this.add
      .tileSprite(width / 2, height / 2, 1280, 720, 'background')
      .setOrigin(0.5);

    // --- Logo
    const logo = this.add.image(width / 2, height * 0.28, 'logo').setOrigin(0.5);
    const maxW = width * 0.60, maxH = height * 0.40;
    const s = Math.min(maxW / logo.width, maxH / logo.height);
    logo.setScale(s);

    this.tweens.add({
      targets: logo,
      scaleX: s * 1.025,
      scaleY: s * 1.025,
      duration: 1400,
      ease: 'Sine.inOut',
      yoyo: true,
      loop: -1
    });

    // --- Boutons image (normal + hover, callback au clic)
    const btnMaxW = Math.min(width * 0.3, 640);
    const firstY  = height * 0.56;
    const gap     = Math.max(8, Math.min(width, height) * 0.07);

    // <— helper : onClick est une fonction ; pas de pointerup par défaut
    const makeImgBtn = (keyBase, x, y, onClick) => {
    const img = this.add.image(x, y, keyBase)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setDepth(10);

    const scale = btnMaxW / img.width;
    img.setScale(scale);

    img.on('pointerover', () => {
        if (this.textures.exists(keyBase + '_hover')) img.setTexture(keyBase + '_hover');
        this.input.setDefaultCursor('pointer');
        playSfx(this, 'ui_hover', { volume: 0.55 });
    });
    img.on('pointerout', () => {
        img.setTexture(keyBase);
        this.input.setDefaultCursor('default');
    });
    img.on('pointerup', () => {
      // son de clic
      playSfx(this, 'ui_click', { volume: 0.65 });

      // action du bouton
      if (typeof onClick === 'function') onClick();
    });


    return img;
    };

    // LOGIN → page HTML
    const loginBtn = makeImgBtn('btn_login', width / 2, firstY, () => {
    this.scene.start('Login');
    });

    // REGISTER → scène Phaser
    makeImgBtn('btn_register', width / 2, firstY + loginBtn.displayHeight + gap, () => {
    this.scene.start('Register');
    });


  }

  update() {
    this.background.tilePositionX += 2;
  }
}
