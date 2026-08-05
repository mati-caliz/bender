import { expect, expectPoll, readAppliedAt, test } from './fixtures';

test('la extension carga y su motor publica un status', async ({ serviceWorker, extensionId }) => {
  expect(extensionId).toMatch(/^[a-z]{32}$/);

  await expectPoll(async () => (await readAppliedAt(serviceWorker)) > 0);
});

test('el servidor de prueba sirve paginas y registra las requests', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.origin);

  await expect(page.locator('#titulo')).toHaveText('hola');
  expect(server.requests.length).toBeGreaterThan(0);
});
