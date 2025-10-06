// Plantilla para configurar Firebase App Check en despliegues automatizados.
// Reemplace __FIREBASE_APPCHECK_SITE_KEY__ con la clave emitida por Firebase
// al crear el proveedor (reCAPTCHA v3 o reCAPTCHA Enterprise) para la app web.
window.__FIREBASE_APP_CHECK_CONFIG__ = {
  provider: 'recaptcha_v3',
  siteKey: '__FIREBASE_APPCHECK_SITE_KEY__',
  isTokenAutoRefreshEnabled: true,
  // Opcional: establezca un token de depuración cuando ejecute la app en entornos
  // locales. Utilice la consola de Firebase para registrar el token y permitir
  // las solicitudes emitidas desde el navegador.
  debugToken: undefined,
  // Establezca en true para habilitar automáticamente el modo debug cuando no
  // posea un token específico. Úselo únicamente en entornos de desarrollo.
  enableDebug: false
};
