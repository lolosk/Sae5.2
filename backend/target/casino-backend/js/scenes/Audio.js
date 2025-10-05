// src/scenes/Audio.js
export class Audio extends Phaser.Scene {
  constructor() { super({ key: 'Audio', active: true }); } // active dès le boot

  preload() {
    this.load.audio('bgm', ['assets/sounds/background.mp3']);

    //Bouton son
    this.load.image('icon_sound_on',  'assets/ui/icon_sound_on.png');
    this.load.image('icon_sound_off', 'assets/ui/icon_sound_off.png');

  }

  create() {
    // état global
    const muted = this.registry.get('audioMuted') ?? false;
    this.registry.set('audioMuted', muted);

    // crée la musique une seule fois
    if (!this.registry.get('bgmReady')) {
      this.bgm = this.sound.add('bgm', { loop: true, volume: 0.15 });
      this.bgm.play();
      this.registry.set('bgmReady', true);
    } else {
      // si déjà créée par un hot-reload
      this.bgm = this.sound.get('bgm') || this.sound.add('bgm', { loop: true, volume: 0.35 });
      if (!this.bgm.isPlaying) this.bgm.play();
    }

    this.sound.mute = muted;

    // évènements globaux
    this.game.events.on('audio:toggle', () => {
      const m = !this.sound.mute;
      this.sound.mute = m;
      this.registry.set('audioMuted', m);
      this.game.events.emit('audio:state', m); // notifie les scènes pour MAJ de l'icône
    });

    // évite pause auto si tu alt-tab
    this.sound.pauseOnBlur = false;
  }
}
