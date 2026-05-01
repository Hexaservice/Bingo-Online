(function () {
  const AUDIO_EVENTS = Object.freeze({
    DRAW_NUMBER: 'DRAW_NUMBER',
    MARK_CELL: 'MARK_CELL',
    MODAL_OPEN: 'MODAL_OPEN',
    MODAL_CLOSE: 'MODAL_CLOSE',
    WINNER: 'WINNER',
    TIE: 'TIE',
  });
  const AUDIO_EVENT_CONFIG = Object.freeze({
    [AUDIO_EVENTS.DRAW_NUMBER]: { manifestKey: 'sfx.drawNumber' },
    [AUDIO_EVENTS.MARK_CELL]: { manifestKey: 'sfx.markCell' },
    [AUDIO_EVENTS.MODAL_OPEN]: { manifestKey: 'sfx.openModal' },
    [AUDIO_EVENTS.MODAL_CLOSE]: { manifestKey: 'sfx.openModal' },
    [AUDIO_EVENTS.WINNER]: { manifestKey: 'sfx.win', critical: true, duckAmount: 0.25, duckDurationMs: 2200 },
    [AUDIO_EVENTS.TIE]: { manifestKey: 'sfx.win', critical: true, duckAmount: 0.3, duckDurationMs: 1800 }
  });

  const orchestrator = {
    AUDIO_EVENTS,
    AUDIO_CONTROL_DIM_DELAY_MS: 5000,
    AUDIO_CANTO_EVENT_PREFIX: 'CANTO_NUM_',
    AUDIO_BACKGROUND_TRACK_ID: 'GAMEPLAY_BG_MAIN',
    AUDIO_BACKGROUND_MANIFEST_KEY: 'music.backgroundMain',
    AUDIO_STORAGE_KEYS: Object.freeze({ master: 'audio:masterVolume', sfx: 'audio:sfxVolume', muted: 'audio:muted' }),
    initialized: false,
    initPromise: null,
    unlockRegistered: false,
    cantosProcessing: false,
    musicRegistered: false,
    musicStarted: false,
    musicOptional: true,
    registeredEvents: new Set(),
    cantoQueue: [],
    lastEventByName: new Map(),
    preferences: { master: 1, sfx: 1, muted: false },
    debugEnabled: false,
    debugRows: [],
    debugMaxRows: 20,
    debugPanelEl: null,

    clamp(value, fallback = 1) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback; },
    isBlockedError(err) { return err && (err.code === 'AUDIO_CONTEXT_BLOCKED' || /bloqueado/i.test(String(err?.message || ''))); },
    nowMs() { return (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : 0; },
    getFailureReason(err) {
      if (!err) return null;
      const msg = String(err?.message || err).toLowerCase();
      if (err?.code === 'AUDIO_CONTEXT_BLOCKED' || msg.includes('bloqueado')) return 'bloqueo_contexto';
      if (msg.includes('404') || msg.includes('no se pudo descargar')) return '404';
      if (msg.includes('decode')) return 'decode_error';
      if (this.preferences?.muted) return 'muted';
      return 'desconocido';
    },
    initDebugMode() {
      this.debugEnabled = (new URLSearchParams(window.location.search).get('audioDebug') === '1');
      if (!this.debugEnabled) return;
      if (window.audioManager?.setDebugListener) {
        window.audioManager.setDebugListener((evt) => this.pushDebugRow(evt.type, evt));
      }
      const panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;right:12px;bottom:92px;z-index:10001;max-width:360px;max-height:280px;overflow:auto;background:rgba(0,0,0,.85);color:#fff;font:12px/1.3 monospace;border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:8px;';
      panel.innerHTML = '<strong>Audio Debug</strong><div id="audio-debug-body" style="margin-top:6px;"></div><div style="margin-top:8px;border-top:1px solid rgba(255,255,255,.25);padding-top:6px;opacity:.9"><div><b>Checklist soporte</b></div><div>1) Validar ?audioDebug=1</div><div>2) Revisar mute/volumen y permisos</div><div>3) Confirmar 404/Decode en eventos</div><div>4) Copiar console.table + secuencia</div></div>';
      document.body.appendChild(panel);
      this.debugPanelEl = panel.querySelector('#audio-debug-body');
      this.pushDebugRow('debug_enabled', { detail: 'Modo debug activo por ?audioDebug=1' });
    },
    pushDebugRow(evento, data = {}) {
      if (!this.debugEnabled) return;
      const row = { hora: new Date().toISOString(), evento, detalle: data?.eventName || data?.url || data?.detail || '', motivo: data?.reason || data?.error || '' };
      this.debugRows.unshift(row);
      if (this.debugRows.length > this.debugMaxRows) this.debugRows.length = this.debugMaxRows;
      if (this.debugPanelEl) {
        this.debugPanelEl.innerHTML = this.debugRows.map((r) => `<div>[${r.hora.slice(11, 19)}] ${r.evento} ${r.detalle ? `- ${r.detalle}` : ''} ${r.motivo ? `(${r.motivo})` : ''}</div>`).join('');
      }
      console.table(this.debugRows);
    },

    loadPreferences() {
      try {
        this.preferences.master = this.clamp(localStorage.getItem(this.AUDIO_STORAGE_KEYS.master), 1);
        this.preferences.sfx = this.clamp(localStorage.getItem(this.AUDIO_STORAGE_KEYS.sfx), 1);
        this.preferences.muted = localStorage.getItem(this.AUDIO_STORAGE_KEYS.muted) === 'true';
      } catch (_) {}
    },
    savePreferences() {
      try {
        localStorage.setItem(this.AUDIO_STORAGE_KEYS.master, String(this.preferences.master));
        localStorage.setItem(this.AUDIO_STORAGE_KEYS.sfx, String(this.preferences.sfx));
        localStorage.setItem(this.AUDIO_STORAGE_KEYS.muted, String(this.preferences.muted));
      } catch (_) {}
    },
    applyPreferences() {
      if (!window.audioManager) return;
      if (typeof window.audioManager.setVolume === 'function') {
        window.audioManager.setVolume('master', this.preferences.master);
        window.audioManager.setVolume('sfx', this.preferences.sfx);
        window.audioManager.setVolume('music', 0.22);
      }
      if (typeof window.audioManager.setMuted === 'function') window.audioManager.setMuted(this.preferences.muted);
    },
    registerMusic() {
      if (this.musicOptional || this.musicRegistered || !window.audioManager?.registerMusicTrack) return;
      window.audioManager.registerMusicTrack(this.AUDIO_BACKGROUND_TRACK_ID, { manifestKey: this.AUDIO_BACKGROUND_MANIFEST_KEY });
      this.musicRegistered = true;
    },
    hasAtLeastOneLocalSource(manifestNode) {
      if (!manifestNode || !Array.isArray(manifestNode.sources)) return false;
      return manifestNode.sources.some((source) => {
        const url = source?.url;
        return typeof window.audioManager?.isLocalAudioUrl === 'function' && window.audioManager.isLocalAudioUrl(url);
      });
    },
    validateCriticalAudioIntegrity() {
      if (!window.audioManager?.getManifestNode) return { ok: false, errors: ['AudioManager no disponible para validación.'] };
      const errors = [];

      Object.entries(AUDIO_EVENT_CONFIG).forEach(([eventName, cfg]) => {
        const node = window.audioManager.getManifestNode(cfg.manifestKey);
        if (!this.hasAtLeastOneLocalSource(node)) {
          errors.push(`Evento crítico/sfx "${eventName}" sin fuente local utilizable (${cfg.manifestKey}).`);
        }
      });

      const musicNode = window.audioManager.getManifestNode(this.AUDIO_BACKGROUND_MANIFEST_KEY);
      this.musicOptional = !this.hasAtLeastOneLocalSource(musicNode);

      for (let n = 1; n <= 75; n += 1) {
        const expectedUrl = `/sonidos/${n}.wav`;
        if (typeof window.audioManager?.isLocalAudioUrl !== 'function' || !window.audioManager.isLocalAudioUrl(expectedUrl)) {
          errors.push(`Canto ${n} sin ruta local válida (${expectedUrl}).`);
          break;
        }
      }

      return { ok: errors.length === 0, errors };
    },
    registerBaseEvents() {
      if (!window.audioManager?.registerSfxEvent) return;
      this.registerMusic();
      Object.entries(AUDIO_EVENT_CONFIG).forEach(([name, cfg]) => {
        if (this.registeredEvents.has(name)) return;
        window.audioManager.registerSfxEvent(name, { manifestKey: cfg.manifestKey }, cfg);
        this.registeredEvents.add(name);
      });
    },
    registerCantoEvent(numero) {
      if (!window.audioManager?.registerSfxEvent) return null;
      const n = Number(numero);
      if (!Number.isInteger(n) || n < 1 || n > 75) return null;
      const eventName = `${this.AUDIO_CANTO_EVENT_PREFIX}${n}`;
      if (this.registeredEvents.has(eventName)) return eventName;
      window.audioManager.registerSfxEvent(eventName, { category: 'sfx', preferredFormats: ['wav'], normalizationGain: 1, sources: [{ format: 'wav', url: `/sonidos/${n}.wav` }] });
      this.registeredEvents.add(eventName);
      return eventName;
    },
    async init() {
      if (this.initialized) return true;
      if (this.initPromise) return this.initPromise;
      if (!window.audioManager) return false;
      this.initPromise = (async () => {
        this.registerBaseEvents();
        this.initDebugMode();
        const integrity = this.validateCriticalAudioIntegrity();
        if (!integrity.ok) {
          integrity.errors.forEach((msg) => console.error('[AudioIntegrity]', msg));
          throw new Error('Validación de integridad de audio falló. Revisa fuentes locales críticas en /sonidos.');
        }
        this.loadPreferences();
        this.applyPreferences();
        if (typeof window.audioManager.probeAutoplayState === 'function') { try { await window.audioManager.probeAutoplayState(); } catch (_) {} }
        this.initialized = true;
        return true;
      })().finally(() => { this.initPromise = null; });
      return this.initPromise;
    },
    async startMusic() {
      if (this.musicStarted || this.preferences.muted || !window.audioManager?.playMusic) return;
      this.registerMusic();
      try { await window.audioManager.playMusic(this.AUDIO_BACKGROUND_TRACK_ID, { fadeInMs: 1200 }); this.musicStarted = true; } catch (err) { if (!this.isBlockedError(err)) console.warn('No se pudo iniciar música.', err); }
    },
    async unlock() {
      if (!window.audioManager?.ensureRunningContext) return false;
      try {
        await window.audioManager.ensureRunningContext();
        await this.startMusic();
        await this.processQueue();
        return true;
      } catch (err) {
        if (!this.isBlockedError(err)) console.warn('No se pudo desbloquear audio.', err);
        return false;
      }
    },
    registerUnlockOnInteraction() {
      if (this.unlockRegistered) return;
      this.unlockRegistered = true;
      const h = () => { void this.unlock(); };
      window.addEventListener('pointerdown', h, { passive: true });
      window.addEventListener('keydown', h, { passive: true });
      window.addEventListener('touchstart', h, { passive: true });
    },
    async processQueue() {
      if (this.cantosProcessing || !this.cantoQueue.length || !window.audioManager?.playSfx) return;
      this.cantosProcessing = true;
      try {
        while (this.cantoQueue.length) {
          const numero = this.cantoQueue[0];
          const eventName = this.registerCantoEvent(numero);
          if (!eventName) { this.cantoQueue.shift(); continue; }
          try { await window.audioManager.playSfx(eventName); this.cantoQueue.shift(); }
          catch (err) { if (this.isBlockedError(err)) break; this.cantoQueue.shift(); }
        }
      } finally { this.cantosProcessing = false; }
    },
    enqueueCanto(numero) {
      const n = Number(numero);
      if (!Number.isInteger(n) || n < 1 || n > 75) return;
      void this.init();
      this.registerUnlockOnInteraction();
      this.cantoQueue.push(n);
      this.pushDebugRow('evento_encolado', { detail: `numero=${n}` });
      void this.processQueue();
    },
    async playCantoByInteraction(numero) {
      const n = Number(numero);
      if (!Number.isInteger(n) || n < 1 || n > 75) return;
      await this.init();
      this.registerUnlockOnInteraction();
      await this.unlock();
      const eventName = this.registerCantoEvent(n);
      if (!eventName || !window.audioManager?.playSfx) return;
      this.pushDebugRow('evento_recibido', { eventName, detail: `numero=${n}` });
      try { await window.audioManager.playSfx(eventName); } catch (err) { this.pushDebugRow('fallo_reproduccion', { eventName, reason: this.getFailureReason(err), error: err?.message || String(err) }); if (!this.isBlockedError(err)) console.warn('No se pudo reproducir audio.', err); this.enqueueCanto(n); }
    },
    async playEvent(eventName, options = {}) {
      if (!eventName || !window.audioManager?.playSfx) return;
      await this.init();
      this.registerUnlockOnInteraction();
      const throttleMs = Number(options?.throttleMs);
      if (!options?.force && Number.isFinite(throttleMs) && throttleMs > 0) {
        const now = this.nowMs();
        const last = Number(this.lastEventByName.get(eventName) || 0);
        if ((now - last) < throttleMs) return;
        this.lastEventByName.set(eventName, now);
      }
      try { await window.audioManager.playSfx(eventName); } catch (err) { if (!this.isBlockedError(err)) console.warn(`No se pudo reproducir ${eventName}`, err); }
    }
  };

  window.gameAudioOrchestrator = orchestrator;
})();
