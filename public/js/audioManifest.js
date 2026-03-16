(function () {
  const manifest = {
    manifestVersion: '2026.03.16-local-only-v1',
    globalAudioPolicy: {
      allowedSourceType: 'repository-local-files-only',
      preferredFormats: ['wav'],
      musicPreload: 'deferred',
      criticalSfxPreload: 'on-game-enter',
      maxSfxBytes: 262144,
      maxMusicBytes: 1048576,
      normalizationNote: 'Todos los audios deben existir en /public/sonidos y versionarse dentro del repositorio.',
    },
    music: {
      backgroundMain: {
        category: 'music',
        preferredFormats: ['wav'],
        preload: 'deferred',
        maxBytes: 1048576,
        normalizationGain: 0.55,
        sources: [
          {
            format: 'wav',
            url: '/sonidos/5.wav',
            kind: 'local-primary',
          },
        ],
        description: 'Pista base local (loop).',
      },
    },
    sfx: {
      drawNumber: {
        category: 'sfx',
        preferredFormats: ['wav'],
        maxBytes: 262144,
        normalizationGain: 0.95,
        sources: [
          { format: 'wav', url: '/sonidos/1.wav', kind: 'local-primary' },
        ],
      },
      markCell: {
        category: 'sfx',
        preferredFormats: ['wav'],
        maxBytes: 262144,
        normalizationGain: 0.9,
        sources: [
          { format: 'wav', url: '/sonidos/2.wav', kind: 'local-primary' },
        ],
      },
      openModal: {
        category: 'sfx',
        preferredFormats: ['wav'],
        maxBytes: 262144,
        normalizationGain: 0.88,
        sources: [
          { format: 'wav', url: '/sonidos/3.wav', kind: 'local-primary' },
        ],
      },
      win: {
        category: 'sfx',
        preferredFormats: ['wav'],
        preloadCritical: true,
        maxBytes: 262144,
        normalizationGain: 0.86,
        sources: [
          { format: 'wav', url: '/sonidos/4.wav', kind: 'local-primary' },
        ],
      },
    },
  };

  window.BINGO_AUDIO_MANIFEST = manifest;
})();
