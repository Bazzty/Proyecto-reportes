// Entorno de test = el de jest-expo + un parche para Node 26.
//
// jest-environment-node 30 crea el global de cada test como un contexto `vm` cuyo sandbox es un
// Proxy. En Node 26, `hasOwnProperty` sobre ese global devuelve false para todo lo que se le añade
// después (setTimeout, setInterval, ...), aunque la propiedad sí es propia. Jest usa esa
// comprobación para decidir si restaura o BORRA la propiedad original al deshacer un mock, así que
// tras `jest.useRealTimers()` o tras `jest.spyOn(global, 'setTimeout').mockRestore()` quedaba
// "setTimeout is not defined". En Node 22/24 la comprobación funciona y este archivo no cambia nada.
// Se puede eliminar (junto con `testEnvironment` en package.json) cuando Jest o Node lo corrijan.
const vm = require('node:vm');
const ExpoNativeEnvironment = require('jest-expo/src/preset/nativeEnvironment.js');

const nativeHasOwnProperty = Object.prototype.hasOwnProperty;

const hasProxySandboxBug = (() => {
  const probe = vm.runInContext('this', vm.createContext(new Proxy({}, {})));
  probe.x = 1;
  return !nativeHasOwnProperty.call(probe, 'x');
})();

const testGlobals = new WeakSet();

if (hasProxySandboxBug) {
  // Solo corrige la respuesta para los globales de test registrados; el resto de objetos sigue
  // usando la implementación nativa tal cual.
  // eslint-disable-next-line no-extend-native
  Object.prototype.hasOwnProperty = function hasOwnProperty(key) {
    if (nativeHasOwnProperty.call(this, key)) return true;
    return testGlobals.has(this) && Object.getOwnPropertyDescriptor(this, key) !== undefined;
  };
}

class Environment extends ExpoNativeEnvironment {
  constructor(config, context) {
    super(config, context);
    if (hasProxySandboxBug) testGlobals.add(this.global);
  }
}

module.exports = Environment;
module.exports.TestEnvironment = Environment;
