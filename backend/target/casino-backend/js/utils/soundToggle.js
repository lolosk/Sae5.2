// src/utils/soundToggle.js
export function addSoundToggle(scene) {
  const pad = 12;
  const isMuted = scene.registry.get('audioMuted') ?? false;

  const icon = scene.add.image(
    pad, pad, isMuted ? 'icon_sound_off' : 'icon_sound_on'
  )
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true })
    .setDepth(999);

  // Scale responsive (~6% de l’écran)
  const target = Math.min(scene.scale.gameSize.width, scene.scale.gameSize.height) * 0.06;
  icon.setScale(target / Math.max(icon.width, icon.height));

  // Toggle global (Audio.js écoute 'audio:toggle' et met à jour registry + mute)
  const onClick = () => scene.game.events.emit('audio:toggle');
  icon.on('pointerup', onClick);

  // Quand l’état audio change, on swap l’icône
  const onAudioState = (muted) => icon.setTexture(muted ? 'icon_sound_off' : 'icon_sound_on');
  scene.game.events.on('audio:state', onAudioState, scene); // auto-clean à destroy

  // Quand la scène se “réveille”, resync avec l’état courant
  const onWake = () => {
    const m = scene.registry.get('audioMuted') ?? false;
    icon.setTexture(m ? 'icon_sound_off' : 'icon_sound_on');
  };
  scene.events.on('wake', onWake);

  // Nettoyage manuel si tu veux être rigoureux (utile si tu n’as pas passé `scene` en contexte)
  scene.events.once('shutdown', () => {
    icon.off('pointerup', onClick);
    scene.game.events.off('audio:state', onAudioState, scene);
    scene.events.off('wake', onWake);
    icon.destroy();
  });

  // Sync initiale (au cas où on arrive après un toggle)
  onWake();

  return icon;
}
