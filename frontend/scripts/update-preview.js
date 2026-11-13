// Publica una actualización OTA (EAS Update) para los APK instalados del canal `preview`.
// Uso: npm run update:preview -- --message "descripción"
//
// EXPO_PUBLIC_* se incrusta en el bundle al publicar: si se publicara sin la variable, Expo usaría
// la IP de tu .env y todos los APK quedarían apuntando a tu computador. Por eso la URL se toma
// siempre del perfil `preview` de eas.json, la misma con la que se compiló el APK.
const { spawnSync } = require('child_process');
const eas = require('../eas.json');

const args = process.argv.slice(2);
if (!args.includes('--message') && !args.some((a) => a.startsWith('--message='))) {
  console.error('Falta el mensaje. Uso: npm run update:preview -- --message "descripción"');
  process.exit(1);
}

const apiUrl = eas.build.preview.env.EXPO_PUBLIC_API_URL;
console.log(`\n→ Publicando en el canal preview con backend: ${apiUrl}\n`);

// Solo hay APK (Android); los iPhone usan Expo Go y no reciben estas actualizaciones.
const result = spawnSync(
  'npx',
  ['eas-cli', 'update', '--channel', 'preview', '--environment', 'preview', '--platform', 'android', ...args],
  {
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
    shell: process.platform === 'win32',
  },
);
process.exit(result.status ?? 1);
