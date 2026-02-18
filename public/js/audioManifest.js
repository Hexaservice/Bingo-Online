(function () {
  const manifest = {
    manifestVersion: '2026.02.18-v2',
    globalAudioPolicy: {
      preferredFormats: ['mp3', 'ogg'],
      musicPreload: 'deferred',
      criticalSfxPreload: 'on-game-enter',
      maxSfxBytes: 122880,
      maxMusicBytes: 1048576,
      normalizationNote: 'Aplicar normalización de loudness en origen (objetivo sugerido -16 LUFS música / -14 LUFS SFX).',
    },
    music: {
      backgroundMain: {
        category: 'music',
        preferredFormats: ['mp3', 'ogg'],
        preload: 'deferred',
        maxBytes: 1048576,
        normalizationGain: 0.92,
        sources: [
          {
            format: 'mp3',
            url: 'https://assets.mixkit.co/music/preview/mixkit-game-level-music-689.mp3',
            kind: 'primary',
          },
          {
            format: 'mp3',
            url: 'https://cdn.pixabay.com/audio/2021/08/09/audio_d0a0250f6f.mp3',
            kind: 'fallback',
          },
        ],
        license: 'Mixkit Free Sound Effects License / Pixabay Content License',
        attribution: 'Mixkit (principal) y Pixabay (respaldo)',
      },
    },
    sfx: {
      drawNumber: {
        category: 'sfx',
        preferredFormats: ['mp3', 'ogg'],
        maxBytes: 122880,
        normalizationGain: 0.95,
        sources: [
          {
            format: 'mp3',
            url: 'https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3',
            kind: 'primary',
          },
          {
            format: 'mp3',
            url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8f9f250f0.mp3',
            kind: 'fallback',
          },
        ],
        license: 'Mixkit Free Sound Effects License / Pixabay Content License',
        attribution: 'Mixkit (principal) y Pixabay (respaldo)',
      },
      markCell: {
        category: 'sfx',
        preferredFormats: ['mp3', 'ogg'],
        maxBytes: 122880,
        normalizationGain: 0.9,
        sources: [
          {
            format: 'mp3',
            url: 'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3',
            kind: 'primary',
          },
          {
            format: 'mp3',
            url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c6ccf2fb18.mp3',
            kind: 'fallback',
          },
        ],
        license: 'Mixkit Free Sound Effects License / Pixabay Content License',
        attribution: 'Mixkit (principal) y Pixabay (respaldo)',
      },
      openModal: {
        category: 'sfx',
        preferredFormats: ['mp3', 'ogg'],
        maxBytes: 122880,
        normalizationGain: 0.88,
        sources: [
          {
            format: 'mp3',
            url: 'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3',
            kind: 'primary',
          },
          {
            format: 'mp3',
            url: 'https://cdn.pixabay.com/audio/2022/03/22/audio_c72f61d4f1.mp3',
            kind: 'fallback',
          },
        ],
        license: 'Mixkit Free Sound Effects License / Pixabay Content License',
        attribution: 'Mixkit (principal) y Pixabay (respaldo)',
      },
      win: {
        category: 'sfx',
        preferredFormats: ['mp3', 'ogg'],
        preloadCritical: true,
        maxBytes: 122880,
        normalizationGain: 0.86,
        sources: [
          {
            format: 'mp3',
            url: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
            kind: 'primary',
          },
          {
            format: 'mp3',
            url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c87cfcbad6.mp3',
            kind: 'fallback',
          },
        ],
        license: 'Mixkit Free Sound Effects License / Pixabay Content License',
        attribution: 'Mixkit (principal) y Pixabay (respaldo)',
      },
    },
  };

  window.BINGO_AUDIO_MANIFEST = manifest;
})();
