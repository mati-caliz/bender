import { describe, expect, it } from 'vitest';
import { decodeJwt, looksLikeJwt } from '@/lib/jwt';

const base64Url = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const buildJwt = (payload: object, header: object = { alg: 'HS256', typ: 'JWT' }): string =>
  `${base64Url(header)}.${base64Url(payload)}.firma`;

describe('looksLikeJwt', () => {
  it('acepta tres segmentos base64url, con firma vacia incluida', () => {
    expect(looksLikeJwt('  abc.def.ghi  ')).toBe(true);
    expect(looksLikeJwt('abc.def.')).toBe(true);
  });

  it('rechaza texto suelto o segmentos de menos', () => {
    expect(looksLikeJwt('abc.def')).toBe(false);
    expect(looksLikeJwt('no es un jwt')).toBe(false);
  });
});

describe('decodeJwt', () => {
  it('decodifica header y payload', () => {
    const decoded = decodeJwt(buildJwt({ sub: '123', name: 'Matias' }));
    expect(decoded?.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(decoded?.payload).toEqual({ sub: '123', name: 'Matias' });
  });

  it('soporta caracteres no ascii', () => {
    expect(decodeJwt(buildJwt({ name: 'Matías Cáliz' }))?.payload.name).toBe('Matías Cáliz');
  });

  it('convierte iat y exp a fechas', () => {
    const issuedAtSeconds = 1700000000;
    const decoded = decodeJwt(buildJwt({ iat: issuedAtSeconds, exp: issuedAtSeconds + 3600 }));
    expect(decoded?.issuedAt?.getTime()).toBe(issuedAtSeconds * 1000);
    expect(decoded?.expiresAt?.getTime()).toBe((issuedAtSeconds + 3600) * 1000);
  });

  it('marca vencido segun exp', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(decodeJwt(buildJwt({ exp: nowSeconds - 60 }))?.expired).toBe(true);
    expect(decodeJwt(buildJwt({ exp: nowSeconds + 60 }))?.expired).toBe(false);
  });

  it('no marca vencido cuando no hay exp', () => {
    const decoded = decodeJwt(buildJwt({ sub: '1' }));
    expect(decoded?.expiresAt).toBeNull();
    expect(decoded?.expired).toBe(false);
  });

  it('devuelve null con contenido que no es JSON valido', () => {
    expect(decodeJwt('abc.def.ghi')).toBeNull();
    expect(decodeJwt('no es un jwt')).toBeNull();
  });
});
