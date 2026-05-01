(function () {
  const CHANNEL_NAME = 'bingo-audio-session';
  const STORAGE_KEY = 'bingo:audioSessionState:v1';
  const DEFAULT_STATE = Object.freeze({
    unlockedPages: {},
    preferences: { master: 1, sfx: 1, muted: false },
    lastSequence: 0,
    activePage: '',
    fallbackMode: 'normal',
    updatedAt: 0,
  });

  function safeNow() { return Date.now(); }
  function isFinite01(v, fallback) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback; }

  const service = {
    pageId: 'unknown',
    channel: null,
    state: JSON.parse(JSON.stringify(DEFAULT_STATE)),
    listeners: new Set(),

    init(pageId) {
      this.pageId = String(pageId || 'unknown');
      this.readStorage();
      this.state.activePage = this.pageId;
      this.touch();
      this.setupChannel();
      this.persistAndBroadcast();
      return this.state;
    },
    setupChannel() {
      if (this.channel || typeof BroadcastChannel === 'undefined') return;
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (evt) => this.receiveExternalState(evt?.data);
      } catch (_) { this.channel = null; }
      window.addEventListener('storage', (ev) => {
        if (ev.key === STORAGE_KEY && ev.newValue) {
          try { this.receiveExternalState(JSON.parse(ev.newValue)); } catch (_) {}
        }
      });
    },
    onChange(cb) { if (typeof cb === 'function') this.listeners.add(cb); },
    emit() { this.listeners.forEach((cb) => { try { cb(this.state); } catch (_) {} }); },
    touch() { this.state.updatedAt = safeNow(); },
    readStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        this.state = { ...this.state, ...parsed, preferences: { ...this.state.preferences, ...(parsed.preferences || {}) }, unlockedPages: { ...(parsed.unlockedPages || {}) } };
      } catch (_) {}
    },
    receiveExternalState(next) {
      if (!next || typeof next !== 'object') return;
      const nextUpdatedAt = Number(next.updatedAt) || 0;
      if (nextUpdatedAt < (Number(this.state.updatedAt) || 0)) return;
      this.state = { ...this.state, ...next, preferences: { ...this.state.preferences, ...(next.preferences || {}) }, unlockedPages: { ...(next.unlockedPages || {}) } };
      this.emit();
    },
    persistAndBroadcast() {
      this.touch();
      const payload = JSON.stringify(this.state);
      try { localStorage.setItem(STORAGE_KEY, payload); } catch (_) {}
      try { if (this.channel) this.channel.postMessage(this.state); } catch (_) {}
      this.emit();
    },
    markUnlocked() {
      this.state.unlockedPages[this.pageId] = true;
      this.persistAndBroadcast();
    },
    isCurrentPageUnlocked() { return !!this.state.unlockedPages[this.pageId]; },
    updatePreferences(preferences) {
      if (!preferences || typeof preferences !== 'object') return;
      this.state.preferences = {
        master: isFinite01(preferences.master, this.state.preferences.master),
        sfx: isFinite01(preferences.sfx, this.state.preferences.sfx),
        muted: !!preferences.muted,
      };
      this.persistAndBroadcast();
    },
    setLastSequence(sequence) {
      const seq = Number(sequence);
      if (!Number.isInteger(seq) || seq <= 0) return;
      if (seq <= (Number(this.state.lastSequence) || 0)) return;
      this.state.lastSequence = seq;
      this.persistAndBroadcast();
    },
    getLastSequence() { return Number(this.state.lastSequence) || 0; },
    setFallbackMode(mode) {
      this.state.fallbackMode = mode === 'juegoactivo_only' ? 'juegoactivo_only' : 'normal';
      this.persistAndBroadcast();
    }
  };

  window.audioSessionService = service;
})();
