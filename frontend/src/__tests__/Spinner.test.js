import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import Spinner from '../components/Spinner';

const slotsOf = (tree) => tree.children.map((slot) => StyleSheet.flatten(slot.props.style));

describe('Spinner', () => {
  it('se expone como indicador de progreso con su etiqueta', async () => {
    await render(<Spinner accessibilityLabel="Enviando" />);
    expect(screen.getByLabelText('Enviando').props.accessibilityRole).toBe('progressbar');
  });

  it('superpone 12 rayitas en el mismo punto, cada una girada 30° más que la anterior', async () => {
    await render(<Spinner />);
    const slots = slotsOf(screen.toJSON());

    expect(slots).toHaveLength(12);
    slots.forEach((style, i) => {
      // Si no son absolutas se apilan en columna en vez de formar un círculo.
      expect(style).toMatchObject({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 });
      expect(style.transform).toEqual([{ rotate: `${i * 30}deg` }]);
    });
  });

  it('la rayita de arriba es la más opaca y la siguiente en sentido horario la más tenue', async () => {
    await render(<Spinner color="#123456" />);
    const opacities = screen.toJSON().children.map(
      (slot) => StyleSheet.flatten(slot.children[0].props.style).opacity
    );

    expect(opacities[0]).toBe(1);
    expect(Math.min(...opacities)).toBe(opacities[1]);
    expect(StyleSheet.flatten(screen.toJSON().children[0].children[0].props.style).backgroundColor).toBe('#123456');
  });
});
