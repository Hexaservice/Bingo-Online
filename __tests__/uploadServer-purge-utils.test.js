jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn()
}));

describe('uploadServer utilidades de depuración de sorteos', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('countDocumentById devuelve 1 cuando existe y 0 cuando no existe', async () => {
    const { countDocumentById } = require('../uploadServer.js');

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn((id) => ({
          get: jest.fn(async () => ({ exists: id === 'exists-id' }))
        }))
      }))
    };

    await expect(countDocumentById({ db, collectionName: 'sorteos', docId: 'exists-id' })).resolves.toBe(1);
    await expect(countDocumentById({ db, collectionName: 'sorteos', docId: 'missing-id' })).resolves.toBe(0);
  });

  test('getPurgeCounts en dryRun cuenta sin borrar', async () => {
    const { getPurgeCounts } = require('../uploadServer.js');

    const queryGet = jest.fn(async () => ({ empty: true, size: 0, docs: [] }));
    const docGet = jest.fn(async () => ({ exists: false }));
    const deleteFn = jest.fn(async () => {});

    const db = {
      collection: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => ({
              get: queryGet,
              startAfter: jest.fn(() => ({ get: queryGet }))
            }))
          }))
        })),
        doc: jest.fn(() => ({
          get: docGet,
          delete: deleteFn
        }))
      }))
    };

    const counts = await getPurgeCounts({ db, sorteoId: 'abc', dryRun: true });

    expect(Object.keys(counts)).toEqual([
      'CartonJugado',
      'ConsecutivosCarton',
      'SorteosCentroPagos',
      'cantos',
      'cantarsorteos',
      'formas',
      'sorteos'
    ]);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
