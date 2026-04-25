#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ENV_ALIASES = {
  dev: 'dev',
  desarrollo: 'dev',
  development: 'dev',
  stg: 'stg',
  stage: 'stg',
  staging: 'stg',
  prod: 'prod',
  production: 'prod',
  main: 'prod'
};

const REQUIRED_KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID'
];

function parseArgs(argv) {
  const args = { env: process.env.APP_ENV || process.env.ENV || 'prod', output: 'public/firebase-config.js' };

  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];

    if ((current === '--env' || current === '-e') && argv[index + 1]) {
      args.env = argv[index + 1];
      index += 1;
      continue;
    }

    if ((current === '--output' || current === '-o') && argv[index + 1]) {
      args.output = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === '--help' || current === '-h') {
      args.help = true;
      break;
    }
  }

  return args;
}

function normalizeEnv(rawEnv) {
  const normalized = String(rawEnv || '').trim().toLowerCase();
  return ENV_ALIASES[normalized] || normalized;
}

function resolveValue(key, envKey) {
  return process.env[envKey] || process.env[key] || '';
}

function escapeTemplateValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function printHelp() {
  console.log(`Uso:\n  node scripts/generateFirebaseConfig.js --env <dev|stg|prod> [--output public/firebase-config.js]\n\nVariables requeridas por entorno:\n  FIREBASE_<ENV>_API_KEY\n  FIREBASE_<ENV>_AUTH_DOMAIN\n  FIREBASE_<ENV>_DATABASE_URL\n  FIREBASE_<ENV>_PROJECT_ID\n  FIREBASE_<ENV>_STORAGE_BUCKET\n  FIREBASE_<ENV>_MESSAGING_SENDER_ID\n  FIREBASE_<ENV>_APP_ID\n\nTambién acepta fallback sin prefijo de entorno: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, etc.`);
}

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const environment = normalizeEnv(args.env);
  if (!['dev', 'stg', 'prod'].includes(environment)) {
    throw new Error(`Entorno no soportado: ${args.env}. Use dev, stg o prod.`);
  }

  const prefix = `FIREBASE_${environment.toUpperCase()}_`;

  const config = {};
  const missing = [];

  for (const key of REQUIRED_KEYS) {
    const suffix = key.replace('FIREBASE_', '');
    const envKey = `${prefix}${suffix}`;
    const value = resolveValue(key, envKey);

    if (!value) {
      missing.push(`${envKey} (o fallback ${key})`);
    }

    const targetKey = suffix
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    config[targetKey] = value;
  }

  if (missing.length > 0) {
    throw new Error(`Faltan variables requeridas para ${environment}:\n- ${missing.join('\n- ')}`);
  }

  const outputPath = path.resolve(process.cwd(), args.output);
  const content = `// Archivo generado automáticamente por scripts/generateFirebaseConfig.js\n// Entorno: ${environment}\nwindow.__FIREBASE_CONFIG__ = {\n  apiKey: "${escapeTemplateValue(config.apiKey)}",\n  authDomain: "${escapeTemplateValue(config.authDomain)}",\n  databaseURL: "${escapeTemplateValue(config.databaseUrl)}",\n  projectId: "${escapeTemplateValue(config.projectId)}",\n  storageBucket: "${escapeTemplateValue(config.storageBucket)}",\n  messagingSenderId: "${escapeTemplateValue(config.messagingSenderId)}",\n  appId: "${escapeTemplateValue(config.appId)}"\n};\n`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`firebase-config generado en ${outputPath} para entorno ${environment}`);
}

main();
