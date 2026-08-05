export const escapeForRegExp = (value: string): string => value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
