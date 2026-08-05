import { describe, expect, it } from 'vitest';
import { contrastRatio, isLightColor, normalizeCssColor, parseCssColor, toHex, toHslString, toRgbString } from '@/lib/color';

const WHITE = { red: 255, green: 255, blue: 255, alpha: 1 };
const BLACK = { red: 0, green: 0, blue: 0, alpha: 1 };
const MAX_CONTRAST = 21;
const CONTRAST_TOLERANCE = 0.01;

describe('parseCssColor', () => {
  it('lee las formas que devuelve getComputedStyle', () => {
    expect(parseCssColor('rgb(255, 0, 128)')).toEqual({ red: 255, green: 0, blue: 128, alpha: 1 });
    expect(parseCssColor('rgba(16, 32, 48, 0.5)')).toEqual({ red: 16, green: 32, blue: 48, alpha: 0.5 });
    expect(parseCssColor('rgb(255 0 128 / 25%)')).toEqual({ red: 255, green: 0, blue: 128, alpha: 0.25 });
    expect(parseCssColor('rgb(100%, 0%, 50%)')).toEqual({ red: 255, green: 0, blue: 128, alpha: 1 });
    expect(parseCssColor('color(srgb 1 0 0.5)')).toEqual({ red: 255, green: 0, blue: 128, alpha: 1 });
  });

  it('lee hex corto, largo y con alfa', () => {
    expect(parseCssColor('#f0a')).toEqual({ red: 255, green: 0, blue: 170, alpha: 1 });
    expect(parseCssColor('#112233')).toEqual({ red: 17, green: 34, blue: 51, alpha: 1 });
    expect(toHex(parseCssColor('#11223380') ?? BLACK)).toBe('#11223380');
  });

  it('descarta valores sin color', () => {
    expect(parseCssColor('transparent')).toBeNull();
    expect(parseCssColor('none')).toBeNull();
    expect(parseCssColor('')).toBeNull();
    expect(parseCssColor('currentColor')).toBeNull();
  });
});

describe('formatos de salida', () => {
  it('convierte a hex, rgb y hsl', () => {
    const color = parseCssColor('rgb(99, 102, 241)') ?? BLACK;
    expect(toHex(color)).toBe('#6366f1');
    expect(toRgbString(color)).toBe('rgb(99, 102, 241)');
    expect(toHslString(color)).toBe('hsl(239, 84%, 67%)');
  });

  it('mantiene el alfa cuando no es opaco', () => {
    const color = parseCssColor('rgba(0, 0, 0, 0.4)') ?? BLACK;
    expect(toRgbString(color)).toBe('rgba(0, 0, 0, 0.4)');
    expect(toHslString(color)).toBe('hsla(0, 0%, 0%, 0.4)');
  });

  it('normaliza a hex solo colores visibles', () => {
    expect(normalizeCssColor('rgb(0, 0, 0)')).toBe('#000000');
    expect(normalizeCssColor('rgba(0, 0, 0, 0)')).toBeNull();
  });
});

describe('contraste', () => {
  it('da 21:1 entre blanco y negro', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(MAX_CONTRAST, CONTRAST_TOLERANCE);
  });

  it('es simetrico', () => {
    const gray = { red: 119, green: 119, blue: 119, alpha: 1 };
    expect(contrastRatio(gray, WHITE)).toBeCloseTo(contrastRatio(WHITE, gray), CONTRAST_TOLERANCE);
  });

  it('distingue colores claros de oscuros', () => {
    expect(isLightColor(WHITE)).toBe(true);
    expect(isLightColor(BLACK)).toBe(false);
  });
});
