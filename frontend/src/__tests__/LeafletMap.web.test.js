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

  it('inyecta el origen del padre en el srcDoc del iframe', async () => {
    const prevLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'http://localhost:8081' },
    });

    try {
      const view = await render(<LeafletMap reports={[]} heat={[]} />);

      const findIframe = (node) => {
        if (!node || typeof node !== 'object') return null;
        if (node.type === 'iframe') return node;
        for (const child of node.children || []) {
          const found = findIframe(child);
          if (found) return found;
        }
        return null;
      };

      const iframe = findIframe(view.toJSON());
      expect(iframe).not.toBeNull();
      expect(iframe.props.srcDoc).toContain("var PARENT_ORIGIN = 'http://localhost:8081'");
      expect(iframe.props.srcDoc).not.toContain("var PARENT_ORIGIN = '__PARENT_ORIGIN__'");
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: prevLocation });
    }
  });
});
