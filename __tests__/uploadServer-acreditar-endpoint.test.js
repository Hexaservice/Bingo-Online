jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(), {
    FieldValue: {
      serverTimestamp: jest.fn(() => '__SERVER_TIMESTAMP__')
    }
  }),
  auth: jest.fn(() => ({ verifyIdToken: jest.fn() }))
}));

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

describe('endpoint /acreditarPremioEvento deshabilitado', () => {
  test('siempre responde 410 para desactivar acreditación instantánea', async () => {
    const { acreditarPremioEventoHandler } = require('../uploadServer.js');

    const req = {
      body: {
        sorteoId: 'sorteo-1',
        formaIdx: 2,
        cartonId: 'carton-1',
        eventoGanadorId: 'sorteo-1__f2__carton-1',
        monto: 100,
        email: 'ganador@example.com'
      },
      headers: {},
      user: { email: 'admin@example.com', role: 'Administrador' }
    };
    const res = makeRes();

    await acreditarPremioEventoHandler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.body).toEqual({
      error: 'La acreditación instantánea de premios fue deshabilitada. Gestiona los pagos desde Centro de Pagos.'
    });
  });
});
