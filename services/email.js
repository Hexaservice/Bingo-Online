require('dotenv').config();
const sgMail = require('@sendgrid/mail');

const FALLBACK_SENDGRID_API_KEY = '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';

function obtenerApiKey() {
  const apiKey = process.env.SENDGRID_API_KEY || FALLBACK_SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('La variable de entorno SENDGRID_API_KEY es obligatoria para enviar correos.');
  }

  if (!process.env.SENDGRID_API_KEY && apiKey === FALLBACK_SENDGRID_API_KEY) {
    console.warn(
      'Usando la clave SendGrid definida en el repositorio porque SENDGRID_API_KEY no está configurada. ' +
        'Configúrala en el entorno para evitar exponer credenciales en código.'
    );
  }

  return apiKey;
}

function setupSendGrid() {
  const apiKey = obtenerApiKey();
  sgMail.setApiKey(apiKey);
}

/**
 * Envía un correo electrónico utilizando SendGrid.
 *
 * @param {Object} opciones
 * @param {string|string[]} opciones.to - Destinatario(s) del mensaje.
 * @param {string} opciones.subject - Asunto del correo.
 * @param {string} [opciones.html] - Contenido HTML del mensaje.
 * @param {string} [opciones.text] - Contenido de texto plano (recomendado junto al HTML).
 * @param {string} [opciones.from] - Remitente a utilizar; si no se indica se usa SENDGRID_FROM_EMAIL.
 * @returns {Promise<void>}
 */
async function enviarCorreo(opciones) {
  setupSendGrid();
  const fromAddress = opciones.from || process.env.SENDGRID_FROM_EMAIL;

  if (!fromAddress) {
    throw new Error(
      'Define la variable SENDGRID_FROM_EMAIL con el remitente verificado en SendGrid o proporciona el campo "from" al enviar un correo.'
    );
  }

  const mensaje = {
    to: opciones.to,
    from: fromAddress,
    subject: opciones.subject,
    html: opciones.html,
    text: opciones.text,
  };

  await sgMail.send(mensaje);
}

module.exports = {
  enviarCorreo,
};
