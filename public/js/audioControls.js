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
      unlockAudioIds = [],
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
    let audioDesbloqueado = false;
    let promptEl = null;
    let promptBtn = null;

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
      if (promptEl) return;
      promptEl = document.createElement('div');
      promptEl.className = 'audio-control__prompt';
      promptEl.setAttribute('role', 'dialog');
      promptEl.setAttribute('aria-live', 'polite');
      promptEl.setAttribute('aria-hidden', 'true');
      promptEl.innerHTML =
        '<p>Para escuchar la música necesitamos tu interacción.</p>' +
        '<button type="button" class="audio-control__prompt-btn">Activar audio</button>';
      promptBtn = promptEl.querySelector('.audio-control__prompt-btn');
      promptBtn?.addEventListener('click', async () => {
        await intentarReproducir(true);
        ocultarPromptAudio();
      });
      container.appendChild(promptEl);
    }

    function mostrarPromptAudio() {
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

    async function intentarReproducir(desdePrompt = false) {
      if (estado.muted) return;
      try {
        audioEl.load();
        await audioEl.play();
        ocultarPromptAudio();
      } catch (err) {
        // Bloqueado por el navegador hasta interacción del usuario.
        if (!desdePrompt) {
          mostrarPromptAudio();
        }
      }
    }

    function desbloquearAudioEnInteraccion() {
      if (audioDesbloqueado) return;
      const audios = [audioEl]
        .concat(
          unlockAudioIds
            .map((id) => document.getElementById(id))
            .filter((el) => el)
        );
      audios.forEach((audio) => {
        const mutedPrevio = audio.muted;
        audio.muted = true;
        const intento = audio.play();
        if (intento && typeof intento.then === 'function') {
          intento
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
            })
            .catch(() => {})
            .finally(() => {
              audio.muted = mutedPrevio;
            });
        } else {
          audio.muted = mutedPrevio;
        }
      });
      audioDesbloqueado = true;
      intentarReproducir();
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

    ['pointerdown', 'touchstart', 'keydown'].forEach((evento) => {
      document.addEventListener(
        evento,
        () => {
          desbloquearAudioEnInteraccion();
        },
        { once: true }
      );
    });

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
    audioEl.load();
    audioEl.play().catch(() => {});
  }

  window.initBingoAudioControl = initBingoAudioControl;
  window.reproducirSonidoGanador = reproducirSonidoGanador;
})();
