(function() {
  const DEFAULT_VOLUME = 0.22;
  const AUDIO_USER_CONSENT_KEY = 'audio:enabledByUser';

  function usuarioHabilitoAudio() {
    try {
      return localStorage.getItem(AUDIO_USER_CONSENT_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }

  function guardarConsentimientoAudio() {
    try {
      localStorage.setItem(AUDIO_USER_CONSENT_KEY, 'true');
    } catch (_) {}
  }

  function obtenerPromptGlobalAudio() {
    if (window.__bingoAudioPromptManager) {
      return window.__bingoAudioPromptManager;
    }

    let promptEl = null;
    let onEnable = null;

    function crearPrompt() {
      if (promptEl) return promptEl;
      promptEl = document.createElement('div');
      promptEl.className = 'audio-control__prompt audio-control__prompt--global';
      promptEl.setAttribute('role', 'dialog');
      promptEl.setAttribute('aria-live', 'polite');
      promptEl.setAttribute('aria-hidden', 'true');
      promptEl.innerHTML =
        '<p>Tu navegador bloqueó el audio automático. Toca para activarlo.</p>' +
        '<button type="button" class="audio-control__prompt-btn">Activar audio</button>';

      promptEl.querySelector('.audio-control__prompt-btn')?.addEventListener('click', async () => {
        if (typeof onEnable === 'function') {
          await onEnable();
        }
      });

      document.body.appendChild(promptEl);
      return promptEl;
    }

    const manager = {
      setEnableHandler(handler) {
        onEnable = handler;
      },
      show() {
        const el = crearPrompt();
        el.classList.add('is-visible');
        el.removeAttribute('aria-hidden');
      },
      hide() {
        if (!promptEl) return;
        promptEl.classList.remove('is-visible');
        promptEl.setAttribute('aria-hidden', 'true');
      },
    };

    window.__bingoAudioPromptManager = manager;
    return manager;
  }

  function obtenerEstadoAudio(prefix) {
    const mutedRaw = localStorage.getItem(`${prefix}:muted`);
    const volumeRaw = parseFloat(localStorage.getItem(`${prefix}:volume`));
    const muted = mutedRaw === null ? false : mutedRaw === 'true';
    const volume = Number.isFinite(volumeRaw) ? Math.min(Math.max(volumeRaw, 0), 1) : DEFAULT_VOLUME;
    return { muted, volume };
  }

  function guardarEstadoAudio(prefix, estado) {
    localStorage.setItem(`${prefix}:muted`, String(estado.muted));
    localStorage.setItem(`${prefix}:volume`, String(estado.volume));
  }

  function resolverFuenteAudioDesdeId(audioId) {
    if (!audioId) return null;
    const audioEl = document.getElementById(audioId);
    return audioEl?.currentSrc || audioEl?.src || null;
  }

  function resolverDescriptorDesdeManifest(manifestKey) {
    if (!manifestKey || !window.audioManager?.getManifestNode) return null;
    const descriptor = window.audioManager.getManifestNode(manifestKey);
    if (!descriptor?.urlPrimary) return null;
    return {
      manifestKey,
      urlPrimary: descriptor.urlPrimary,
      urlFallback: descriptor.urlFallback || null,
      license: descriptor.license || null,
      attribution: descriptor.attribution || null,
    };
  }

  function initBingoAudioControl(config) {
    if (!config || !window.audioManager) return;

    const {
      containerId,
      toggleId,
      volumeId,
      audioId,
      storageKeyPrefix = 'bingoAudio',
      defaultVolume = DEFAULT_VOLUME,
      musicTrackId = 'bg-music',
      musicManifestKey = null,
      sfxEvents = {},
      mostrarPrompt = true,
    } = config;

    const container = document.getElementById(containerId);
    const toggle = document.getElementById(toggleId);
    const volumeInput = document.getElementById(volumeId);
    const volumeWrap = container?.querySelector('.audio-control__volume');

    if (!container || !toggle || !volumeInput) return;

    const musicDescriptor = resolverDescriptorDesdeManifest(musicManifestKey);
    const musicSrc = resolverFuenteAudioDesdeId(audioId);
    if (musicDescriptor || musicSrc) {
      window.audioManager.registerMusicTrack(musicTrackId, musicDescriptor || musicSrc);
    }

    Object.entries(sfxEvents).forEach(([eventName, cfg]) => {
      if (!cfg) return;
      const manifestDescriptor = resolverDescriptorDesdeManifest(cfg.manifestKey);
      const src = cfg.src || resolverFuenteAudioDesdeId(cfg.audioId);
      const resolvedSource = manifestDescriptor || src;
      if (!resolvedSource) return;
      window.audioManager.registerSfxEvent(eventName, resolvedSource, cfg);
    });

    let estado = obtenerEstadoAudio(storageKeyPrefix);
    if (!Number.isFinite(estado.volume)) {
      estado.volume = defaultVolume;
    }

    let hideTimer = null;
    const promptGlobalAudio = obtenerPromptGlobalAudio();

    function actualizarUI() {
      container.classList.toggle('is-muted', estado.muted);
      toggle.setAttribute('aria-pressed', String(!estado.muted));
      toggle.setAttribute('title', estado.muted ? 'Activar sonido' : 'Silenciar sonido');
    }

    function ocultarVolumen() {
      if (!volumeWrap) return;
      volumeWrap.hidden = true;
      volumeWrap.setAttribute('aria-hidden', 'true');
    }

    function mostrarVolumenTemporal() {
      if (!volumeWrap) return;
      volumeWrap.hidden = false;
      volumeWrap.setAttribute('aria-hidden', 'false');
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
      hideTimer = setTimeout(() => {
        ocultarVolumen();
      }, 5000);
    }

    function mostrarPromptAudio() {
      if (!mostrarPrompt) return;
      promptGlobalAudio.show();
    }

    function ocultarPromptAudio() {
      promptGlobalAudio.hide();
    }

    async function desbloquearAudioYMusica({ fadeInMs = 0 } = {}) {
      await window.audioManager.init();
      if (!estado.muted && (musicDescriptor || musicSrc)) {
        await window.audioManager.playMusic(musicTrackId, { fadeInMs });
      }
      guardarConsentimientoAudio();
      ocultarPromptAudio();
    }

    async function intentarReproducirMusica(desdePrompt = false) {
      if (estado.muted || (!musicDescriptor && !musicSrc)) return;
      try {
        await desbloquearAudioYMusica();
        if (window.audioManager.isAutoplayBlocked?.()) {
          mostrarPromptAudio();
          return;
        }
        ocultarPromptAudio();
      } catch (err) {
        if (!desdePrompt) {
          mostrarPromptAudio();
        }
      }
    }

    function aplicarEstadoInicial() {
      window.audioManager.setVolume('music', estado.volume);
      window.audioManager.setMuted(estado.muted);
      volumeInput.value = estado.volume.toFixed(2);
      if (estado.muted) {
        ocultarVolumen();
      }
      actualizarUI();
    }

    toggle.addEventListener('click', async () => {
      estado.muted = window.audioManager.toggleMute();
      if (estado.muted) {
        ocultarVolumen();
      } else {
        await intentarReproducirMusica();
        mostrarVolumenTemporal();
      }
      guardarEstadoAudio(storageKeyPrefix, estado);
      actualizarUI();
    });

    volumeInput.addEventListener('input', () => {
      const value = parseFloat(volumeInput.value);
      if (!Number.isFinite(value)) return;
      estado.volume = Math.min(Math.max(value, 0), 1);
      window.audioManager.setVolume('music', estado.volume);
      guardarEstadoAudio(storageKeyPrefix, estado);
    });

    const manejarPrimerGesto = async () => {
      try {
        await desbloquearAudioYMusica({ fadeInMs: 900 });
      } catch (_) {}
    };

    ['pointerdown', 'keydown'].forEach((evento) => {
      document.addEventListener(evento, manejarPrimerGesto, { once: true });
    });

    promptGlobalAudio.setEnableHandler(async () => {
      await desbloquearAudioYMusica({ fadeInMs: 900 });
    });

    aplicarEstadoInicial();
    if (!estado.muted && usuarioHabilitoAudio()) {
      intentarReproducirMusica();
    } else {
      window.audioManager.init().then(() => {
        if (window.audioManager.isAutoplayBlocked?.()) {
          mostrarPromptAudio();
        }
      }).catch(() => {
        mostrarPromptAudio();
      });
    }

    window.bingoAudioState = estado;
  }

  function reproducirSonidoGanador(eventName = 'winner', storageKeyPrefix = 'bingoAudio') {
    if (!window.audioManager) return;
    const estado = obtenerEstadoAudio(storageKeyPrefix);
    if (estado.muted) return;
    window.audioManager.playSfx(eventName).catch(() => {});
  }

  window.initBingoAudioControl = initBingoAudioControl;
  window.reproducirSonidoGanador = reproducirSonidoGanador;
})();
