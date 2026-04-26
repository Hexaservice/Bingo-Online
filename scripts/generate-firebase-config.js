const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const envFile = process.env.FIREBASE_ENV_FILE || '.env';
const envPath = path.resolve(rootDir, envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const templatePath = path.join(rootDir, 'public', 'firebase-config.template.js');
const outputPath = path.join(rootDir, 'public', 'firebase-config.js');

const requiredEnvVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID'
];

const optionalEnvVars = ['FIREBASE_DATABASE_URL', 'FIREBASE_MEASUREMENT_ID'];

const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error(
    `Faltan variables requeridas para Firebase: ${missingVars.join(', ')}. ` +
      'Defínalas en variables de entorno o en el archivo .env indicado.'
  );
  process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf8');
const replacementMap = {
  '__FIREBASE_API_KEY__': process.env.FIREBASE_API_KEY,
  '__FIREBASE_AUTH_DOMAIN__': process.env.FIREBASE_AUTH_DOMAIN,
  '__FIREBASE_DATABASE_URL__': process.env.FIREBASE_DATABASE_URL || '',
  '__FIREBASE_PROJECT_ID__': process.env.FIREBASE_PROJECT_ID,
  '__FIREBASE_STORAGE_BUCKET__': process.env.FIREBASE_STORAGE_BUCKET,
  '__FIREBASE_MESSAGING_SENDER_ID__': process.env.FIREBASE_MESSAGING_SENDER_ID,
  '__FIREBASE_APP_ID__': process.env.FIREBASE_APP_ID,
  '__FIREBASE_MEASUREMENT_ID__': process.env.FIREBASE_MEASUREMENT_ID || ''
};

let output = template;
for (const [placeholder, value] of Object.entries(replacementMap)) {
  output = output.replaceAll(placeholder, value);
}

for (const envVar of optionalEnvVars) {
  if (!process.env[envVar]) {
    const propertyName = envVar.replace('FIREBASE_', '').toLowerCase();
    const jsPropertyName = propertyName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const regex = new RegExp(`\\n\\s*${jsPropertyName}: \\"\\",?`, 'g');
    output = output.replace(regex, '');
  }
}

fs.writeFileSync(outputPath, `${output.trimEnd()}\n`, 'utf8');
console.log(`Archivo generado: ${path.relative(rootDir, outputPath)} usando ${path.basename(envPath)}`);
