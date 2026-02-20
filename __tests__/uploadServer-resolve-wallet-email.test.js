jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn()
}));

describe('resolveCanonicalWalletEmail', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('prioriza normalizedEmail válido sin consultar fuentes externas', async () => {
    const { resolveCanonicalWalletEmail } = require('../uploadServer.js');
    const db = { collection: jest.fn() };
    const auth = { getUser: jest.fn() };

    const email = await resolveCanonicalWalletEmail({
      db,
      auth,
      normalizedEmail: 'Jugador@Test.COM',
      normalizedUserId: 'uid-1',
      cartonData: {}
    });

    expect(email).toBe('jugador@test.com');
    expect(db.collection).not.toHaveBeenCalled();
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  test('resuelve email canónico usando users/{uid} cuando payload trae solo UID', async () => {
    const { resolveCanonicalWalletEmail } = require('../uploadServer.js');

    const docGet = jest.fn().mockResolvedValue({
      exists: true,
      id: 'uid-tecnico',
      data: () => ({ email: 'wallet@example.com' })
    });
    const queryGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ get: docGet })),
        where: jest.fn(() => ({
          limit: jest.fn(() => ({ get: queryGet }))
        }))
      }))
    };

    const email = await resolveCanonicalWalletEmail({
      db,
      auth: { getUser: jest.fn() },
      normalizedEmail: '',
      normalizedUserId: 'uid-tecnico',
      cartonData: {}
    });

    expect(email).toBe('wallet@example.com');
    expect(docGet).toHaveBeenCalledTimes(1);
    expect(queryGet).not.toHaveBeenCalled();
  });

  test('usa admin.auth().getUser(uid).email como último recurso', async () => {
    const { resolveCanonicalWalletEmail } = require('../uploadServer.js');

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })),
        where: jest.fn(() => ({
          limit: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ empty: true, docs: [] }) }))
        }))
      }))
    };
    const auth = {
      getUser: jest.fn().mockResolvedValue({ email: 'fallback@wallet.com' })
    };

    const email = await resolveCanonicalWalletEmail({
      db,
      auth,
      normalizedEmail: '',
      normalizedUserId: 'uid-sin-email',
      cartonData: {}
    });

    expect(email).toBe('fallback@wallet.com');
    expect(auth.getUser).toHaveBeenCalledWith('uid-sin-email');
  });

  test('retorna vacío si no hay forma de resolver walletPublicEmail', async () => {
    const { resolveCanonicalWalletEmail } = require('../uploadServer.js');

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })),
        where: jest.fn(() => ({
          limit: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ empty: true, docs: [] }) }))
        }))
      }))
    };

    const email = await resolveCanonicalWalletEmail({
      db,
      auth: { getUser: jest.fn().mockRejectedValue(new Error('not-found')) },
      normalizedEmail: '',
      normalizedUserId: 'uid-sin-datos',
      cartonData: {}
    });

    expect(email).toBe('');
  });
});
