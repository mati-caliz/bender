import { describe, expect, it } from 'vitest';
import { scriptIdFromSource, sourceUrlFor, withSourceUrl } from '@/lib/script-errors';

describe('sourceUrlFor', () => {
  it('arma el marcador con el id', () => {
    expect(sourceUrlFor('abc123')).toBe('bender-script-abc123.js');
  });

  it('rechaza ids que romperian el parseo de vuelta', () => {
    expect(sourceUrlFor('con/barra')).toBeNull();
    expect(sourceUrlFor('con espacio')).toBeNull();
    expect(sourceUrlFor('')).toBeNull();
  });
});

describe('withSourceUrl', () => {
  it('pega el marcador al final, en su propia linea', () => {
    expect(withSourceUrl('console.log(1);', 'abc')).toBe('console.log(1);\n//# sourceURL=bender-script-abc.js');
  });

  it('con un id invalido devuelve el codigo intacto', () => {
    expect(withSourceUrl('console.log(1);', 'con/barra')).toBe('console.log(1);');
  });

  it('el resultado sigue terminando en el codigo original mas el marcador', () => {
    const code = 'const a = 1;\n// comentario final';
    expect(withSourceUrl(code, 'x1').startsWith(code)).toBe(true);
  });
});

describe('scriptIdFromSource', () => {
  it('recupera el id del filename', () => {
    expect(scriptIdFromSource('bender-script-abc123.js')).toBe('abc123');
  });

  it('funciona si el navegador lo resuelve contra el origen', () => {
    expect(scriptIdFromSource('https://example.com/bender-script-abc123.js')).toBe('abc123');
  });

  it('ignora los archivos que no son nuestros', () => {
    expect(scriptIdFromSource('https://example.com/app.js')).toBeNull();
    expect(scriptIdFromSource('')).toBeNull();
    expect(scriptIdFromSource('bender-script-.js')).toBeNull();
  });

  it('ignora un id con caracteres raros', () => {
    expect(scriptIdFromSource('bender-script-con.punto.js')).toBeNull();
  });

  it('ida y vuelta', () => {
    const id = 'aB3_x-9';
    const url = sourceUrlFor(id);
    expect(url).not.toBeNull();
    expect(scriptIdFromSource(url ?? '')).toBe(id);
  });
});
