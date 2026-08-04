import type { UserScriptLanguage, UserScriptRunAt, UserScriptWorld } from '@/types';

export interface ScriptTemplate {
  id: string;
  label: string;
  description: string;
  language: UserScriptLanguage;
  runAt: UserScriptRunAt;
  world: UserScriptWorld;
  code: string;
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'blank',
    label: 'En blanco',
    description: 'Arrancar de cero.',
    language: 'javascript',
    runAt: 'document_idle',
    world: 'MAIN',
    code: "console.log('Bender: script corriendo en', location.href);\n",
  },
  {
    id: 'spoof-navigator',
    label: 'Pisar navigator',
    description: 'Complementa el User-Agent para los sitios que detectan por JS.',
    language: 'javascript',
    runAt: 'document_start',
    world: 'MAIN',
    code: `const mobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

Object.defineProperty(navigator, 'userAgent', { get: () => mobileUserAgent });
Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
`,
  },
  {
    id: 'autofill-login',
    label: 'Autocompletar login',
    description: 'Rellena y envia un formulario de login de un entorno de pruebas.',
    language: 'javascript',
    runAt: 'document_idle',
    world: 'MAIN',
    code: `const userField = document.querySelector('input[name="username"]');
const passwordField = document.querySelector('input[type="password"]');

if (userField && passwordField) {
  userField.value = 'usuario.de.prueba';
  passwordField.value = 'cambiame';
  userField.dispatchEvent(new Event('input', { bubbles: true }));
  passwordField.dispatchEvent(new Event('input', { bubbles: true }));
}
`,
  },
  {
    id: 'log-fetch',
    label: 'Loguear fetch',
    description: 'Imprime en consola cada request que hace la pagina.',
    language: 'javascript',
    runAt: 'document_start',
    world: 'MAIN',
    code: `const originalFetch = window.fetch;

window.fetch = async (input, init) => {
  const started = performance.now();
  const response = await originalFetch(input, init);
  const url = typeof input === 'string' ? input : input.url;
  console.log('[fetch]', response.status, url, \`\${Math.round(performance.now() - started)}ms\`);
  return response;
};
`,
  },
  {
    id: 'hide-noise',
    label: 'Ocultar ruido',
    description: 'Esconde banners, cookie walls y overlays molestos.',
    language: 'css',
    runAt: 'document_start',
    world: 'MAIN',
    code: `[class*="cookie-banner"],
[class*="newsletter-modal"],
[id*="onetrust"] {
  display: none !important;
}

body {
  overflow: auto !important;
}
`,
  },
  {
    id: 'debug-outline',
    label: 'Outline de layout',
    description: 'Pinta el borde de cada elemento para depurar el layout.',
    language: 'css',
    runAt: 'document_idle',
    world: 'MAIN',
    code: `* {
  outline: 1px solid rgb(99 102 241 / 0.35);
}
`,
  },
];
