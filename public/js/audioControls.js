(function() {
  const DEFAULT_VOLUME = 0.22;

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
      sfxEvents = {},
      mostrarPrompt = false,
    } = config;

    const container = document.getElementById(containerId);
    const toggle = document.getElementById(toggleId);
    const volumeInput = document.getElementById(volumeId);
    const volumeWrap = container?.querySelector('.audio-control__volume');

    if (!container || !toggle || !volumeInput) return;

    const musicSrc = resolverFuenteAudioDesdeId(audioId);
    if (musicSrc) {
      window.audioManager.registerMusicTrack(musicTrackId, musicSrc);
    }

    Object.entries(sfxEvents).forEach(([eventName, cfg]) => {
      if (!cfg) return;
      const src = cfg.src || resolverFuenteAudioDesdeId(cfg.audioId);
      if (!src) return;
      window.audioManager.registerSfxEvent(eventName, src, cfg);
    });

    let estado = obtenerEstadoAudio(storageKeyPrefix);
    if (!Number.isFinite(estado.volume)) {
      estado.volume = defaultVolume;
    }

    let hideTimer = null;
    let promptEl = null;

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

    function crearPromptAudio() {
      if (!mostrarPrompt || promptEl) return;
      promptEl = document.createElement('div');
      promptEl.className = 'audio-control__prompt';
      promptEl.setAttribute('role', 'dialog');
      promptEl.setAttribute('aria-live', 'polite');
      promptEl.setAttribute('aria-hidden', 'true');
      promptEl.innerHTML =
        '<p>Para escuchar la música necesitamos tu interacción.</p>' +
        '<button type="button" class="audio-control__prompt-btn">Activar audio</button>';

      const promptBtn = promptEl.querySelector('.audio-control__prompt-btn');
      promptBtn?.addEventListener('click', async () => {
        await window.audioManager.init();
        if (!estado.muted) {
          await window.audioManager.playMusic(musicTrackId);
        }
        ocultarPromptAudio();
      });
      container.appendChild(promptEl);
    }

    function mostrarPromptAudio() {
      if (!mostrarPrompt) return;
      crearPromptAudio();
      if (!promptEl) return;
      promptEl.classList.add('is-visible');
      promptEl.removeAttribute('aria-hidden');
    }

    function ocultarPromptAudio() {
      if (!promptEl) return;
      promptEl.classList.remove('is-visible');
      promptEl.setAttribute('aria-hidden', 'true');
    }

    async function intentarReproducirMusica(desdePrompt = false) {
      if (estado.muted || !musicSrc) return;
      try {
        await window.audioManager.init();
        await window.audioManager.playMusic(musicTrackId);
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

    ['pointerdown', 'touchstart', 'keydown'].forEach((evento) => {
      document.addEventListener(
        evento,
        () => {
          window.audioManager.init().catch(() => {});
        },
        { once: true }
      );
    });

    aplicarEstadoInicial();
    if (!estado.muted) {
      intentarReproducirMusica();
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
