const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFlags(search = '', globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public/js/liveAudioFeatureFlags.js'), 'utf8');
  const context = {
    window: {
      location: { search },
      ...globals,
    },
    URLSearchParams,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.liveAudioFeatureFlags;
}

describe('liveAudioFeatureFlags', () => {
  test('usa modo legacy por defecto', () => {
    const flags = loadFlags('');
    expect(flags.getMode()).toBe('legacy');
  });

  test('activa modo stream por global flag', () => {
    const flags = loadFlags('', { __AUDIO_STREAMING_ENABLED__: true });
    expect(flags.getMode()).toBe('stream');
  });

  test('query param puede forzar fallback legacy', () => {
    const flags = loadFlags('?audioStreaming=1&audioStreamingLegacy=1', { __AUDIO_STREAMING_ENABLED__: true });
    expect(flags.getMode()).toBe('legacy');
  });
});
