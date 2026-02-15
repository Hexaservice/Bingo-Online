function setupWindow(){
  const sessionStore = {};
  global.window = {
    location: { href: 'index.html', origin: 'https://app.test' },
    firebaseConfig: { projectId: 'demo-test' },
    alert: () => {},
    confirm: () => true,
    prompt: () => '',
    sessionStorage: {
      setItem: (key, value) => { sessionStore[key] = String(value); },
      getItem: (key) => Object.prototype.hasOwnProperty.call(sessionStore, key) ? sessionStore[key] : null,
      removeItem: (key) => { delete sessionStore[key]; }
    }
  };
}

function cleanup(){
  delete global.window;
  delete global.document;
  delete global.firebase;
  jest.resetModules();
  jest.clearAllMocks();
}

function buildFirebaseMock({ userExists = false, role = 'Jugador' } = {}){
  const userDoc = userExists
    ? { exists: true, data: () => ({ role }) }
    : { exists: false, data: () => ({}) };

  return {
    apps: [],
    initializeApp: jest.fn(() => ({})),
    app: jest.fn(() => ({})),
    firestore: jest.fn(() => ({
      collection: jest.fn((name) => {
        if(name === 'Variablesglobales'){
          return { doc: jest.fn(() => ({ get: jest.fn(async () => ({ exists: false, data: () => ({}) })) })) };
        }
        if(name === 'users'){
          return { doc: jest.fn(() => ({ get: jest.fn(async () => userDoc) })) };
        }
        return { doc: jest.fn(() => ({ get: jest.fn(async () => ({ exists: false, data: () => ({}) })) })) };
      })
    })),
    auth: Object.assign(
      jest.fn(() => ({
        setPersistence: jest.fn(async () => undefined),
        onAuthStateChanged: jest.fn(),
        getRedirectResult: jest.fn(async () => ({}))
      })),
      {
        GoogleAuthProvider: function(){ this.setCustomParameters = jest.fn(); },
        OAuthProvider: function(){ this.addScope = jest.fn(); },
        Auth: { Persistence: { LOCAL: 'local' } }
      }
    )
  };
}

