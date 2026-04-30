jest.mock('firebase-admin', () => ({
  auth: jest.fn(),
  firestore: jest.fn()
}));

const admin = require('firebase-admin');
const { requireRole } = require('../server/auth/requireRole');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

describe('requireRole middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['Superadmin', true],
    ['Administrador', true],
    ['Colaborador', false],
    [undefined, false]
  ])('con rol %s valida acceso administrativo=%s', async (role, expectedAllowed) => {
    admin.auth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue({ uid: 'uid-1', email: 'admin@test.com' }) });
    admin.firestore.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: role !== undefined,
            data: () => ({ role })
          })
        })
      })
    });

    const middleware = requireRole(['Superadmin', 'Administrador'], {
      onForbidden: 'Acceso restringido a roles administrativos'
    });
    const req = { headers: { authorization: 'Bearer token' } };
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    if (expectedAllowed) {
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toEqual({ uid: 'uid-1', email: 'admin@test.com', role });
      expect(res.status).not.toHaveBeenCalled();
    } else {
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Acceso restringido a roles administrativos' });
    }
  });

  test.each([
    ['Superadmin', true],
    ['Administrador', true],
    ['Colaborador', true],
    [undefined, false]
  ])('con rol %s valida acceso operador=%s', async (role, expectedAllowed) => {
    admin.auth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue({ uid: 'uid-2', email: 'operador@test.com' }) });
    admin.firestore.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: role !== undefined,
            data: () => ({ role })
          })
        })
      })
    });

    const middleware = requireRole(['Superadmin', 'Administrador', 'Colaborador'], {
      onForbidden: 'Acceso restringido a operadores autorizados'
    });
    const req = { headers: { authorization: 'Bearer token' } };
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    if (expectedAllowed) {
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toEqual({ uid: 'uid-2', email: 'operador@test.com', role });
      expect(res.status).not.toHaveBeenCalled();
    } else {
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Acceso restringido a operadores autorizados' });
    }
  });
});
