(function () {
  function getManifestNode(path) {
    if (!path) return null;
    const manifest = window.BINGO_AUDIO_MANIFEST || null;
    if (!manifest) return null;

    return String(path)
      .split('.')
      .reduce((acc, segment) => (acc && acc[segment] ? acc[segment] : null), manifest);
  }

  function createAudioManagerStub() {
    return {
      audioContext: null,
      autoplayBlocked: false,
      registerMusicTrack() {},
      registerSfxEvent() {},
      setVolume() {},
      setMuted() {},
      toggleMute() {
        return false;
      },
      async probeAutoplayState() {
        return true;
      },
      async ensureRunningContext() {
        return true;
      },
      async playMusic() {
        return null;
      },
      async playSfx() {
        return null;
      },
      isAutoplayBlocked() {
        return false;
      },
      getManifestNode,
    };
  }

  window.createAudioManagerStub = window.createAudioManagerStub || createAudioManagerStub;

  if (!window.audioManager) {
    window.audioManager = createAudioManagerStub();
  } else if (typeof window.audioManager.getManifestNode !== 'function') {
    window.audioManager.getManifestNode = getManifestNode;
  }
})();
