export class Boot extends Phaser.Scene {
  constructor(){ super('Boot'); }
  preload(){
    this.load.image('background', 'assets/menu/bg.png');
    this.load.image('logo',       'assets/menu/logo.png');
    this.load.image('icon_sound_on',  'assets/ui/icon_sound_on.png');
    this.load.image('icon_sound_off', 'assets/ui/icon_sound_off.png');
    this.load.audio('bgm', ['assets/sounds/background.mp3']);
    this.load.audio('ui_hover', ['assets/sounds/ui_hover.mp3']);
    this.load.audio('ui_click', ['assets/sounds/ui_click.mp3']);
  }
  create(){
    this.scene.launch('Audio');   // musique + état global
    this.scene.start('Start');    // première scène visuelle
  }
}
