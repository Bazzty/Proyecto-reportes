// Arranca Expo (Expo Go) contra el backend desplegado en Azure, sin tocar tu .env.
// Uso: npm run start:azure            (flags extra: npm run start:azure -- --tunnel)
//
// La URL se lee del perfil `preview` de eas.json, así el APK y el desarrollo usan siempre la misma.
// Funciona porque Expo no sobrescribe con .env una variable que ya viene definida en el entorno.
// --clear evita que Metro reutilice un bundle cacheado con la URL anterior (EXPO_PUBLIC_* se inyecta al compilar).
const { spawn } = require('child_process');
const eas = require('../eas.json');

const apiUrl = eas.build.preview.env.EXPO_PUBLIC_API_URL;
console.log(`\n→ Backend: ${apiUrl}\n  (ojo: es el servidor real; lo que crees aquí queda en la base de datos de producción)\n`);

const child = spawn('npx', ['expo', 'start', '--clear', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
});
child.on('exit', (code) => process.exit(code ?? 0));
