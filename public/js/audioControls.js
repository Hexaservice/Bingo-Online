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

  function initBingoAudioControl(config) {
    if (!config) return;
    const {
      containerId,
      toggleId,
      volumeId,
      audioId,
      storageKeyPrefix = 'bingoAudio',
      defaultVolume = DEFAULT_VOLUME,
    } = config;

    const container = document.getElementById(containerId);
    const toggle = document.getElementById(toggleId);
    const volumeInput = document.getElementById(volumeId);
    const audioEl = document.getElementById(audioId);
    const volumeWrap = container?.querySelector('.audio-control__volume');

    if (!container || !toggle || !volumeInput || !audioEl) return;

    let estado = obtenerEstadoAudio(storageKeyPrefix);
    if (!Number.isFinite(estado.volume)) {
      estado.volume = defaultVolume;
    }

    let hideTimer = null;

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

    async function intentarReproducir() {
      if (estado.muted) return;
      try {
        await audioEl.play();
      } catch (err) {
        // Bloqueado por el navegador hasta interacción del usuario.
      }
    }

    function aplicarEstadoInicial() {
      audioEl.volume = estado.volume;
      audioEl.muted = estado.muted;
      volumeInput.value = estado.volume.toFixed(2);
      if (estado.muted) {
        ocultarVolumen();
        audioEl.pause();
      }
      actualizarUI();
    }

    toggle.addEventListener('click', async () => {
      estado.muted = !estado.muted;
      audioEl.muted = estado.muted;
      if (estado.muted) {
        audioEl.pause();
        ocultarVolumen();
      } else {
        await intentarReproducir();
        mostrarVolumenTemporal();
      }
      guardarEstadoAudio(storageKeyPrefix, estado);
      actualizarUI();
    });

    volumeInput.addEventListener('input', () => {
      const value = parseFloat(volumeInput.value);
      if (!Number.isFinite(value)) return;
      estado.volume = Math.min(Math.max(value, 0), 1);
      audioEl.volume = estado.volume;
      guardarEstadoAudio(storageKeyPrefix, estado);
    });

    document.addEventListener(
      'pointerdown',
      () => {
        intentarReproducir();
      },
      { once: true }
    );

    aplicarEstadoInicial();
    if (!estado.muted) {
      intentarReproducir();
    }

    window.bingoAudioState = estado;
  }

  function reproducirSonidoGanador(audioId = 'win-audio', storageKeyPrefix = 'bingoAudio') {
    const estado = obtenerEstadoAudio(storageKeyPrefix);
    if (estado.muted) return;
    const audioEl = document.getElementById(audioId);
    if (!audioEl) return;
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
  }

  window.initBingoAudioControl = initBingoAudioControl;
  window.reproducirSonidoGanador = reproducirSonidoGanador;
})();
