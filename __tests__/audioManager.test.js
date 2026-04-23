const fs = require('fs');
const path = require('path');
const vm = require('vm');

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
  }

  async resume() {
    this.state = 'running';
  }

  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime(v) { this.value = v; },
        cancelScheduledValues() {},
        linearRampToValueAtTime(v) { this.value = v; },
      },
      connect() {},
      disconnect() {},
    };
  }

  createBuffer() {
    return {};
  }

  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      onended: null,
      connect() {},
      disconnect() {},
      start: jest.fn(),
      stop: jest.fn(),
    };
  }

  async decodeAudioData() {
    return { duration: 1 };
  }
}

describe('AudioManager autoplay queue', () => {
  let AudioManager;
  let runtimeWindow;

  beforeAll(() => {
    runtimeWindow = {
      AudioContext: FakeAudioContext,
      webkitAudioContext: FakeAudioContext,
      setTimeout,
      clearTimeout,
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'public/js/audioManager.js'), 'utf8');
    vm.runInNewContext(source, {
      window: runtimeWindow,
      console,
      setTimeout,
      clearTimeout,
      fetch: jest.fn(),
      localStorage: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
      },
      Date,
    });
    AudioManager = runtimeWindow.AudioManager;
  });

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('encola SFX cuando el contexto está bloqueado', async () => {
    const manager = new AudioManager();
    manager.registerSfxEvent('DRAW', { sources: [{ format: 'wav', url: '/sonidos/1.wav' }] });

    jest.spyOn(manager, 'ensureRunningContext').mockRejectedValueOnce(manager.createBlockedAudioError());

    await expect(manager.playSfx('DRAW')).rejects.toMatchObject({ code: 'AUDIO_CONTEXT_BLOCKED' });
    expect(manager.pendingPlayRequests).toHaveLength(1);
    expect(manager.pendingPlayRequests[0]).toMatchObject({ type: 'sfx', payload: { eventName: 'DRAW' } });
  });

  test('reintenta cola de SFX al desbloquear contexto', async () => {
    const manager = new AudioManager();
    await manager.init();
    manager.registerSfxEvent('DRAW', { sources: [{ format: 'wav', url: '/sonidos/1.wav' }] });

    manager.pendingPlayRequests.push({ type: 'sfx', payload: { eventName: 'DRAW' }, at: Date.now() });
    jest.spyOn(manager, 'loadBufferBySource').mockResolvedValue({ duration: 1 });

    await manager.ensureRunningContext();

    expect(manager.pendingPlayRequests).toHaveLength(0);
    expect(manager.activeSfxNodes.size).toBe(1);
  });
});
