import { createRef } from 'react';
import { render, screen } from '@testing-library/react-native';
import LeafletMap from '../components/LeafletMap.web';

describe('LeafletMap (web)', () => {
  it('renderiza el contenedor del mapa', async () => {
    await render(<LeafletMap reports={[]} heat={[]} />);

    expect(screen.getByTestId('leaflet-map')).toBeTruthy();
  });

  it('centerOn no lanza si el iframe aún no está montado', async () => {
    const ref = createRef();
    await render(<LeafletMap ref={ref} />);

    expect(() => ref.current.centerOn(-41.3, -72.9, 14)).not.toThrow();
  });
});
