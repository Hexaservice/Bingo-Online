jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn()
}));

describe('uploadServer utilidades de acreditación', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('isSorteoEligibleForAutoPrize permite estados operativos y transicionales válidos', () => {
    const { isSorteoEligibleForAutoPrize } = require('../uploadServer.js');

    expect(isSorteoEligibleForAutoPrize({ estado: 'Jugando', premiosCorteCerrado: false })).toBe(true);
    expect(isSorteoEligibleForAutoPrize({ estado: 'FINALIZADO', premiosCorteCerrado: false })).toBe(true);
    expect(isSorteoEligibleForAutoPrize({ estado: 'sellado', premiosCorteCerrado: false })).toBe(true);
    expect(isSorteoEligibleForAutoPrize({ estado: 'Finalizando', premiosCorteCerrado: false })).toBe(true);
  });

  test('isSorteoEligibleForAutoPrize rechaza estados incompatibles y corte cerrado', () => {
    const { isSorteoEligibleForAutoPrize } = require('../uploadServer.js');

    expect(isSorteoEligibleForAutoPrize({ estado: 'Activo', premiosCorteCerrado: false })).toBe(false);
    expect(isSorteoEligibleForAutoPrize({ estado: 'Inactivo', premiosCorteCerrado: false })).toBe(false);
    expect(isSorteoEligibleForAutoPrize({ estado: 'Archivado', premiosCorteCerrado: false })).toBe(false);
    expect(isSorteoEligibleForAutoPrize({ estado: 'Jugando', premiosCorteCerrado: true })).toBe(false);
  });

  test('buildPremioDocId genera id sanitizado y estable', () => {
    const { buildPremioDocId } = require('../uploadServer.js');

    const id = buildPremioDocId({
      sorteoId: 'sorteo 1',
      formaIdx: 2,
      cartonId: 'carton/abc',
      prefijo: 'auto premio'
    });

    expect(id).toBe('auto_premio__sorteo_1__f2__carton_abc');
  });


  test('resolveWinnerIdentity resuelve email canónico cuando solo llega userId en cartón', async () => {
    const { resolveWinnerIdentity } = require('../uploadServer.js');

    const resolved = await resolveWinnerIdentity({
      normalizedEmail: '',
      normalizedUserId: 'uid-ganador-1',
      cartonData: {
        userId: 'uid-ganador-1',
        email: '',
        gmail: '',
        IDbilletera: 'uid-ganador-1'
      },
      loadUserById: async () => null,
      loadUserByUid: async (uid) => {
        if (uid !== 'uid-ganador-1') return null;
        return {
          id: 'ganador@example.com',
          data: {
            uid: 'uid-ganador-1',
            email: 'ganador@example.com'
          }
        };
      }
    });

    expect(resolved.emailVisible).toBe('ganador@example.com');
    expect(resolved.billeteraCandidates).toEqual(
      expect.arrayContaining(['ganador@example.com', 'uid-ganador-1'])
    );
  });


  test('getAcreditacionExecutionMode diferencia modo automático y manual privilegiado', () => {
    const { getAcreditacionExecutionMode } = require('../uploadServer.js');

    expect(
      getAcreditacionExecutionMode({
        source: 'backend/acreditarPremioEvento',
        origen: 'premios_jugadores',
        manualApproval: false,
        userRole: 'Colaborador'
      })
    ).toEqual(
      expect.objectContaining({
        mode: 'automatico',
        manualRequested: false,
        manualAllowed: false
      })
    );

    expect(
      getAcreditacionExecutionMode({
        source: 'centropagos/manual',
        origen: 'premios_jugadores',
        manualApproval: false,
        userRole: 'Administrador'
      })
    ).toEqual(
      expect.objectContaining({
        mode: 'manual',
        manualRequested: true,
        manualAllowed: true
      })
    );

    expect(
      getAcreditacionExecutionMode({
        source: 'centropagos/manual',
        origen: 'premios_jugadores',
        manualApproval: true,
        userRole: 'Colaborador'
      })
    ).toEqual(
      expect.objectContaining({
        mode: 'automatico',
        manualRequested: true,
        manualAllowed: false
      })
    );
  });

  test('extractEventoGanadorIdComponents obtiene sorteo, forma y carton', () => {
    const { extractEventoGanadorIdComponents } = require('../uploadServer.js');

    expect(extractEventoGanadorIdComponents('segundo__sorteo_a__f3__carton_77')).toEqual({
      prefijo: 'segundo',
      segundoLugar: true,
      sorteoId: 'sorteo_a',
      formaIdx: 3,
      cartonId: 'carton_77'
    });
    expect(extractEventoGanadorIdComponents('invalido')).toBeNull();
  });
});
