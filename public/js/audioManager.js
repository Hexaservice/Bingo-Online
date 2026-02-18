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
      this.autoplayBlocked = false;
      this.autoplayProbeDone = false;

      this.manifestStorageKey = 'bingoAudioManifestCache';
      this.manifest = null;
      this.defaultMaxSfxBytes = 120 * 1024;
      this.defaultMaxMusicBytes = 1024 * 1024;
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

    resolveSources(node = {}) {
      const preferredFormats = Array.isArray(node.preferredFormats) && node.preferredFormats.length
        ? node.preferredFormats
        : ['mp3', 'ogg'];

      const candidates = [];
      if (Array.isArray(node.sources)) {
        node.sources.forEach((source) => {
          if (source?.url) {
            candidates.push({
              url: source.url,
              format: (source.format || '').toLowerCase() || null,
              kind: source.kind || null,
            });
          }
        });
      }

      if (node.urlPrimary) {
        candidates.push({ url: node.urlPrimary, format: (node.formatPrimary || '').toLowerCase() || null, kind: 'primary' });
      }
      if (node.urlFallback) {
        candidates.push({ url: node.urlFallback, format: (node.formatFallback || '').toLowerCase() || null, kind: 'fallback' });
      }

      const dedup = new Set();
      const ordered = [];

      preferredFormats.forEach((format) => {
        candidates.forEach((candidate) => {
          if (!candidate?.url || dedup.has(candidate.url)) return;
          if (candidate.format && candidate.format !== format) return;
          dedup.add(candidate.url);
          ordered.push(candidate.url);
        });
      });

      candidates.forEach((candidate) => {
        if (!candidate?.url || dedup.has(candidate.url)) return;
        dedup.add(candidate.url);
        ordered.push(candidate.url);
      });

      return ordered;
    }

    normalizeSourceDescriptor(source) {
      if (!source) return null;
      if (typeof source === 'string') {
        return {
          urls: [source],
          preferredFormats: ['mp3', 'ogg'],
          normalizationGain: 1,
          category: 'sfx',
          maxBytes: this.defaultMaxSfxBytes,
        };
      }

      if (source.manifestKey) {
        const manifestNode = this.getManifestNode(source.manifestKey);
        if (manifestNode) {
          return {
            urls: this.resolveSources(manifestNode),
            preferredFormats: manifestNode.preferredFormats || ['mp3', 'ogg'],
            license: manifestNode.license || null,
            attribution: manifestNode.attribution || null,
            normalizationGain: Number.isFinite(manifestNode.normalizationGain)
              ? clamp(manifestNode.normalizationGain, 0.1, 2)
              : 1,
            category: manifestNode.category || source.category || 'sfx',
            maxBytes: Number.isFinite(manifestNode.maxBytes)
              ? Math.max(32 * 1024, Math.floor(manifestNode.maxBytes))
              : (manifestNode.category === 'music' ? this.defaultMaxMusicBytes : this.defaultMaxSfxBytes),
            preload: manifestNode.preload || source.preload || null,
            preloadCritical: !!manifestNode.preloadCritical,
          };
        }
      }

      const urls = this.resolveSources(source);
      return {
        urls,
        preferredFormats: source.preferredFormats || ['mp3', 'ogg'],
        license: source.license || null,
        attribution: source.attribution || null,
        normalizationGain: Number.isFinite(source.normalizationGain) ? clamp(source.normalizationGain, 0.1, 2) : 1,
        category: source.category || 'sfx',
        maxBytes: Number.isFinite(source.maxBytes)
          ? Math.max(32 * 1024, Math.floor(source.maxBytes))
          : (source.category === 'music' ? this.defaultMaxMusicBytes : this.defaultMaxSfxBytes),
        preload: source.preload || null,
        preloadCritical: !!source.preloadCritical,
      };
    }

    registerMusicTrack(trackId, source) {
      if (!trackId || !source) return;
      const descriptor = this.normalizeSourceDescriptor(source);
      if (!descriptor?.urls?.length) return;
      this.musicTracks.set(trackId, descriptor);
    }

    registerSfxEvent(eventName, source, options = {}) {
      if (!eventName || !source) return;
      const descriptor = this.normalizeSourceDescriptor(source);
      if (!descriptor?.urls?.length) return;
      this.sfxEvents.set(eventName, {
        source: descriptor,
        critical: !!options.critical || !!descriptor.preloadCritical,
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

        await this.tryAutoplayUnlock();
        this.initialized = true;
      })();

      try {
        await this.pendingInitPromise;
      } finally {
        this.pendingInitPromise = null;
      }
    }

    async tryAutoplayUnlock() {
      if (!this.audioContext) return false;

      let blocked = false;

      if (this.audioContext.state !== 'running') {
        try {
          await this.audioContext.resume();
        } catch (_) {
          blocked = true;
        }
      }

      if (this.audioContext.state !== 'running') {
        blocked = true;
      }

      if (!blocked && !this.autoplayProbeDone) {
        this.autoplayProbeDone = true;
        try {
          const probeGain = this.audioContext.createGain();
          probeGain.gain.value = 0;
          probeGain.connect(this.audioContext.destination);
          const probeSource = this.audioContext.createBufferSource();
          probeSource.buffer = this.audioContext.createBuffer(1, 1, this.audioContext.sampleRate || 44100);
          probeSource.connect(probeGain);
          probeSource.start(0);
          probeSource.stop(this.audioContext.currentTime + 0.01);
        } catch (_) {
          blocked = true;
        }
      }

      this.autoplayBlocked = blocked;
      return !blocked;
    }

    isAutoplayBlocked() {
      return !!this.autoplayBlocked;
    }

    async fetchAndDecode(src, descriptor = null) {
      if (!this.audioContext) {
        await this.init();
      }

      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`No se pudo descargar audio: ${src}`);
      }

      const maxBytes = Number.isFinite(descriptor?.maxBytes)
        ? descriptor.maxBytes
        : (descriptor?.category === 'music' ? this.defaultMaxMusicBytes : this.defaultMaxSfxBytes);
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error(`Audio supera límite recomendado (${contentLength} > ${maxBytes}): ${src}`);
      }

      const data = await response.arrayBuffer();
      if (data.byteLength > maxBytes) {
        throw new Error(`Audio supera límite recomendado (${data.byteLength} > ${maxBytes}): ${src}`);
      }

      const decoded = await this.audioContext.decodeAudioData(data);
      this.buffers.set(src, decoded);
      return decoded;
    }

    async loadBufferBySource(source) {
      const descriptor = this.normalizeSourceDescriptor(source);
      if (!descriptor?.urls?.length) return null;

      const urls = descriptor.urls;

      for (let i = 0; i < urls.length; i += 1) {
        const url = urls[i];
        if (this.buffers.has(url)) {
          if (urls[0] && !this.buffers.has(urls[0])) {
            this.buffers.set(urls[0], this.buffers.get(url));
          }
          return this.buffers.get(url);
        }

        try {
          const decoded = await this.fetchAndDecode(url, descriptor);
          if (urls[0] && url !== urls[0]) {
            this.buffers.set(urls[0], decoded);
          }
          return decoded;
        } catch (err) {
          if (i === urls.length - 1) {
            throw err;
          }
        }
      }

      return null;
    }

    async preloadCriticalSfx() {
      const criticalSources = [];
      this.sfxEvents.forEach((config) => {
        if (config?.critical && config?.source) {
          criticalSources.push(config.source);
        }
      });

      const uniqueKeys = new Set();
      const jobs = criticalSources
        .filter((source) => {
          const key = source.urls?.[0] || '';
          if (!key || uniqueKeys.has(key)) return false;
          uniqueKeys.add(key);
          return true;
        })
        .map((source) => this.loadBufferBySource(source).catch(() => null));

      await Promise.all(jobs);
    }

    async playMusic(trackId, options = {}) {
      if (!trackId) return;
      this.currentMusicTrackId = trackId;
      const fadeInMs = Number.isFinite(options.fadeInMs) ? Math.max(0, options.fadeInMs) : 0;

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

      const sourceGain = this.audioContext.createGain();
      sourceGain.gain.value = Number.isFinite(sourceDescriptor.normalizationGain)
        ? sourceDescriptor.normalizationGain
        : 1;
      source.connect(sourceGain);
      sourceGain.connect(this.musicGain);

      if (fadeInMs > 0) {
        const now = this.audioContext.currentTime;
        const targetGain = this.muted ? 0 : this.musicVolume;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setValueAtTime(0, now);
        this.musicGain.gain.linearRampToValueAtTime(targetGain, now + fadeInMs / 1000);
      }

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

      const sourceGain = this.audioContext.createGain();
      sourceGain.gain.value = Number.isFinite(eventConfig.source.normalizationGain)
        ? eventConfig.source.normalizationGain
        : 1;
      source.connect(sourceGain);
      sourceGain.connect(this.sfxGain);

      this.activeSfxNodes.add(source);
      source.onended = () => {
        this.activeSfxNodes.delete(source);
        source.disconnect();
        sourceGain.disconnect();
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