describe('auth.js', () => {
  afterEach(cleanup);

  test('getUserRole retorna Jugador y exists=false cuando el usuario no existe', async () => {
    setupWindow();
    global.firebase = buildFirebaseMock({ userExists: false });

    let getUserRole;
    jest.isolateModules(() => {
      ({ getUserRole } = require('../public/js/auth.js'));
    });

    const fakeUser = {
      email: 'nuevo@correo.com',
      getIdTokenResult: jest.fn(async () => ({ claims: {} }))
    };

    await expect(getUserRole(fakeUser)).resolves.toEqual({ role: 'Jugador', exists: false });
  });

  test('getUserRole prioriza custom claim role cuando existe', async () => {
    setupWindow();
    global.firebase = buildFirebaseMock({ userExists: true, role: 'Jugador' });

    let getUserRole;
    jest.isolateModules(() => {
      ({ getUserRole } = require('../public/js/auth.js'));
    });

    const fakeUser = {
      email: 'admin@correo.com',
      getIdTokenResult: jest.fn(async () => ({ claims: { role: 'Administrador' } }))
    };

    await expect(getUserRole(fakeUser)).resolves.toEqual({ role: 'Administrador', exists: true });
  });

  test('redirectByRole redirige según rol', () => {
    setupWindow();
    global.firebase = buildFirebaseMock();

    let redirectByRole;
    jest.isolateModules(() => {
      ({ redirectByRole } = require('../public/js/auth.js'));
    });

    redirectByRole('Colaborador');
    expect(window.location.href).toBe('collab.html');

    redirectByRole('Administrador');
    expect(window.location.href).toBe('admin.html');

    redirectByRole('Superadmin');
    expect(window.location.href).toBe('super.html');

    redirectByRole('RolX');
    expect(window.location.href).toBe('player.html');
  });

  test('getUserRole intenta resincronizar claims cuando el rol persistente es administrativo', async () => {
    setupWindow();
    window.fetch = jest.fn(async () => ({ ok: true, status: 200 }));
    global.fetch = window.fetch;
    global.firebase = buildFirebaseMock({ userExists: true, role: 'Superadmin' });

    let getUserRole;
    jest.isolateModules(() => {
      ({ getUserRole } = require('../public/js/auth.js'));
    });

    const fakeUser = {
      email: 'superadmin@correo.com',
      getIdToken: jest.fn(async () => 'token-demo'),
      getIdTokenResult: jest
        .fn()
        .mockResolvedValueOnce({ claims: {} })
        .mockResolvedValueOnce({ claims: { role: 'Superadmin', roles: ['Superadmin'] } })
    };

    await expect(getUserRole(fakeUser)).resolves.toEqual({ role: 'Superadmin', exists: true });
    expect(window.fetch).toHaveBeenCalledWith(
      'https://app.test/syncClaims',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('verificarRolFuerte falla cuando no hay custom claims válidos', async () => {
    setupWindow();
    window.fetch = jest.fn(async () => ({ ok: false, status: 500 }));
    global.fetch = window.fetch;
    global.firebase = buildFirebaseMock({ userExists: true, role: 'superadmin' });

    let verificarRolFuerte;
    jest.isolateModules(() => {
      ({ verificarRolFuerte } = require('../public/js/auth.js'));
    });

    const fakeUser = {
      email: 'superadmin@correo.com',
      getIdToken: jest.fn(async () => 'token-demo'),
      getIdTokenResult: jest.fn(async () => ({ claims: {} }))
    };

    const authFactory = global.firebase.auth;
    authFactory.mockImplementation(() => ({
      setPersistence: jest.fn(async () => undefined),
      onAuthStateChanged: jest.fn(),
      getRedirectResult: jest.fn(async () => ({})),
      currentUser: fakeUser
    }));

    await expect(verificarRolFuerte('Superadmin', { forceRefresh: true })).resolves.toEqual(
      expect.objectContaining({ ok: false, reason: 'MISSING_CLAIM' })
    );
  });
  test('tieneReautenticacionReciente retorna true cuando existe registro reciente en sessionStorage', async () => {
    setupWindow();
    global.firebase = buildFirebaseMock();

    const fakeUser = {
      uid: 'uid-demo',
      metadata: { lastSignInTime: '2000-01-01T00:00:00.000Z' }
    };

    const authFactory = global.firebase.auth;
    authFactory.mockImplementation(() => ({
      setPersistence: jest.fn(async () => undefined),
      onAuthStateChanged: jest.fn(),
      getRedirectResult: jest.fn(async () => ({})),
      currentUser: fakeUser
    }));

    let registrarReautenticacionReciente, tieneReautenticacionReciente;
    jest.isolateModules(() => {
      ({ registrarReautenticacionReciente, tieneReautenticacionReciente } = require('../public/js/auth.js'));
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    registrarReautenticacionReciente(fakeUser);
    expect(tieneReautenticacionReciente({ maxAgeMs: 60 * 1000, incluirMetadata: false })).toBe(true);
  });

  test('tieneReautenticacionReciente retorna false cuando no hay sesión reciente', async () => {
    setupWindow();
    global.firebase = buildFirebaseMock();

    const fakeUser = {
      uid: 'uid-demo-2',
      metadata: { lastSignInTime: '2000-01-01T00:00:00.000Z' }
    };

    const authFactory = global.firebase.auth;
    authFactory.mockImplementation(() => ({
      setPersistence: jest.fn(async () => undefined),
      onAuthStateChanged: jest.fn(),
      getRedirectResult: jest.fn(async () => ({})),
      currentUser: fakeUser
    }));

    let tieneReautenticacionReciente;
    jest.isolateModules(() => {
      ({ tieneReautenticacionReciente } = require('../public/js/auth.js'));
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(tieneReautenticacionReciente({ maxAgeMs: 60 * 1000 })).toBe(false);
  });

});
