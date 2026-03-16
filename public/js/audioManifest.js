(function () {
  const manifest = {
    manifestVersion: '2026.02.18-v2',
    globalAudioPolicy: {
      preferredFormats: ['wav', 'mp3', 'ogg'],
      musicPreload: 'deferred',
      criticalSfxPreload: 'on-game-enter',
      maxSfxBytes: 122880,
      maxMusicBytes: 1048576,
      normalizationNote: 'Aplicar normalización de loudness en origen (objetivo sugerido -16 LUFS música / -14 LUFS SFX).',
    },
    music: {
      backgroundMain: {
        category: 'music',
        preferredFormats: ['wav', 'mp3', 'ogg'],
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
        generator: {
          kind: 'ambient-loop',
          durationSec: 6,
          rootFrequency: 196,
          gain: 0.11,
        },
        license: 'Mixkit Free Sound Effects License / Pixabay Content License',
        attribution: 'Mixkit (principal), Pixabay (respaldo) y sintetizador local (último respaldo)',
      },
    },
    sfx: {
      drawNumber: {
        category: 'sfx',
        preferredFormats: ['wav', 'mp3', 'ogg'],
        maxBytes: 122880,
        normalizationGain: 0.95,
        sources: [
          {
            format: 'wav',
            url: '/sonidos/1.wav',
            kind: 'local-primary',
          },
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
        generator: {
          kind: 'pulse',
          frequency: 880,
          durationSec: 0.16,
          gain: 0.22,
          waveform: 'triangle',
        },
        license: 'Mixkit Free Sound Effects License / Pixabay Content License',
        attribution: 'Sonido local / Mixkit / Pixabay + sintetizador local',
      },
      markCell: {
        category: 'sfx',
        preferredFormats: ['wav', 'mp3', 'ogg'],
        maxBytes: 122880,
        normalizationGain: 0.9,
        sources: [
          {
            format: 'wav',
            url: '/sonidos/2.wav',
            kind: 'local-primary',
          },
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
        generator: {
          kind: 'pulse',
          frequency: 660,
          durationSec: 0.14,
          gain: 0.22,
          waveform: 'sine',
        },
        license: 'Mixkit Free Sound Effects License / Pixabay Content License',
        attribution: 'Sonido local / Mixkit / Pixabay + sintetizador local',
      },
      openModal: {
        category: 'sfx',
        preferredFormats: ['wav', 'mp3', 'ogg'],
        maxBytes: 122880,
        normalizationGain: 0.88,
        sources: [
          {
            format: 'wav',
            url: '/sonidos/3.wav',
            kind: 'local-primary',
          },
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
        generator: {
          kind: 'pulse',
          frequency: 740,
          durationSec: 0.13,
          gain: 0.2,
          waveform: 'square',
        },
        license: 'Mixkit Free Sound Effects License / Pixabay Content License',
        attribution: 'Sonido local / Mixkit / Pixabay + sintetizador local',
      },
      win: {
        category: 'sfx',
        preferredFormats: ['wav', 'mp3', 'ogg'],
        preloadCritical: true,
        maxBytes: 122880,
        normalizationGain: 0.86,
        sources: [
          {
            format: 'wav',
            url: '/sonidos/4.wav',
            kind: 'local-primary',
          },
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
        generator: {
          kind: 'pulse',
          frequency: 523.25,
          durationSec: 0.25,
          gain: 0.26,
          waveform: 'triangle',
        },
        license: 'Mixkit Free Sound Effects License / Pixabay Content License',
        attribution: 'Sonido local / Mixkit / Pixabay + sintetizador local',
      },
    },
  };

  window.BINGO_AUDIO_MANIFEST = manifest;
})();
