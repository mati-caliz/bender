import { describe, expect, it } from 'vitest';
import { slugify } from '@/lib/format';

describe('slugify', () => {
  it('pasa a minusculas y une con guiones', () => {
    expect(slugify('Staging Auth')).toBe('staging-auth');
  });

  it('saca los acentos en vez de comerse la letra', () => {
    expect(slugify('Sesión Ñandú')).toBe('sesion-nandu');
  });

  it('descarta los caracteres que Windows no acepta en un nombre de archivo', () => {
    expect(slugify('QA / prod: v2?')).toBe('qa-prod-v2');
  });

  it('no deja guiones sueltos en los bordes', () => {
    expect(slugify('  ...raro...  ')).toBe('raro');
  });

  it('cae a un nombre usable cuando no queda nada', () => {
    expect(slugify('***')).toBe('perfil');
    expect(slugify('')).toBe('perfil');
  });
});
