// Cada test empieza sin token guardado (el mock de expo-secure-store vive en jest.setup.js).
beforeEach(() => {
  require('expo-secure-store').__reset();
});
