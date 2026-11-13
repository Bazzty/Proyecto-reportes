// Extiende app.json con valores que no deben quedar en git.
// GOOGLE_MAPS_API_KEY: en local va en frontend/.env; en EAS Build es una variable
// de entorno del proyecto (eas env:create). Sin ella el mapa sale en blanco en el APK.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY },
    },
  },
});
