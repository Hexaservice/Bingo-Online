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
    }

    registerMusicTrack(trackId, src) {
      if (!trackId || !src) return;
      this.musicTracks.set(trackId, src);
    }

    registerSfxEvent(eventName, src, options = {}) {
      if (!eventName || !src) return;
      this.sfxEvents.set(eventName, {
        src,
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

    async loadBufferBySrc(src) {
      if (!src) return null;
      if (this.buffers.has(src)) {
        return this.buffers.get(src);
      }

      if (!this.audioContext) {
        await this.init();
      }

      const response = await fetch(src);
      const data = await response.arrayBuffer();
      const decoded = await this.audioContext.decodeAudioData(data);
      this.buffers.set(src, decoded);
      return decoded;
    }

    async playMusic(trackId) {
      if (!trackId) return;
      this.currentMusicTrackId = trackId;

      const src = this.musicTracks.get(trackId);
      if (!src) return;

      await this.init();
      const buffer = await this.loadBufferBySrc(src);
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
      const buffer = await this.loadBufferBySrc(eventConfig.src);
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
