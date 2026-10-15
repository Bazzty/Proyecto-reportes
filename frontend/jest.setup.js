jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Los iconos se renderizan como texto con su nombre ("icon:send") para poder encontrarlos en los tests
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }) => <Text>{`icon:${name}`}</Text> };
});
