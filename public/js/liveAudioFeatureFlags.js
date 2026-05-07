(function () {
  const DEFAULTS = Object.freeze({
    streamingEnabled: false,
    forceLegacyFallback: false,
  });

  function parseBoolean(raw, fallback) {
    if (raw === true || raw === 'true' || raw === '1' || raw === 1) return true;
    if (raw === false || raw === 'false' || raw === '0' || raw === 0) return false;
    return fallback;
  }

  function fromGlobal(name, fallback) {
    if (typeof window[name] === 'undefined') return fallback;
    return parseBoolean(window[name], fallback);
  }

  function fromQueryParam(name, fallback) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (!params.has(name)) return fallback;
      return parseBoolean(params.get(name), fallback);
    } catch (_) {
      return fallback;
    }
  }

  function isStreamingEnabled() {
    const base = fromGlobal('__AUDIO_STREAMING_ENABLED__', DEFAULTS.streamingEnabled);
    return fromQueryParam('audioStreaming', base);
  }

  function isForceLegacyFallback() {
    const base = fromGlobal('__AUDIO_STREAMING_FORCE_FALLBACK__', DEFAULTS.forceLegacyFallback);
    return fromQueryParam('audioStreamingLegacy', base);
  }

  function getMode() {
    if (isForceLegacyFallback()) return 'legacy';
    return isStreamingEnabled() ? 'stream' : 'legacy';
  }

  window.liveAudioFeatureFlags = {
    isStreamingEnabled,
    isForceLegacyFallback,
    getMode,
  };
})();
