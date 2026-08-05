# Política de privacidad de Bender

**Última actualización: 5 de agosto de 2026**

Bender es una extensión de Chrome para desarrollo web. Esta política explica qué datos
maneja la extensión y qué hace con ellos.

## Resumen

**Bender no recolecta, transmite, vende ni comparte ningún dato.** No hay servidores de
Bender. No hay analytics, telemetría, crash reporting ni identificadores de usuario. La
extensión no realiza ninguna petición de red hacia ningún servicio externo.

Todo lo que Bender procesa ocurre dentro de tu navegador y se queda ahí.

## Qué datos procesa la extensión

Para cumplir su función, Bender accede localmente a lo siguiente:

| Dato | Para qué | Dónde queda |
|---|---|---|
| Headers de request y response | Mostrarlos en el log de tráfico y aplicar las reglas que vos definís | En memoria del service worker; se descarta al cerrar el navegador |
| URLs, métodos y códigos de estado | Mostrar el log de tráfico de la pestaña | En memoria; el log es volátil y tiene un máximo de entradas configurable |
| Cuerpos de request y response | Solo si activás explícitamente la captura de cuerpos | En memoria, junto con la entrada del log |
| Cookies del sitio activo | Ver, editar, crear, borrar y guardar snapshots por dominio | Las cookies siguen viviendo en Chrome; los snapshots se guardan en el almacenamiento local de la extensión |
| `localStorage` y `sessionStorage` del origen activo | Ver y editar sus claves | Siguen viviendo en el sitio; Bender no los copia a ningún lado |
| Tu configuración (perfiles de headers, reglas, scripts, snapshots) | Que persista entre sesiones | `chrome.storage.local`, solo en tu equipo |

## Lo que Bender NO hace

- No envía nada a ningún servidor, propio ni de terceros.
- No usa `chrome.storage.sync`, así que tu configuración no se replica a tu cuenta de Google.
- No incluye analytics, tracking pixels, SDKs de terceros ni bibliotecas cargadas de forma remota.
- No lee ni transmite credenciales, contraseñas ni información de pago.
- No modifica el tráfico salvo con las reglas que vos creás y activás.
- No ejecuta código descargado de internet. Todo el código está en el paquete de la extensión.

## Scripts de usuario

Bender permite ejecutar JavaScript y CSS que **vos escribís** en los sitios que **vos elegís**,
mediante la API `chrome.userScripts`. Estos scripts:

- Los escribís y los activás vos, uno por uno.
- Se guardan únicamente en tu equipo.
- No se comparten, sincronizan ni suben a ningún lado.
- No vienen scripts precargados ni se descargan scripts de ningún repositorio.

Sos responsable del código que ejecutás con esta función, igual que con la consola del navegador.

## Permisos y por qué existen

- **`declarativeNetRequest` / `declarativeNetRequestFeedback`**: aplicar las reglas de headers,
  bloqueo y redirección, y saber qué regla afectó a cada request.
- **`webRequest`**: observar el tráfico para el log. Se usa en modo lectura; Bender no usa
  `webRequestBlocking` y no puede alterar el tráfico por esta vía.
- **`storage`**: guardar tu configuración localmente.
- **`cookies`**: la función de gestión de cookies.
- **`scripting`**: leer y escribir `localStorage`/`sessionStorage` del origen activo y dibujar el
  inspector de diseño sobre la página.
- **`userScripts`**: ejecutar los scripts que vos escribís.
- **`tabs`**: saber cuál es la pestaña activa, para acotar reglas y mostrar el contexto correcto.
- **`sidePanel`**: abrir la interfaz en el panel lateral.
- **`<all_urls>`**: Bender es una herramienta de desarrollo de propósito general; no puede saber
  de antemano en qué dominios trabajás. Ningún dato de esos sitios sale de tu navegador.

## Cambios

Si esta política cambia, la fecha de arriba se actualiza y el cambio queda registrado en el
historial del repositorio.

## Contacto

Por dudas sobre privacidad: **mati-caliz**
