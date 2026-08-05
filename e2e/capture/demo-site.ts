import { createServer, type Server } from 'node:http';

/**
 * Un sitio de mentira para el fondo de las capturas. Tiene que parecer una app
 * de staging real: si el fondo es una pagina en blanco, el inspector de diseno
 * y el panel lateral no muestran nada interesante.
 */
const PAGE = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Acme Panel — staging</title>
<style>
  :root {
    --brand: #4f46e5;
    --ink: #0f172a;
    --muted: #64748b;
    --line: #e2e8f0;
    --surface: #ffffff;
    --canvas: #f8fafc;
    --radius: 12px;
    --gap: 20px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--canvas); color: var(--ink);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { background: var(--surface); border-bottom: 1px solid var(--line);
    padding: 16px 32px; display: flex; align-items: center; gap: 12px; }
  .logo { width: 28px; height: 28px; border-radius: 8px; background: var(--brand); }
  .brand { font-weight: 650; letter-spacing: -0.01em; }
  .env { margin-left: auto; font-size: 12px; font-weight: 600; color: #b45309;
    background: #fef3c7; padding: 4px 10px; border-radius: 999px; }
  main { padding: 32px; max-width: 1100px; }
  h1 { font-size: 26px; letter-spacing: -0.02em; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 28px; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--gap); margin-bottom: 28px; }
  .card { background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 20px; }
  .card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--muted); margin-bottom: 8px; }
  .card .value { font-size: 28px; font-weight: 650; letter-spacing: -0.02em; }
  table { width: 100%; border-collapse: collapse; background: var(--surface);
    border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
  th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--muted); padding: 12px 16px; border-bottom: 1px solid var(--line); }
  td { padding: 14px 16px; border-bottom: 1px solid var(--line); }
  tr:last-child td { border-bottom: 0; }
  .pill { font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 999px; }
  .ok { background: #dcfce7; color: #15803d; }
  .wait { background: #e0e7ff; color: #4338ca; }
</style>
</head>
<body>
  <header>
    <div class="logo"></div>
    <span class="brand">Acme Panel</span>
    <span class="env">staging</span>
  </header>
  <main>
    <h1>Pedidos</h1>
    <p class="sub">Ultima sincronizacion hace 2 minutos</p>
    <div class="cards">
      <div class="card"><div class="label">Pedidos hoy</div><div class="value">128</div></div>
      <div class="card"><div class="label">Ticket promedio</div><div class="value">$ 4.320</div></div>
      <div class="card"><div class="label">En preparacion</div><div class="value">17</div></div>
    </div>
    <table>
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
      <tbody>
        <tr><td>#10482</td><td>Lucia Fernandez</td><td>$ 5.900</td><td><span class="pill ok">Entregado</span></td></tr>
        <tr><td>#10481</td><td>Marco Diaz</td><td>$ 3.150</td><td><span class="pill wait">En camino</span></td></tr>
        <tr><td>#10480</td><td>Sofia Ramos</td><td>$ 7.480</td><td><span class="pill ok">Entregado</span></td></tr>
        <tr><td>#10479</td><td>Julian Costa</td><td>$ 2.200</td><td><span class="pill wait">Preparando</span></td></tr>
      </tbody>
    </table>
  </main>
<script>
  // Trafico para que el log de Bender tenga algo real que mostrar.
  const endpoints = [
    '/api/session', '/api/orders?page=1', '/api/customers?limit=25',
    '/api/metrics/daily', '/api/feature-flags', '/api/orders/10482',
  ];
  for (const path of endpoints) {
    fetch(path, { headers: { 'x-acme-client': 'panel-web' } }).catch(() => {});
  }
</script>
</body>
</html>`;

export interface DemoSite {
  origin: string;
  close: () => Promise<void>;
}

export const startDemoSite = async (): Promise<DemoSite> => {
  const server: Server = createServer((request, response) => {
    const url = request.url ?? '/';

    if (url.startsWith('/api/')) {
      response.writeHead(200, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'x-acme-region': 'sa-east-1',
      });
      response.end(JSON.stringify({ ok: true, path: url, items: [] }));
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(PAGE);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('el sitio de demo no expuso un puerto');

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};
