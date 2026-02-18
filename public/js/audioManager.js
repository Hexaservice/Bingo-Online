(function () {
  const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

  class AudioManager {
    constructor(options = {}) {
      this.maxSfxConcurrency = Number.isFinite(options.maxSfxConcurrency)
        ? Math.max(1, Math.floor(options.maxSfxConcurrency))
        : 6;

      this.masterVolume = 1;
      this.musicVolume = 0.22;
      this.sfxVolume = 1;
      this.muted = false;

      this.audioContext = null;
      this.masterGain = null;
      this.musicGain = null;
      this.sfxGain = null;

      this.buffers = new Map();
      this.musicTracks = new Map();
      this.sfxEvents = new Map();
      this.activeSfxNodes = new Set();

      this.currentMusicTrackId = null;
      this.currentMusicSource = null;
      this.musicDuckToken = 0;
      this.initialized = false;
      this.pendingInitPromise = null;

      this.manifestStorageKey = 'bingoAudioManifestCache';
      this.manifest = null;
    }

    getCachedManifest() {
      try {
        const raw = localStorage.getItem(this.manifestStorageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.manifestVersion) return null;
        return parsed;
      } catch (_) {
        return null;
      }
    }

    setCachedManifest(manifest) {
      if (!manifest || !manifest.manifestVersion) return;
      try {
        localStorage.setItem(this.manifestStorageKey, JSON.stringify(manifest));
      } catch (_) {}
    }

    loadManifest() {
      if (this.manifest) return this.manifest;

      const runtimeManifest = window.BINGO_AUDIO_MANIFEST;
      const cachedManifest = this.getCachedManifest();

      if (runtimeManifest?.manifestVersion) {
        this.manifest = runtimeManifest;
        if (cachedManifest?.manifestVersion !== runtimeManifest.manifestVersion) {
          this.setCachedManifest(runtimeManifest);
        }
        return this.manifest;
      }

      this.manifest = cachedManifest || null;
      return this.manifest;
    }

    getManifestNode(path) {
      if (!path) return null;
      const manifest = this.loadManifest();
      if (!manifest) return null;
      return String(path)
        .split('.')
        .reduce((acc, segment) => (acc && acc[segment] ? acc[segment] : null), manifest);
    }

    normalizeSourceDescriptor(source) {
      if (!source) return null;
      if (typeof source === 'string') {
        return {
          urlPrimary: source,
          urlFallback: null,
        };
      }

      if (source.manifestKey) {
        const manifestNode = this.getManifestNode(source.manifestKey);
        if (manifestNode) {
          return {
            urlPrimary: manifestNode.urlPrimary || null,
            urlFallback: manifestNode.urlFallback || null,
            license: manifestNode.license || null,
            attribution: manifestNode.attribution || null,
          };
        }
      }

      return {
        urlPrimary: source.urlPrimary || source.src || null,
        urlFallback: source.urlFallback || null,
        license: source.license || null,
        attribution: source.attribution || null,
      };
    }

    registerMusicTrack(trackId, source) {
      if (!trackId || !source) return;
      const descriptor = this.normalizeSourceDescriptor(source);
      if (!descriptor?.urlPrimary) return;
      this.musicTracks.set(trackId, descriptor);
    }

    registerSfxEvent(eventName, source, options = {}) {
      if (!eventName || !source) return;
      const descriptor = this.normalizeSourceDescriptor(source);
      if (!descriptor?.urlPrimary) return;
      this.sfxEvents.set(eventName, {
        source: descriptor,
        critical: !!options.critical,
        duckAmount: Number.isFinite(options.duckAmount) ? clamp(options.duckAmount, 0.05, 1) : 0.35,
        duckDurationMs: Number.isFinite(options.duckDurationMs) ? Math.max(120, options.duckDurationMs) : 1800,
        duckFadeMs: Number.isFinite(options.duckFadeMs) ? Math.max(50, options.duckFadeMs) : 220,
      });
    }

    async init() {
      if (this.initialized && this.audioContext) {
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        return;
      }

      if (this.pendingInitPromise) {
        await this.pendingInitPromise;
        return;
      }

      this.pendingInitPromise = (async () => {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
          throw new Error('Web Audio API no soportada en este navegador.');
        }

        this.audioContext = new AudioContextCtor();
        this.masterGain = this.audioContext.createGain();
        this.musicGain = this.audioContext.createGain();
        this.sfxGain = this.audioContext.createGain();

        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.audioContext.destination);

        this.applyGains();

        const unlock = () => {
          this.init().catch(() => {});
        };

        ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
          document.addEventListener(eventName, unlock, { once: true });
        });

        this.initialized = true;

        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
      })();

      try {
        await this.pendingInitPromise;
      } finally {
        this.pendingInitPromise = null;
      }
    }

    async fetchAndDecode(src) {
      if (!this.audioContext) {
        await this.init();
      }

      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`No se pudo descargar audio: ${src}`);
      }
      const data = await response.arrayBuffer();
      const decoded = await this.audioContext.decodeAudioData(data);
      this.buffers.set(src, decoded);
      return decoded;
    }

    async loadBufferBySource(source) {
      const descriptor = this.normalizeSourceDescriptor(source);
      if (!descriptor?.urlPrimary) return null;

      const { urlPrimary, urlFallback } = descriptor;

      if (this.buffers.has(urlPrimary)) {
        return this.buffers.get(urlPrimary);
      }

      try {
        return await this.fetchAndDecode(urlPrimary);
      } catch (primaryError) {
        if (!urlFallback) {
          throw primaryError;
        }

        if (this.buffers.has(urlFallback)) {
          return this.buffers.get(urlFallback);
        }

        const fallbackBuffer = await this.fetchAndDecode(urlFallback);
        this.buffers.set(urlPrimary, fallbackBuffer);
        return fallbackBuffer;
      }
    }

    async playMusic(trackId) {
      if (!trackId) return;
      this.currentMusicTrackId = trackId;

      const sourceDescriptor = this.musicTracks.get(trackId);
      if (!sourceDescriptor) return;

      await this.init();
      const buffer = await this.loadBufferBySource(sourceDescriptor);
      if (!buffer) return;

      if (this.currentMusicSource) {
        try {
          this.currentMusicSource.stop();
        } catch (_) {}
        this.currentMusicSource.disconnect();
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.musicGain);
      source.start(0);
      this.currentMusicSource = source;
    }

    async playSfx(eventName) {
      if (!eventName) return;
      const eventConfig = this.sfxEvents.get(eventName);
      if (!eventConfig) return;
      if (this.activeSfxNodes.size >= this.maxSfxConcurrency) return;

      await this.init();
      const buffer = await this.loadBufferBySource(eventConfig.source);
      if (!buffer) return;

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.sfxGain);

      this.activeSfxNodes.add(source);
      source.onended = () => {
        this.activeSfxNodes.delete(source);
        source.disconnect();
      };

      source.start(0);

      if (eventConfig.critical || this.isCriticalEvent(eventName)) {
        this.duckMusicTemporarily(eventConfig);
      }
    }

    isCriticalEvent(eventName) {
      const normalized = String(eventName || '').toLowerCase();
      return normalized.includes('winner') || normalized.includes('ganador') || normalized.includes('win');
    }

    duckMusicTemporarily(config = {}) {
      if (!this.audioContext || !this.musicGain) return;
      const durationMs = Number.isFinite(config.duckDurationMs) ? config.duckDurationMs : 1800;
      const fadeMs = Number.isFinite(config.duckFadeMs) ? config.duckFadeMs : 220;
      const duckAmount = Number.isFinite(config.duckAmount) ? clamp(config.duckAmount, 0.05, 1) : 0.35;

      const token = ++this.musicDuckToken;
      const now = this.audioContext.currentTime;
      const fadeSeconds = fadeMs / 1000;
      const targetDuckGain = this.muted ? 0 : this.getEffectiveMusicGain() * duckAmount;
      const restoreGain = this.muted ? 0 : this.getEffectiveMusicGain();

      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(targetDuckGain, now + fadeSeconds);

      setTimeout(() => {
        if (token !== this.musicDuckToken || !this.audioContext || !this.musicGain) return;
        const restoreNow = this.audioContext.currentTime;
        this.musicGain.gain.cancelScheduledValues(restoreNow);
        this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, restoreNow);
        this.musicGain.gain.linearRampToValueAtTime(restoreGain, restoreNow + fadeSeconds);
      }, durationMs);
    }

    setVolume(type, value) {
      const normalized = clamp(Number(value));
      if (!Number.isFinite(normalized)) return;

      if (type === 'master') this.masterVolume = normalized;
      if (type === 'music') this.musicVolume = normalized;
      if (type === 'sfx') this.sfxVolume = normalized;

      this.applyGains();
    }

    toggleMute() {
      this.muted = !this.muted;
      this.applyGains();
      return this.muted;
    }

    setMuted(value) {
      this.muted = !!value;
      this.applyGains();
    }

    getEffectiveMusicGain() {
      return this.masterVolume * this.musicVolume;
    }

    getEffectiveSfxGain() {
      return this.masterVolume * this.sfxVolume;
    }

    applyGains() {
      if (!this.masterGain || !this.musicGain || !this.sfxGain) return;
      const safeNow = this.audioContext ? this.audioContext.currentTime : 0;
      const master = this.muted ? 0 : this.masterVolume;
      const music = this.muted ? 0 : this.musicVolume;
      const sfx = this.muted ? 0 : this.sfxVolume;

      this.masterGain.gain.setValueAtTime(master, safeNow);
      this.musicGain.gain.setValueAtTime(music, safeNow);
      this.sfxGain.gain.setValueAtTime(sfx, safeNow);
    }
  }

  window.AudioManager = AudioManager;
  window.audioManager = window.audioManager || new AudioManager();
})();
