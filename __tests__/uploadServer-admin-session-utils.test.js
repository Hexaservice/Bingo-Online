jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn()
}));

describe('uploadServer utilidades de sesión administrativa', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('hashValue genera hash estable y no expone el valor plano', () => {
    process.env.ADMIN_SESSION_HASH_SALT = 'test-salt';
    const { hashValue } = require('../uploadServer.js');

    const hashA = hashValue('127.0.0.1');
    const hashB = hashValue('127.0.0.1');
    const hashC = hashValue('127.0.0.2');

    expect(hashA).toHaveLength(64);
    expect(hashA).toEqual(hashB);
    expect(hashA).not.toEqual(hashC);
    expect(hashA).not.toContain('127.0.0.1');
  });

  test('getClientIp prioriza x-forwarded-for', () => {
    const { getClientIp } = require('../uploadServer.js');

    const fromForwarded = getClientIp({
      headers: { 'x-forwarded-for': '201.20.10.1, 10.10.0.2' },
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.2' }
    });

    const fromFallback = getClientIp({
      headers: {},
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.2' }
    });

    expect(fromForwarded).toBe('201.20.10.1');
    expect(fromFallback).toBe('10.0.0.1');
  });


  test('approximateIp anonimiza IPv4 e IPv6', () => {
    const { approximateIp } = require('../uploadServer.js');

    expect(approximateIp('201.20.10.35')).toBe('201.20.10.0');
    expect(approximateIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3::');
    expect(approximateIp('')).toBe('unknown');
  });

  test('getAuthTimeFromToken usa iat cuando está presente', () => {
    const { getAuthTimeFromToken } = require('../uploadServer.js');

    expect(getAuthTimeFromToken({ iat: 1700000000 })).toBe(1700000000000);

    const nowBased = getAuthTimeFromToken({});
    expect(typeof nowBased).toBe('number');
    expect(nowBased).toBeGreaterThan(0);
  });
});
