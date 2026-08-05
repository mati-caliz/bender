import { describe, expect, it } from 'vitest';
import { branchPaths, buildJsonTree, isBranch, jsonKindOf, parseJsonTree, previewOf } from '@/lib/json-tree';

describe('jsonKindOf', () => {
  it('distingue null de object', () => {
    expect(jsonKindOf(null)).toBe('null');
    expect(jsonKindOf({})).toBe('object');
  });

  it('distingue array de object', () => {
    expect(jsonKindOf([])).toBe('array');
  });

  it('reconoce los escalares', () => {
    expect(jsonKindOf('x')).toBe('string');
    expect(jsonKindOf(1)).toBe('number');
    expect(jsonKindOf(true)).toBe('boolean');
  });
});

describe('previewOf', () => {
  it('cuenta los hijos de objetos y arrays', () => {
    expect(previewOf({ a: 1, b: 2 })).toBe('{2}');
    expect(previewOf([1, 2, 3])).toBe('[3]');
  });

  it('entrecomilla los strings', () => {
    expect(previewOf('hola')).toBe('"hola"');
  });

  it('recorta los strings largos', () => {
    const preview = previewOf('x'.repeat(200));
    expect(preview.length).toBeLessThanOrEqual(48);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('muestra los escalares tal cual', () => {
    expect(previewOf(42)).toBe('42');
    expect(previewOf(false)).toBe('false');
    expect(previewOf(null)).toBe('null');
  });
});

describe('parseJsonTree', () => {
  it('devuelve null si el texto no es JSON', () => {
    expect(parseJsonTree('esto no es json')).toBeNull();
    expect(parseJsonTree('{roto')).toBeNull();
  });

  it('devuelve null para JSON valido que no es objeto ni array', () => {
    expect(parseJsonTree('"solo un string"')).toBeNull();
    expect(parseJsonTree('42')).toBeNull();
    expect(parseJsonTree('null')).toBeNull();
  });

  it('tolera espacios alrededor', () => {
    expect(parseJsonTree('  {"a":1}  ')?.kind).toBe('object');
  });

  it('arma el arbol de un objeto anidado', () => {
    const root = parseJsonTree('{"user":{"name":"ana","roles":["admin","qa"]}}');

    expect(root?.kind).toBe('object');
    const user = root?.children[0];
    expect(user?.label).toBe('user');
    expect(user?.children.map((child) => child.label)).toEqual(['name', 'roles']);

    const roles = user?.children[1];
    expect(roles?.kind).toBe('array');
    expect(roles?.preview).toBe('[2]');
    expect(roles?.children.map((child) => child.label)).toEqual(['0', '1']);
  });

  it('usa el indice como label en los arrays', () => {
    const root = parseJsonTree('[10,20]');
    expect(root?.children.map((child) => `${child.label}=${child.preview}`)).toEqual(['0=10', '1=20']);
  });

  it('deja el valor crudo de las hojas sin comillas para poder copiarlo', () => {
    const root = parseJsonTree('{"token":"abc","n":5}');
    expect(root?.children[0]?.raw).toBe('abc');
    expect(root?.children[1]?.raw).toBe('5');
  });

  it('las ramas no tienen valor crudo', () => {
    expect(parseJsonTree('{"a":{}}')?.children[0]?.raw).toBeNull();
  });

  it('da paths unicos a cada nodo', () => {
    const root = parseJsonTree('{"a":{"b":1},"c":[2]}');
    const paths = [root?.path, ...(root?.children.flatMap((child) => [child.path, ...child.children.map((n) => n.path)]) ?? [])];

    expect(paths).toEqual(['$', '$.a', '$.a.b', '$.c', '$.c.0']);
  });
});

describe('branchPaths', () => {
  it('lista solo las ramas, no las hojas', () => {
    const root = buildJsonTree({ a: { b: 1 }, c: [2], d: 3 });
    expect(branchPaths(root)).toEqual(['$', '$.a', '$.c']);
  });

  it('de una hoja no sale ninguna rama', () => {
    expect(branchPaths(buildJsonTree(1))).toEqual([]);
  });
});

describe('isBranch', () => {
  it('solo objetos y arrays se pliegan', () => {
    expect(isBranch('object')).toBe(true);
    expect(isBranch('array')).toBe(true);
    expect(isBranch('string')).toBe(false);
    expect(isBranch('null')).toBe(false);
  });
});
