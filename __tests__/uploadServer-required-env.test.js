jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn()
}));

describe('uploadServer variables requeridas', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('requiredEnv solo incluye variables realmente obligatorias para arrancar', () => {
    const { requiredEnv } = require('../uploadServer.js');

    expect(requiredEnv).toEqual(['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_STORAGE_BUCKET']);
    expect(requiredEnv).not.toContain('SENDGRID_API_KEY');
  });

  test('getMissingRequiredEnv reporta únicamente variables obligatorias faltantes', () => {
    const { getMissingRequiredEnv } = require('../uploadServer.js');

    const missing = getMissingRequiredEnv({
      GOOGLE_APPLICATION_CREDENTIALS: '/tmp/serviceAccountKey.json'
    });

    expect(missing).toEqual(['FIREBASE_STORAGE_BUCKET']);
  });

  test('validateRequiredEnv falla solo si falta una variable realmente requerida', () => {
    const { validateRequiredEnv } = require('../uploadServer.js');
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      validateRequiredEnv({
        GOOGLE_APPLICATION_CREDENTIALS: '/tmp/serviceAccountKey.json'
      })
    ).toThrow('process.exit');

    expect(errorSpy).toHaveBeenCalledWith(
      'Faltan variables de entorno requeridas para uploadServer: FIREBASE_STORAGE_BUCKET'
    );

    expect(() =>
      validateRequiredEnv({
        GOOGLE_APPLICATION_CREDENTIALS: '/tmp/serviceAccountKey.json',
        FIREBASE_STORAGE_BUCKET: 'demo.appspot.com'
      })
    ).not.toThrow();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

});
