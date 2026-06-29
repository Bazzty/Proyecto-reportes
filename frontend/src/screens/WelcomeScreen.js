import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image source={require('../../assets/lake.png')} style={styles.image} />
      <LinearGradient
        colors={['transparent', 'rgba(14,116,144,0.6)', '#0e7490']}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <Text style={styles.title}>Lago en línea</Text>
        <Text style={styles.subtitle}>Proyecto Más Azul</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e7490' },
  image: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: height * 0.6,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 80,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
    color: '#ccfbf1',
    letterSpacing: 2,
  },
});
