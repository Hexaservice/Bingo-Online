const EstadosPagoPremio = require('../public/js/estadoPagoPremio.js');

describe('EstadosPagoPremio normalización e interpretación', () => {
  test('normaliza REALIZADO como APROBADO en lectura', () => {
    expect(EstadosPagoPremio.normalizarLectura('APROBADO')).toBe('APROBADO');
    expect(EstadosPagoPremio.normalizarLectura('realizado')).toBe('APROBADO');
  });

  test('estaFinalizado reconoce APROBADO, ACEPTADO y REALIZADO', () => {
    expect(EstadosPagoPremio.estaFinalizado('APROBADO')).toBe(true);
    expect(EstadosPagoPremio.estaFinalizado('ACEPTADO')).toBe(true);
    expect(EstadosPagoPremio.estaFinalizado('REALIZADO')).toBe(true);
    expect(EstadosPagoPremio.estaFinalizado('PENDIENTE')).toBe(false);
  });

  test('validarParaGuardar solo permite estados canónicos', () => {
    expect(EstadosPagoPremio.validarParaGuardar('APROBADO')).toBe('APROBADO');
    expect(EstadosPagoPremio.validarParaGuardar('ACEPTADO')).toBe('ACEPTADO');
    expect(() => EstadosPagoPremio.validarParaGuardar('REALIZADO')).toThrow(/Estado no reconocido/);
  });
});
