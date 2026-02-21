jest.mock('firebase-admin', () => {
  const firestoreFn = jest.fn();
  firestoreFn.FieldValue = {
    serverTimestamp: jest.fn(() => '__SERVER_TIMESTAMP__')
  };

  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: firestoreFn,
    auth: jest.fn(() => ({ verifyIdToken: jest.fn() }))
  };
});

const admin = require('firebase-admin');

function makeDocSnapshot(exists, data = {}, id = '') {
  return {
    exists,
    id,
    data: () => data
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function buildDbStub({ sorteoData, cartonData, premioData, billeteraData }) {
  const sets = [];

  const db = {
    runTransaction: async (cb) => cb(tx),
    collection(name) {
      return {
        doc(id) {
          return {
            type: 'doc',
            collectionName: name,
            id,
            collection(subCollection) {
              return {
                doc(subId) {
                  return {
                    type: 'doc',
                    collectionName: `${name}/${id}/${subCollection}`,
                    id: subId
                  };
                }
              };
            }
          };
        },
        where(field, op, value) {
          return {
            type: 'query',
            collectionName: name,
            field,
            op,
            value,
            limit(limitValue) {
              return {
                ...this,
                limitValue
              };
            }
          };
        }
      };
    }
  };

  const tx = {
    async get(ref) {
      if (ref.type === 'doc') {
        if (ref.collectionName === 'sorteos') return makeDocSnapshot(true, sorteoData, ref.id);
        if (ref.collectionName === 'CartonJugado') return makeDocSnapshot(true, cartonData, ref.id);
        if (ref.collectionName === 'PremiosSorteos') {
          if (premioData) return makeDocSnapshot(true, premioData, ref.id);
          return makeDocSnapshot(false, {}, ref.id);
        }
        if (ref.collectionName === 'transacciones') return makeDocSnapshot(false, {}, ref.id);
        if (ref.collectionName === 'Billetera') {
          if (billeteraData) return makeDocSnapshot(true, billeteraData, ref.id);
          return makeDocSnapshot(false, {}, ref.id);
        }
        if (ref.collectionName === 'users') return makeDocSnapshot(false, {}, ref.id);
        return makeDocSnapshot(false, {}, ref.id);
      }

      if (ref.type === 'query' && ref.collection === 'users') {
        return { empty: true, docs: [] };
      }

      return { empty: true, docs: [] };
    },
    set(ref, data) {
      sets.push({ ref, data });
    }
  };

  return { db, sets };
}

describe('endpoint /acreditarPremioEvento por modos', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('modo automático mantiene bloqueo cuando premiosCorteCerrado=true', async () => {
    const { acreditarPremioEventoHandler, buildPremioDocId } = require('../uploadServer.js');

    const { db } = buildDbStub({
      sorteoData: { estado: 'Jugando', premiosCorteCerrado: true, nombre: 'Sorteo demo' },
      cartonData: { sorteoId: 'sorteo-1', userId: 'uid-1', email: 'ganador@example.com', IDbilletera: 'ganador@example.com' }
    });
    admin.firestore.mockReturnValue(db);

    const eventoGanadorId = buildPremioDocId({ sorteoId: 'sorteo-1', formaIdx: 2, cartonId: 'carton-1' });
    const req = {
      body: {
        sorteoId: 'sorteo-1',
        formaIdx: 2,
        cartonId: 'carton-1',
        eventoGanadorId,
        monto: 100,
        email: 'ganador@example.com',
        source: 'backend/acreditarPremioEvento'
      },
      headers: {},
      user: { email: 'colab@example.com', role: 'Colaborador' }
    };
    const res = makeRes();

    await acreditarPremioEventoHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'El sorteo ya tiene corte de premios cerrado.' });
  });

  test('modo manual por rol privilegiado permite acreditar con corte cerrado y audita executionMode', async () => {
    const { acreditarPremioEventoHandler, buildPremioDocId } = require('../uploadServer.js');

    const { db, sets } = buildDbStub({
      sorteoData: { estado: 'Jugando', premiosCorteCerrado: true, nombre: 'Sorteo demo' },
      cartonData: { sorteoId: 'sorteo-1', userId: 'uid-1', email: 'ganador@example.com', alias: 'Alias', IDbilletera: 'ganador@example.com' },
      billeteraData: { creditos: 10, CartonesGratis: 0 }
    });
    admin.firestore.mockReturnValue(db);

    const eventoGanadorId = buildPremioDocId({ sorteoId: 'sorteo-1', formaIdx: 2, cartonId: 'carton-1' });
    const req = {
      body: {
        sorteoId: 'sorteo-1',
        formaIdx: 2,
        cartonId: 'carton-1',
        eventoGanadorId,
        monto: 100,
        email: 'ganador@example.com',
        source: 'centropagos/manual',
        manualApproval: true,
        requestId: 'req-manual-1'
      },
      headers: {},
      user: { email: 'admin@example.com', role: 'Administrador' }
    };
    const res = makeRes();

    await acreditarPremioEventoHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.executionMode).toBe('manual');

    const technicalAudit = sets.find(
      (entry) => entry.ref.collectionName === 'AcreditacionAuditoriaTecnica'
    );
    expect(technicalAudit).toBeTruthy();
    expect(technicalAudit.data).toEqual(
      expect.objectContaining({
        source: 'centropagos/manual',
        requestId: 'req-manual-1',
        processedBy: 'admin@example.com',
        executionMode: 'manual'
      })
    );
  });

  test('acepta eventoGanadorId con prefijo segundo sin requerir segundoLugar explícito', async () => {
    const { acreditarPremioEventoHandler, buildPremioDocId } = require('../uploadServer.js');

    const { db, sets } = buildDbStub({
      sorteoData: { estado: 'Jugando', premiosCorteCerrado: false, nombre: 'Sorteo demo' },
      cartonData: { sorteoId: 'sorteo-1', userId: 'uid-1', email: 'ganador@example.com', alias: 'Alias', IDbilletera: 'ganador@example.com' },
      billeteraData: { creditos: 25, CartonesGratis: 0 }
    });
    admin.firestore.mockReturnValue(db);

    const eventoGanadorId = buildPremioDocId({ sorteoId: 'sorteo-1', formaIdx: 4, cartonId: 'carton-9', prefijo: 'segundo' });
    const req = {
      body: {
        sorteoId: 'sorteo-1',
        formaIdx: 4,
        cartonId: 'carton-9',
        eventoGanadorId,
        monto: 50,
        email: 'ganador@example.com',
        source: 'centropagos/manual',
        manualApproval: true,
        requestId: 'req-segundo-1'
      },
      headers: {},
      user: { email: 'admin@example.com', role: 'Administrador' }
    };
    const res = makeRes();

    await acreditarPremioEventoHandler(req, res);

    expect(res.statusCode).toBe(200);
    const premioWrite = sets.find(
      (entry) => entry.ref.collectionName === 'PremiosSorteos'
    );
    expect(premioWrite).toBeTruthy();
    expect(premioWrite.data.segundoLugar).toBe(true);
  });
});
