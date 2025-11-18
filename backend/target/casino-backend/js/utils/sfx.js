// src/utils/sfx.js
export function playSfx(scene, key, opts = {}) {
  // si le son est muté via l’icône, on ne joue rien
  if (scene.registry.get('audioMuted')) return;

  const { volume = 0.8, rate = 1, detune = 0 } = opts;

  // sécurité : si la clé n’est pas chargée on évite le crash
  if (!scene.cache.audio.exists(key)) {
    console.warn('SFX key not found:', key);
    return;
  }

  const s = scene.sound.add(key, { volume, rate, detune });
  s.once('complete', () => s.destroy());
  s.play();
}
