(function() {
  const DEFAULTS = Object.freeze({
    masterVolume: 1,
    musicVolume: 0.22,
    sfxVolume: 1,
    muted: false,
  });

  const STORAGE_KEYS = Object.freeze({
    masterVolume: 'audio:masterVolume',
    musicVolume: 'audio:musicVolume',
    sfxVolume: 'audio:sfxVolume',
    muted: 'audio:muted',
    consent: 'audio:enabledByUser',
  });

  function clamp01(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, 0), 1);
  }

  function porcentaje(value) {
    return `${Math.round(clamp01(value, 0) * 100)}%`;
  }

  function usuarioHabilitoAudio() {
    try {
      return localStorage.getItem(STORAGE_KEYS.consent) === 'true';
    } catch (_) {
      return false;
    }
  }

  function guardarConsentimientoAudio() {
    try {
      localStorage.setItem(STORAGE_KEYS.consent, 'true');
    } catch (_) {}
  }

  function leerEstadoAudio() {
    const estado = { ...DEFAULTS };
    try {
      estado.masterVolume = clamp01(localStorage.getItem(STORAGE_KEYS.masterVolume), DEFAULTS.masterVolume);
      estado.musicVolume = clamp01(localStorage.getItem(STORAGE_KEYS.musicVolume), DEFAULTS.musicVolume);
      estado.sfxVolume = clamp01(localStorage.getItem(STORAGE_KEYS.sfxVolume), DEFAULTS.sfxVolume);
      const mutedRaw = localStorage.getItem(STORAGE_KEYS.muted);
      estado.muted = mutedRaw === null ? DEFAULTS.muted : mutedRaw === 'true';
    } catch (_) {}
    return estado;
  }

  function guardarEstadoAudio(estado) {
    try {
      localStorage.setItem(STORAGE_KEYS.masterVolume, String(estado.masterVolume));
      localStorage.setItem(STORAGE_KEYS.musicVolume, String(estado.musicVolume));
      localStorage.setItem(STORAGE_KEYS.sfxVolume, String(estado.sfxVolume));
      localStorage.setItem(STORAGE_KEYS.muted, String(estado.muted));
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

  function registrarTecladoBoton(elemento) {
    if (!elemento) return;
    elemento.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      elemento.click();
    });
  }

  function aplicarPasoRangeConTeclado(input) {
    if (!input) return;
    input.addEventListener('keydown', (event) => {
      const key = event.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageUp', 'PageDown'].includes(key)) {
        return;
      }

      const step = Number(input.step) || 0.05;
      const pageStep = step * 4;
      let current = clamp01(input.value, 0);

      if (key === 'Home') current = 0;
      if (key === 'End') current = 1;
      if (key === 'ArrowLeft' || key === 'ArrowDown') current -= step;
      if (key === 'ArrowRight' || key === 'ArrowUp') current += step;
      if (key === 'PageDown') current -= pageStep;
      if (key === 'PageUp') current += pageStep;

      const normalized = clamp01(current, 0);
      event.preventDefault();
      input.value = normalized.toFixed(2);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function initBingoAudioControl(config) {
    if (!config || !window.audioManager) return;

    const {
      containerId,
      toggleId,
      volumeId,
      masterVolumeId,
      sfxVolumeId,
      resetId,
      statusId,
      masterValueId,
      musicValueId,
      sfxValueId,
      audioId,
      musicTrackId = 'bg-music',
      musicManifestKey = null,
      sfxEvents = {},
      mostrarPrompt = true,
    } = config;

    const container = document.getElementById(containerId);
    const toggle = document.getElementById(toggleId);
    const musicInput = document.getElementById(volumeId);
    const masterInput = document.getElementById(masterVolumeId);
    const sfxInput = document.getElementById(sfxVolumeId);
    const resetBtn = document.getElementById(resetId);
    const statusEl = document.getElementById(statusId);
    const masterValueEl = document.getElementById(masterValueId);
    const musicValueEl = document.getElementById(musicValueId);
    const sfxValueEl = document.getElementById(sfxValueId);
    const volumeWrap = container?.querySelector('.audio-control__volume');

    if (!container || !toggle || !musicInput || !masterInput || !sfxInput || !resetBtn) return;

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

    let estado = leerEstadoAudio();
    let hideTimer = null;
    const promptGlobalAudio = obtenerPromptGlobalAudio();

    function actualizarEtiquetas() {
      const masterPct = porcentaje(estado.masterVolume);
      const musicPct = porcentaje(estado.musicVolume);
      const sfxPct = porcentaje(estado.sfxVolume);

      masterValueEl && (masterValueEl.textContent = masterPct);
      musicValueEl && (musicValueEl.textContent = musicPct);
      sfxValueEl && (sfxValueEl.textContent = sfxPct);

      masterInput.setAttribute('aria-valuetext', `Volumen general ${masterPct}`);
      musicInput.setAttribute('aria-valuetext', `Volumen de música ${musicPct}`);
      sfxInput.setAttribute('aria-valuetext', `Volumen de efectos ${sfxPct}`);
    }

    function actualizarUI() {
      const muted = estado.muted;
      container.classList.toggle('is-muted', muted);
      toggle.setAttribute('aria-pressed', String(!muted));
      toggle.setAttribute('aria-label', muted ? 'Activar todo el audio' : 'Silenciar todo el audio');
      toggle.setAttribute('title', muted ? 'Activar sonido' : 'Silenciar sonido');

      if (statusEl) {
        statusEl.textContent = muted ? '🔇 Audio silenciado' : '🔊 Audio activo';
      }

      masterInput.value = estado.masterVolume.toFixed(2);
      musicInput.value = estado.musicVolume.toFixed(2);
      sfxInput.value = estado.sfxVolume.toFixed(2);
      actualizarEtiquetas();
    }

    function aplicarGanancias() {
      window.audioManager.setVolume('master', estado.masterVolume);
      window.audioManager.setVolume('music', estado.musicVolume);
      window.audioManager.setVolume('sfx', estado.sfxVolume);
      window.audioManager.setMuted(estado.muted);
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
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        ocultarVolumen();
      }, 7000);
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
      aplicarGanancias();
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
      } catch (_) {
        if (!desdePrompt) mostrarPromptAudio();
      }
    }

    function persistirYRefrescar() {
      aplicarGanancias();
      guardarEstadoAudio(estado);
      actualizarUI();
    }

    toggle.addEventListener('click', async () => {
      estado.muted = !estado.muted;
      if (estado.muted) {
        ocultarVolumen();
      } else {
        await intentarReproducirMusica();
        mostrarVolumenTemporal();
      }
      persistirYRefrescar();
    });

    masterInput.addEventListener('input', async () => {
      estado.masterVolume = clamp01(masterInput.value, estado.masterVolume);
      estado.muted = false;
      await intentarReproducirMusica();
      mostrarVolumenTemporal();
      persistirYRefrescar();
    });

    musicInput.addEventListener('input', async () => {
      estado.musicVolume = clamp01(musicInput.value, estado.musicVolume);
      estado.muted = false;
      await intentarReproducirMusica();
      mostrarVolumenTemporal();
      persistirYRefrescar();
    });

    sfxInput.addEventListener('input', () => {
      estado.sfxVolume = clamp01(sfxInput.value, estado.sfxVolume);
      estado.muted = false;
      mostrarVolumenTemporal();
      persistirYRefrescar();
    });

    resetBtn.addEventListener('click', async () => {
      estado = { ...DEFAULTS };
      await intentarReproducirMusica();
      mostrarVolumenTemporal();
      persistirYRefrescar();
    });

    [toggle, resetBtn].forEach(registrarTecladoBoton);
    [masterInput, musicInput, sfxInput].forEach(aplicarPasoRangeConTeclado);

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

    persistirYRefrescar();

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

  function reproducirSonidoGanador(eventName = 'winner') {
    if (!window.audioManager) return;
    const estado = leerEstadoAudio();
    if (estado.muted) return;
    window.audioManager.playSfx(eventName).catch(() => {});
  }

  window.initBingoAudioControl = initBingoAudioControl;
  window.reproducirSonidoGanador = reproducirSonidoGanador;
})();
