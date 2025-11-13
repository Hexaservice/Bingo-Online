const sgMail = require('@sendgrid/mail');

function ensureApiKey() {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('La variable de entorno SENDGRID_API_KEY es obligatoria para enviar correos.');
  }
}

function setupSendGrid() {
  ensureApiKey();
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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
    throw new Error('Define la variable SENDGRID_FROM_EMAIL o proporciona el campo "from" al enviar un correo.');
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
