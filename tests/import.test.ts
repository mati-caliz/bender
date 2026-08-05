import { describe, expect, it } from 'vitest';
import { parseCookies, parseProfiles, parseStorageItems } from '@/lib/import';

describe('parseProfiles', () => {
  it('lee un export de ModHeader', () => {
    const [profile] = parseProfiles(
      JSON.stringify([
        {
          title: 'Staging',
          backgroundColor: '#ff0000',
          headers: [{ name: 'Authorization', value: 'Bearer x', enabled: true }],
          respHeaders: [{ name: 'X-Debug', value: '1' }],
          urlFilters: [{ urlRegex: 'staging\\.example\\.com' }],
        },
      ])
    );
    expect(profile?.name).toBe('Staging');
    expect(profile?.color).toBe('#ff0000');
    expect(profile?.requestHeaders[0]?.name).toBe('Authorization');
    expect(profile?.responseHeaders[0]?.name).toBe('X-Debug');
    expect(profile?.scope.urlFilter).toBe('staging\\.example\\.com');
  });

  it('acepta el objeto envuelto en { profiles }', () => {
    const profiles = parseProfiles(
      JSON.stringify({ profiles: [{ name: 'Uno', headers: [{ name: 'x', value: '1' }] }] })
    );
    expect(profiles).toHaveLength(1);
  });

  it('lee el alcance propio y normaliza los dominios', () => {
    const [profile] = parseProfiles(
      JSON.stringify([
        {
          name: 'Con alcance',
          requestHeaders: [{ name: 'x', value: '1' }],
          scope: {
            activeTabOnly: true,
            urlFilter: '/api/',
            includeDomains: ['*.Example.com', 'no valido'],
            excludeDomains: ['https://cdn.example.com/'],
          },
        },
      ])
    );
    expect(profile?.scope.activeTabOnly).toBe(true);
    expect(profile?.scope.urlFilter).toBe('/api/');
    expect(profile?.scope.includeDomains).toEqual(['example.com']);
    expect(profile?.scope.excludeDomains).toEqual(['cdn.example.com']);
  });

  it('completa nombre, color y id cuando faltan', () => {
    const profiles = parseProfiles(JSON.stringify([{ headers: [{ name: 'x', value: '1' }] }]));
    expect(profiles[0]?.name).toBe('Perfil 1');
    expect(profiles[0]?.color).toMatch(/^#/);
    expect(profiles[0]?.id).toBeTruthy();
  });

  it('descarta headers sin nombre y respeta enabled false', () => {
    const [profile] = parseProfiles(
      JSON.stringify([
        {
          name: 'X',
          headers: [
            { name: '  ', value: '1' },
            { name: 'x-off', value: '2', enabled: false },
          ],
        },
      ])
    );
    expect(profile?.requestHeaders).toHaveLength(1);
    expect(profile?.requestHeaders[0]?.enabled).toBe(false);
  });

  it('falla con un JSON que no es una lista de perfiles o que queda vacia', () => {
    expect(() => parseProfiles('{"otra":"cosa"}')).toThrow('array de perfiles');
    expect(() => parseProfiles('[]')).toThrow('ningun perfil');
    expect(() => parseProfiles('no es json')).toThrow();
  });
});

describe('parseCookies', () => {
  it('lee el formato de chrome.cookies.getAll', () => {
    const [cookie] = parseCookies(
      JSON.stringify([
        {
          name: 'session',
          value: 'abc',
          domain: '.example.com',
          path: '/app',
          secure: true,
          httpOnly: true,
          sameSite: 'no_restriction',
          expirationDate: 1893456000,
        },
      ]),
      'fallback.com'
    );
    expect(cookie).toEqual({
      name: 'session',
      value: 'abc',
      domain: '.example.com',
      path: '/app',
      secure: true,
      httpOnly: true,
      sameSite: 'no_restriction',
      hostOnly: false,
      expirationDate: 1893456000,
    });
  });

  it('usa el dominio de fallback y marca hostOnly', () => {
    const [cookie] = parseCookies(JSON.stringify([{ name: 'x', value: '1' }]), 'example.com');
    expect(cookie?.domain).toBe('example.com');
    expect(cookie?.hostOnly).toBe(true);
    expect(cookie?.path).toBe('/');
    expect(cookie?.expirationDate).toBeNull();
  });

  it('traduce las variantes de sameSite', () => {
    const cookies = parseCookies(
      JSON.stringify([
        { name: 'a', sameSite: 'None' },
        { name: 'b', sameSite: 'Strict' },
        { name: 'c', sameSite: 'Lax' },
        { name: 'd', sameSite: 'cualquiera' },
      ]),
      'example.com'
    );
    expect(cookies.map((cookie) => cookie.sameSite)).toEqual(['no_restriction', 'strict', 'lax', 'unspecified']);
  });

  it('falla cuando no hay ninguna cookie con nombre', () => {
    expect(() => parseCookies('[{"value":"x"}]', 'example.com')).toThrow('ninguna cookie');
    expect(() => parseCookies('"texto"', 'example.com')).toThrow('array de cookies');
  });
});

describe('parseStorageItems', () => {
  it('lee un objeto plano y serializa los valores que no son texto', () => {
    expect(parseStorageItems('{"token":"abc","flags":{"beta":true}}')).toEqual([
      { key: 'token', value: 'abc' },
      { key: 'flags', value: '{"beta":true}' },
    ]);
  });

  it('lee un array de items y descarta los que no tienen clave', () => {
    expect(parseStorageItems('[{"key":"a","value":"1"},{"value":"2"}]')).toEqual([{ key: 'a', value: '1' }]);
  });

  it('falla con listas vacias o con un JSON que no es objeto ni array', () => {
    expect(() => parseStorageItems('[]')).toThrow('ningun item');
    expect(() => parseStorageItems('{}')).toThrow('ningun item');
    expect(() => parseStorageItems('42')).toThrow('objeto');
  });
});
