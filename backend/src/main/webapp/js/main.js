// src/main.js
import { Boot }     from './scenes/Boot.js';
import { Audio }    from './scenes/Audio.js';
import { Start }    from './scenes/Start.js';
import { Register } from './scenes/Register.js';
import { Login }    from './scenes/Login.js';
import { Menu }     from './scenes/Menu.js';
import { Roulette } from './scenes/Roulette.js';
import { BlackJack } from './scenes/BlackJack.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280, height: 720,
  backgroundColor: '#000000',
  scene: [Boot, Audio, Start, Register, Login, Menu, Roulette, BlackJack], // Boot d'abord
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  dom: { createContainer: true }
};
new Phaser.Game(config);
