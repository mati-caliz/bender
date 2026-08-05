import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteCookieSnapshotSet,
  listCookieSnapshotSets,
  saveCookieSnapshotSet,
} from '@/lib/cookie-snapshots';
import { coerceCookieSnapshotSet } from '@/lib/sanitize';
import type { CookieSnapshot } from '@/types';

const store: Record<string, unknown> = {};

const localStorageArea = {
  get: (key: string) => Promise.resolve({ [key]: store[key] }),
  set: (items: Record<string, unknown>) => {
    Object.assign(store, items);
    return Promise.resolve();
  },
};

vi.stubGlobal('chrome', { storage: { local: localStorageArea } });

const cookie = (name: string, value: string): CookieSnapshot => ({
  name,
  value,
  domain: 'app.local',
  path: '/',
  secure: true,
  httpOnly: false,
  sameSite: 'lax',
  hostOnly: true,
  expirationDate: null,
});

describe('snapshots de cookies', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it('guarda un set y lo devuelve para el dominio', async () => {
    await saveCookieSnapshotSet('app.local', 'admin', [cookie('sid', 'uno')]);
    const sets = await listCookieSnapshotSets('app.local');

    expect(sets).toHaveLength(1);
    expect(sets[0]?.name).toBe('admin');
    expect(sets[0]?.cookies[0]?.value).toBe('uno');
  });

  it('pisa el set cuando se repite el nombre en el mismo dominio', async () => {
    await saveCookieSnapshotSet('app.local', 'admin', [cookie('sid', 'uno')]);
    await saveCookieSnapshotSet('app.local', 'admin', [cookie('sid', 'dos')]);
    const sets = await listCookieSnapshotSets('app.local');

    expect(sets).toHaveLength(1);
    expect(sets[0]?.cookies[0]?.value).toBe('dos');
  });

  it('no mezcla los sets de dominios distintos', async () => {
    await saveCookieSnapshotSet('app.local', 'admin', [cookie('sid', 'uno')]);
    await saveCookieSnapshotSet('otro.local', 'admin', [cookie('sid', 'dos')]);

    expect(await listCookieSnapshotSets('app.local')).toHaveLength(1);
    expect(await listCookieSnapshotSets('otro.local')).toHaveLength(1);
  });

  it('borra por id y deja el resto', async () => {
    await saveCookieSnapshotSet('app.local', 'admin', [cookie('sid', 'uno')]);
    const [guardado] = await saveCookieSnapshotSet('app.local', 'lector', [cookie('sid', 'dos')]);
    const restantes = await deleteCookieSnapshotSet('app.local', guardado?.id ?? '');

    expect(restantes).toHaveLength(1);
    expect(restantes[0]?.name).not.toBe(guardado?.name);
  });

  it('descarta lo guardado que no tiene forma de snapshot', async () => {
    store.benderCookieSnapshots = {
      'app.local': {
        roto: 'no soy un set',
        sinNombre: { id: 'sinNombre', name: '   ', createdAt: 1, cookies: [] },
        valido: { id: 'valido', name: 'admin', createdAt: 1, cookies: [cookie('sid', 'uno'), 'basura'] },
      },
    };
    const sets = await listCookieSnapshotSets('app.local');

    expect(sets).toHaveLength(1);
    expect(sets[0]?.cookies).toHaveLength(1);
  });
});

describe('coerceCookieSnapshotSet', () => {
  it('rechaza el set sin nombre y completa los campos faltantes de una cookie', () => {
    expect(coerceCookieSnapshotSet({ id: 'a', cookies: [] })).toBeNull();

    const set = coerceCookieSnapshotSet({ name: 'admin', cookies: [{ name: 'sid' }] });

    expect(set?.id).toBeTruthy();
    expect(set?.createdAt).toBe(0);
    expect(set?.cookies[0]).toMatchObject({ path: '/', sameSite: 'unspecified', expirationDate: null });
  });
});
