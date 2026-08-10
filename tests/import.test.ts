import { describe, expect, it } from 'vitest';
import { createProfile } from '@/lib/factories';
import { mergeProfiles, parseCookies, parseProfiles, parseStorageItems } from '@/lib/import';
import type { Profile } from '@/types';

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

  it('lee un backup de ModHeader con profile, color y headers deshabilitados', () => {
    const profiles = parseProfiles(
      JSON.stringify([
        {
          profile: 'Mati',
          color: '#014461',
          headers: [
            { name: 'x-uow', value: 'tute', enabled: true },
            { name: 'x-version-override', value: 'banners-mx', enabled: false },
          ],
        },
        { profile: 'Secuencialidad', color: '#a344d3', headers: [{ name: 'X-SkipCache', value: 'true' }] },
      ])
    );
    expect(profiles.map((profile) => profile.name)).toEqual(['Mati', 'Secuencialidad']);
    expect(profiles[0]?.color).toBe('#014461');
    expect(profiles[0]?.requestHeaders.map((header) => header.enabled)).toEqual([true, false]);
  });

  it('junta los headers repetidos en una fila con varios valores', () => {
    const [profile] = parseProfiles(
      JSON.stringify([
        {
          profile: 'Mati',
          headers: [
            { name: 'x-version-override', value: 'banners-mx', enabled: false },
            { name: 'x-version-override', value: 'ifood-cruz', enabled: true },
            { name: 'x-version-override', value: 'errores-js', enabled: false },
          ],
        },
      ])
    );
    expect(profile?.requestHeaders).toHaveLength(1);
    expect(profile?.requestHeaders[0]?.value).toBe('ifood-cruz');
    expect(profile?.requestHeaders[0]?.enabled).toBe(true);
    expect(profile?.requestHeaders[0]?.variants).toEqual(['banners-mx', 'errores-js']);
  });

  it('no junta repetidos si hay mas de uno prendido ni si son append', () => {
    const [profile] = parseProfiles(
      JSON.stringify([
        {
          profile: 'Mati',
          headers: [
            { name: 'x-dos', value: 'a', enabled: true },
            { name: 'x-dos', value: 'b', enabled: true },
            { name: 'x-append', value: 'uno', appendMode: true },
            { name: 'x-append', value: 'dos', appendMode: true },
          ],
        },
      ])
    );
    expect(profile?.requestHeaders.map((header) => header.value)).toEqual(['a', 'b', 'uno', 'dos']);
  });

  it('conserva los valores alternativos de un export de Bender', () => {
    const [profile] = parseProfiles(
      JSON.stringify([
        { name: 'Bender', requestHeaders: [{ name: 'x-uow', value: 'tute', variants: ['otro'] }] },
      ])
    );
    expect(profile?.requestHeaders[0]?.variants).toEqual(['otro']);
  });

  it('traduce appendMode a la operacion append', () => {
    const [profile] = parseProfiles(
      JSON.stringify([{ profile: 'Append', headers: [{ name: 'Cookie', value: 'a=1', appendMode: true }] }])
    );
    expect(profile?.requestHeaders[0]?.operation).toBe('append');
  });

  it('ignora los urlFilters deshabilitados', () => {
    const [profile] = parseProfiles(
      JSON.stringify([
        {
          profile: 'Filtros',
          headers: [{ name: 'x', value: '1' }],
          urlFilters: [
            { enabled: false, urlRegex: 'viejo\\.example\\.com' },
            { enabled: true, urlRegex: 'nuevo\\.example\\.com' },
          ],
        },
      ])
    );
    expect(profile?.scope.urlFilter).toBe('nuevo\\.example\\.com');
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

describe('mergeProfiles', () => {
  const profile = (id: string, name = id): Profile => ({ ...createProfile(0), id, name });

  it('agrega los perfiles que no estaban', () => {
    const merged = mergeProfiles([profile('a')], [profile('b')]);
    expect(merged.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('actualiza en su lugar el perfil que ya existe, sin duplicar el id', () => {
    const merged = mergeProfiles([profile('a', 'viejo'), profile('b')], [profile('a', 'nuevo')]);

    expect(merged.map((item) => item.id)).toEqual(['a', 'b']);
    expect(merged[0]?.name).toBe('nuevo');
  });

  it('no toca los perfiles que no vienen en el archivo', () => {
    const intacto = profile('b', 'intacto');
    const merged = mergeProfiles([profile('a'), intacto], [profile('a', 'cambiado')]);

    expect(merged[1]).toBe(intacto);
  });

  it('colapsa ids repetidos dentro del propio import', () => {
    const merged = mergeProfiles([], [profile('a', 'primero'), profile('a', 'segundo')]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe('segundo');
  });

  it('con la lista actual vacia devuelve los importados', () => {
    expect(mergeProfiles([], [profile('a')]).map((item) => item.id)).toEqual(['a']);
  });
});
