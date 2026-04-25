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
      this.pendingPlayRequests = [];
      this.maxPendingPlayRequests = 40;
      this.debugEnabled = false;

      this.manifestStorageKey = 'bingoAudioManifestCache';
      this.manifest = null;
      this.defaultMaxSfxBytes = 262144;
      this.defaultMaxMusicBytes = 1048576;
    }

    setDebugEnabled(value) {
      this.debugEnabled = !!value;
    }

    logDebug(message, details = null) {
      if (!this.debugEnabled) return;
      if (details === null || typeof details === 'undefined') {
        console.info(`[AudioManager] ${message}`);
        return;
      }
      console.info(`[AudioManager] ${message}`, details);
    }

    logWarn(message, details = null) {
      if (details === null || typeof details === 'undefined') {
        console.warn(`[AudioManager] ${message}`);
        return;
      }
      console.warn(`[AudioManager] ${message}`, details);
    }

    enqueuePendingPlay(type, payload) {
      if (!type || !payload) return;
      this.pendingPlayRequests.push({ type, payload, at: Date.now() });
      if (this.pendingPlayRequests.length > this.maxPendingPlayRequests) {
        this.pendingPlayRequests.shift();
      }
      this.logDebug('Reproducción encolada por bloqueo/autoplay.', { type, payload, pending: this.pendingPlayRequests.length });
    }

    async flushPendingPlayRequests() {
      if (!this.pendingPlayRequests.length) return;
      const pending = this.pendingPlayRequests.splice(0);
      this.logDebug('Reintentando reproducciones encoladas.', { pending: pending.length });
      for (let i = 0; i < pending.length; i += 1) {
        const item = pending[i];
        if (!item || !item.type) continue;
        try {
          if (item.type === 'sfx' && item.payload?.eventName) {
            await this.playSfx(item.payload.eventName, { bypassQueueOnBlocked: true });
          }
          if (item.type === 'music' && item.payload?.trackId) {
            await this.playMusic(item.payload.trackId, { ...item.payload.options, bypassQueueOnBlocked: true });
          }
        } catch (err) {
          if (err?.code === 'AUDIO_CONTEXT_BLOCKED') {
            this.pendingPlayRequests.unshift(item);
            break;
          }
          this.logWarn('Falló reintento de reproducción en cola.', { item, err: String(err?.message || err) });
        }
      }
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

    isLocalAudioUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const value = url.trim();
      if (!value) return false;
      if (value.startsWith('/sonidos/')) return true;
      if (value.startsWith('sonidos/')) return true;

      let parsed;
      try {
        parsed = new URL(value, window.location?.origin || 'http://localhost');
      } catch (_) {
        return false;
      }
      if (!parsed) return false;

      const currentOrigin = window.location?.origin || '';
      if (currentOrigin && parsed.origin !== currentOrigin) return false;
      return /(^|\/)sonidos\/.+/i.test(parsed.pathname || '');
    }

    normalizeAudioUrl(url) {
      const value = String(url || '').trim();
      if (!value) return null;
      if (/^https?:\/\//i.test(value)) return value;
      if (value.startsWith('//')) {
        const protocol = window.location?.protocol || 'https:';
        return `${protocol}${value}`;
      }
      try {
        return new URL(value, window.location?.href || 'http://localhost/').toString();
      } catch (_) {
        return value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`;
      }
    }

    normalizeAudioCacheKey(url) {
      const normalized = this.normalizeAudioUrl(url);
      if (!normalized) return null;
      try {
        const parsed = new URL(normalized);
        const currentOrigin = window.location?.origin || '';
        if (currentOrigin && parsed.origin === currentOrigin) {
          return `${parsed.pathname}${parsed.search || ''}`;
        }
      } catch (_) {
        return normalized;
      }
      return normalized;
    }

    normalizeSourceDescriptor(source) {
      if (!source) return null;
      if (typeof source === 'string') {
        if (!this.isAllowedAudioUrl(source)) return null;
        return {
          urls: [this.normalizeAudioUrl(source)],
          preferredFormats: ['wav'],
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
            preferredFormats: manifestNode.preferredFormats || ['wav'],
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
        preferredFormats: source.preferredFormats || ['wav'],
        normalizationGain: Number.isFinite(source.normalizationGain) ? clamp(source.normalizationGain, 0.1, 2) : 1,
        category: source.category || 'sfx',
        maxBytes: Number.isFinite(source.maxBytes)
          ? Math.max(32 * 1024, Math.floor(source.maxBytes))
          : (source.category === 'music' ? this.defaultMaxMusicBytes : this.defaultMaxSfxBytes),
        preload: source.preload || null,
        preloadCritical: !!source.preloadCritical,
      };
    }
    
    isAllowedRemoteAudioUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const value = url.trim();
      if (!value) return false;

      let parsed;
      try {
        parsed = new URL(value, window.location?.origin || 'http://localhost');
      } catch (_) {
        return false;
      }

      if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) return false;
      if (!/^https?:/i.test(value)) return false;

      const manifestPolicy = this.getManifestNode('globalAudioPolicy');
      const allowedHosts = Array.isArray(manifestPolicy?.allowedRemoteHosts)
        ? manifestPolicy.allowedRemoteHosts.map((host) => String(host || '').trim().toLowerCase()).filter(Boolean)
        : [];

      if (!allowedHosts.length) return false;
      return allowedHosts.includes(String(parsed.hostname || '').toLowerCase());
    }

    isAllowedAudioUrl(url) {
      return this.isLocalAudioUrl(url) || this.isAllowedRemoteAudioUrl(url);
    }

    resolveSources(node = {}) {
      const preferredFormats = Array.isArray(node.preferredFormats) && node.preferredFormats.length
        ? node.preferredFormats
        : ['wav'];

      const candidates = [];
      if (Array.isArray(node.sources)) {
        node.sources.forEach((source) => {
          if (!source?.url || !this.isAllowedAudioUrl(source.url)) return;
          candidates.push({
            url: this.normalizeAudioUrl(source.url),
            format: (source.format || '').toLowerCase() || null,
          });
        });
      }

      if (node.urlPrimary && this.isAllowedAudioUrl(node.urlPrimary)) {
        candidates.push({ url: this.normalizeAudioUrl(node.urlPrimary), format: (node.formatPrimary || '').toLowerCase() || null });
      }
      if (node.urlFallback && this.isAllowedAudioUrl(node.urlFallback)) {
        candidates.push({ url: this.normalizeAudioUrl(node.urlFallback), format: (node.formatFallback || '').toLowerCase() || null });
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
        critical: !!options.critical,
        duckAmount: options.duckAmount,
        duckDurationMs: options.duckDurationMs,
        duckFadeMs: options.duckFadeMs,
      });
    }

    async init() {
      if (this.initialized && this.audioContext) return this.audioContext;
      if (this.pendingInitPromise) return this.pendingInitPromise;

      this.pendingInitPromise = (async () => {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) throw new Error('AudioContext no disponible en este navegador.');

        this.audioContext = new AudioContextCtor();
        this.masterGain = this.audioContext.createGain();
        this.musicGain = this.audioContext.createGain();
        this.sfxGain = this.audioContext.createGain();

        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.audioContext.destination);

        this.applyGains();

        this.initialized = true;
        this.pendingInitPromise = null;
        return this.audioContext;
      })().catch((err) => {
        this.pendingInitPromise = null;
        throw err;
      });

      return this.pendingInitPromise;
    }

    async probeAutoplayState() {
      let blocked = false;

      try {
        await this.ensureRunningContext();
      } catch (_) {
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

    createBlockedAudioError() {
      const error = new Error('El contexto de audio sigue bloqueado tras intentar reanudarlo.');
      error.code = 'AUDIO_CONTEXT_BLOCKED';
      return error;
    }

    async ensureRunningContext() {
      await this.init();

      if (this.audioContext.state !== 'running') {
        try {
          await this.audioContext.resume();
        } catch (_) {}
      }

      const running = this.audioContext.state === 'running';
      this.autoplayBlocked = !running;

      if (!running) {
        throw this.createBlockedAudioError();
      }

      if (this.pendingPlayRequests.length) {
        await this.flushPendingPlayRequests();
      }

      return true;
    }

    isAutoplayBlocked() {
      return !!this.autoplayBlocked;
    }

    async fetchAndDecode(src, descriptor = null) {
      if (!this.isAllowedAudioUrl(src)) {
        throw new Error(`Origen de audio no permitido: ${src}`);
      }
      if (!this.audioContext) {
        await this.init();
      }

      const response = await fetch(this.normalizeAudioUrl(src));
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
      const cacheKey = this.normalizeAudioCacheKey(src);
      if (cacheKey) this.buffers.set(cacheKey, decoded);
      return decoded;
    }

    async loadBufferBySource(source) {
      const descriptor = this.normalizeSourceDescriptor(source);
      if (!descriptor?.urls?.length) return null;

      const urls = descriptor.urls;

      for (let i = 0; i < urls.length; i += 1) {
        const url = urls[i];
        const cacheKey = this.normalizeAudioCacheKey(url);
        if (cacheKey && this.buffers.has(cacheKey)) {
          if (urls[0]) {
            const primaryCacheKey = this.normalizeAudioCacheKey(urls[0]);
            if (primaryCacheKey && !this.buffers.has(primaryCacheKey)) {
              this.buffers.set(primaryCacheKey, this.buffers.get(cacheKey));
            }
          }
          return this.buffers.get(cacheKey);
        }

        try {
          const decoded = await this.fetchAndDecode(url, descriptor);
          if (urls[0] && url !== urls[0]) {
            const primaryCacheKey = this.normalizeAudioCacheKey(urls[0]);
            if (primaryCacheKey) {
              this.buffers.set(primaryCacheKey, decoded);
            }
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
      const bypassQueueOnBlocked = !!options.bypassQueueOnBlocked;

      const sourceDescriptor = this.musicTracks.get(trackId);
      if (!sourceDescriptor) return;

      try {
        await this.ensureRunningContext();
      } catch (err) {
        if (!bypassQueueOnBlocked && err?.code === 'AUDIO_CONTEXT_BLOCKED') {
          this.enqueuePendingPlay('music', { trackId, options: { fadeInMs } });
        }
        throw err;
      }
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

      await this.ensureRunningContext();
      source.start(0);
      this.currentMusicSource = source;
    }

    async playSfx(eventName, options = {}) {
      if (!eventName) return;
      const eventConfig = this.sfxEvents.get(eventName);
      if (!eventConfig) return;
      if (this.activeSfxNodes.size >= this.maxSfxConcurrency) return;
      const bypassQueueOnBlocked = !!options.bypassQueueOnBlocked;

      try {
        await this.ensureRunningContext();
      } catch (err) {
        if (!bypassQueueOnBlocked && err?.code === 'AUDIO_CONTEXT_BLOCKED') {
          this.enqueuePendingPlay('sfx', { eventName });
        }
        throw err;
      }
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

      await this.ensureRunningContext();
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
