const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const vm = require('vm');

describe('Contrato generateFirebaseConfig -> public/js/config.js', () => {
  const expectedKeys = [
    'apiKey',
    'authDomain',
    'databaseURL',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  test('genera exactamente las llaves esperadas por el frontend', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'firebase-config-contract-'));
    const outputFile = path.join(tmpDir, 'firebase-config.js');

    const env = {
      ...process.env,
      FIREBASE_DEV_API_KEY: 'api-key',
      FIREBASE_DEV_AUTH_DOMAIN: 'example.firebaseapp.com',
      FIREBASE_DEV_DATABASE_URL: 'https://example-default-rtdb.firebaseio.com',
      FIREBASE_DEV_PROJECT_ID: 'example-dev',
      FIREBASE_DEV_STORAGE_BUCKET: 'example-dev.appspot.com',
      FIREBASE_DEV_MESSAGING_SENDER_ID: '123456789',
      FIREBASE_DEV_APP_ID: '1:123456789:web:abc123'
    };

    execFileSync('node', ['scripts/generateFirebaseConfig.js', '--env', 'dev', '--output', outputFile], {
      cwd: path.resolve(__dirname, '..'),
      env,
      stdio: 'pipe'
    });

    const generatedContent = fs.readFileSync(outputFile, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(generatedContent, sandbox);

    const generatedConfig = sandbox.window.__FIREBASE_CONFIG__;
    const generatedKeys = Object.keys(generatedConfig).sort();

    expect(generatedKeys).toEqual([...expectedKeys].sort());
    expect(generatedConfig).toMatchObject({
      apiKey: 'api-key',
      authDomain: 'example.firebaseapp.com',
      databaseURL: 'https://example-default-rtdb.firebaseio.com',
      projectId: 'example-dev',
      storageBucket: 'example-dev.appspot.com',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:abc123'
    });
  });
});
