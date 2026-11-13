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

// Se invoca la CLI de Expo con el mismo Node (sin shell): igual en Windows, macOS y Linux.
const expoCli = require.resolve('expo/bin/cli');
const child = spawn(process.execPath, [expoCli, 'start', '--clear', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
});
// Si Expo muere por una señal (code = null), no se reporta como éxito.
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
