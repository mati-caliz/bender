import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { startDemoSite, type DemoSite } from './demo-site';
import { DEMO_JWT, seedState } from './seed';

/**
 * No es un test: genera las capturas 1280x800 de la ficha de la Chrome Web Store.
 * Corre aparte de la suite e2e con `npm run screenshots:capture`.
 *
 * Bender se abre en una pestana y el sitio de demo en otra, y la del sitio queda
 * adelante: las vistas de Cookies, Storage y Diseno leen `tabs.query({active:true})`,
 * asi que si Bender fuera la pestana activa se estaria mirando a si mismo.
 */

const OUT_DIR = fileURLToPath(new URL('../../store/screenshots', import.meta.url));
/**
 * Vistas que este Chrome no puede mostrar limpias: el Chrome que levanta Playwright
 * no expone `chrome.userScripts`, asi que Resumen y Scripts salen con un cartel de
 * advertencia que no le aparece a un usuario real. Se generan igual, aparte, para
 * poder revisarlas, pero no son candidatas a subir.
 */
const EXTRA_DIR = `${OUT_DIR}/extra`;

const STORE_WIDTH = 1280;
const STORE_HEIGHT = 800;
const VIEWPORT = { width: STORE_WIDTH, height: STORE_HEIGHT };

const shoot = async (page: Page, name: string, dir: string = OUT_DIR): Promise<void> => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/${name}.png`, animations: 'disabled' });
};

const goToView = async (page: Page, label: string): Promise<void> => {
  await page.locator('.nav-item', { hasText: new RegExp(`^${label}`) }).first().click();
  await page.waitForTimeout(400);
};

const openBender = async (context: BrowserContext, extensionId: string): Promise<Page> => {
  const page = await context.newPage();
  await page.setViewportSize(VIEWPORT);
  await page.goto(`chrome-extension://${extensionId}/index.html?surface=tab`);
  await expect(page.locator('.nav-item').first()).toBeVisible();
  return page;
};

test('capturas para la ficha de la Store', async ({ context, extensionId, applyState }) => {
  test.setTimeout(180_000);
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(EXTRA_DIR, { recursive: true });

  const demo: DemoSite = await startDemoSite();

  try {
    await applyState(seedState());

    await context.addCookies([
      { name: 'session_token', value: DEMO_JWT, url: demo.origin },
      { name: 'acme_tenant', value: 'acme-qa', url: demo.origin },
      { name: 'feature_optin', value: 'checkout_v2', url: demo.origin },
      { name: 'locale', value: 'es-AR', url: demo.origin },
    ]);

    // Bender primero: la pestana del sitio se abre despues y le queda adelante.
    const bender = await openBender(context, extensionId);

    const site = await context.newPage();
    await site.setViewportSize(VIEWPORT);
    await site.goto(demo.origin);
    await site.evaluate(() => {
      window.localStorage.setItem('acme.session', '{"userId":"usr_8f21c4","tenant":"acme"}');
      window.localStorage.setItem('acme.theme', 'dark');
      window.localStorage.setItem('acme.lastOrder', '10482');
      window.localStorage.setItem('acme.apiBase', 'https://api.staging.acme.dev/v2');
      window.sessionStorage.setItem('acme.wizardStep', '3');
    });
    await site.bringToFront();
    await site.waitForTimeout(1500);

    await goToView(bender, 'Headers');
    await shoot(bender, '01-headers');

    // El log arrastra la carga de la propia extension: se limpia y se vuelve a
    // pedir solo lo del sitio, para que la captura muestre trafico de verdad.
    await goToView(bender, 'Trafico');
    await bender.getByRole('button', { name: 'Limpiar' }).click();
    await site.reload();
    await site.waitForTimeout(2000);
    await shoot(bender, '02-trafico');

    await goToView(bender, 'Reglas');
    await shoot(bender, '03-reglas');

    await goToView(bender, 'Cookies');
    // Abrir la fila del JWT para que se vea el decodificador.
    await bender.getByText('session_token', { exact: true }).click();
    await shoot(bender, '04-cookies');

    // El inspector se dibuja sobre la pagina, asi que la captura es del sitio.
    await goToView(bender, 'Diseño');
    await bender.getByRole('button', { name: 'Activar' }).click();
    await site.bringToFront();
    await site.waitForTimeout(800);
    // Sobre una tarjeta y no sobre <main>: una caja chica muestra mejor el box model.
    await site.mouse.move(200, 240);
    await site.waitForTimeout(600);
    await shoot(site, '05-diseno');

    await goToView(bender, 'Storage');
    await shoot(bender, '06-storage');

    await goToView(bender, 'Resumen');
    await shoot(bender, 'resumen', EXTRA_DIR);

    await goToView(bender, 'Scripts');
    await shoot(bender, 'scripts', EXTRA_DIR);
  } finally {
    await demo.close();
  }
});
