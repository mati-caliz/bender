export const escapeForRegExp = (value: string): string => value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

export const compileRegExp = (source: string): RegExp => new RegExp(source);

export const isValidRegExp = (source: string): boolean => {
  try {
    compileRegExp(source);
    return true;
  } catch {
    return false;
  }
};
