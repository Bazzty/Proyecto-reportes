import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

// Indicador de carga estilo iOS (rayitas que se desvanecen) en todas las plataformas:
// ActivityIndicator solo se ve así en iOS; en Android es un círculo.
const SPOKES = 12;
const STEP = 360 / SPOKES;

// Gira a saltos de una rayita (no de forma continua), como el indicador nativo de iOS.
const inputRange = [];
const outputRange = [];
for (let i = 0; i < SPOKES; i++) {
  inputRange.push(i / SPOKES, (i + 1) / SPOKES - 0.001);
  outputRange.push(`${i * STEP}deg`, `${i * STEP}deg`);
}

// La rayita de arriba es la "cabeza" (opaca); las que la siguen en sentido antihorario se desvanecen.
const spokeOpacity = (i) => 0.15 + 0.85 * (1 - ((SPOKES - i) % SPOKES) / SPOKES);

export default function Spinner({ size = 20, color = '#6b7280', accessibilityLabel = 'Cargando' }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const spoke = {
    width: size * 0.09,
    height: size * 0.28,
    borderRadius: size * 0.045,
    backgroundColor: color,
  };

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        transform: [{ rotate: progress.interpolate({ inputRange, outputRange }) }],
      }}
    >
      {Array.from({ length: SPOKES }, (_, i) => (
        <View key={i} style={[styles.slot, { transform: [{ rotate: `${i * STEP}deg` }] }]}>
          <View style={[spoke, { opacity: spokeOpacity(i) }]} />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Posición explícita: StyleSheet.absoluteFillObject ya no existe en React Native 0.88.
  slot: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center' },
});
