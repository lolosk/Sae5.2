// src/utils/sfx.js
export function playSfx(scene, key, opts = {}) {
  // évite de jouer si mute global actif
  if (scene.registry.get('audioMuted')) return;

  const { volume = 0.7, rate = 1, detune = 0 } = opts;
  const s = scene.sound.add(key, { volume, rate, detune });
  s.once('complete', () => s.destroy());
  s.play();
}
