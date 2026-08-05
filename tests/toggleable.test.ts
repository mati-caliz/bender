import { describe, expect, it } from 'vitest';
import { computeToggleRows, withoutKey } from '@/lib/toggleable';
import type { StoredItem } from '@/types';

const keyOf = (item: StoredItem): string => item.key;

const item = (key: string, value = key): StoredItem => ({ key, value });

describe('withoutKey', () => {
  it('devuelve una copia sin la clave pedida', () => {
    const original = { a: item('a'), b: item('b') };
    expect(withoutKey(original, 'a')).toEqual({ b: item('b') });
    expect(original).toHaveProperty('a');
  });

  it('no falla con una clave que no esta', () => {
    expect(withoutKey({ a: item('a') }, 'z')).toEqual({ a: item('a') });
  });
});

describe('computeToggleRows', () => {
  it('marca prendido lo que esta vivo y apagado lo que solo esta guardado', () => {
    const rows = computeToggleRows([item('vivo')], { apagado: item('apagado') }, keyOf);
    expect(rows).toEqual([
      { key: 'vivo', item: item('vivo'), off: false, reappeared: false },
      { key: 'apagado', item: item('apagado'), off: true, reappeared: false },
    ]);
  });

  it('marca reaparecio cuando algo apagado vuelve a estar vivo', () => {
    const [row] = computeToggleRows([item('token', 'nuevo')], { token: item('token', 'viejo') }, keyOf);
    expect(row).toEqual({ key: 'token', item: item('token', 'nuevo'), off: false, reappeared: true });
  });

  it('devuelve el snapshot guardado, no el vivo, para lo apagado', () => {
    const rows = computeToggleRows([], { token: item('token', 'guardado') }, keyOf);
    expect(rows[0]?.item.value).toBe('guardado');
  });
});
