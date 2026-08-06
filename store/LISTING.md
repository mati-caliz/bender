# Ficha de Chrome Web Store — Bender

Copiar y pegar cada bloque en el campo correspondiente del Developer Dashboard.

---

## Campos básicos

| Campo | Valor |
|---|---|
| **Nombre** | `Bender` |
| **Categoría** | Developer Tools |
| **Idioma principal** | Español (Latinoamérica) |
| **Visibilidad sugerida** | Unlisted para la v1.0.0 (ver CHECKLIST.md) |

---

## Descripción corta (máx. 132 caracteres)

```
Inspeccioná y modificá el tráfico HTTP, las cookies y el storage de un sitio mientras lo desarrollás. Todo local.
```

*112 caracteres.*

> **No enumeres funciones acá.** La descripción corta es el primer lugar donde un revisor
> evalúa el propósito único. Una lista de siete cosas ("headers, cookies, storage, CORS,
> user-agent, mocks, userscripts...") se lee como un bundle de utilidades sin relación
> entre sí, que es causa directa de rechazo. Un solo propósito, y las funciones como el
> *cómo*, en la descripción larga.

---

## Descripción detallada

```
Bender es una herramienta de desarrollo web con un solo propósito: dejarte inspeccionar y modificar lo que pasa entre el navegador y el sitio que estás construyendo, sin tocar el código del sitio ni levantar un proxy.

Todo lo que sigue son formas de hacer eso mismo: ver una request, cambiarla, repetirla bajo otras condiciones y comprobar el resultado.

Todo corre en tu navegador. Bender no tiene servidores, no manda datos a ningún lado y no incluye analytics ni telemetría.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MODIFICAR LA REQUEST

▸ HEADERS
Perfiles de headers de request y response con set / append / remove. Varios perfiles activos a la vez, alcance por dominio, filtro por URL, por tipo de recurso o solo la pestaña activa. Valores dinámicos: {{uuid}}, {{timestamp}}, {{tabUrl}} y más.

▸ REGLAS DE TRÁFICO
Bloquear, redirigir (con regex y grupos capturados) o mockear cualquier URL con status, headers, body y delay a medida.

▸ ENTORNOS
Guardá con un nombre la combinación de perfiles y reglas que tenés prendida y volvé a ella de un click. Aplicar un entorno deja encendido exactamente lo que ese entorno lista y apagado todo lo demás, así que no quedan reglas sueltas de la sesión anterior. Bender marca solo cuál entorno describe el estado actual.

▸ CORS
Un switch que reescribe Access-Control-Allow-*, con opción de reflejar el origen real de la pestaña (lo único válido cuando la request manda credenciales) y de sacar CSP o X-Frame-Options.

▸ USER-AGENT
Presets de mobile, desktop y bots, los client hints Sec-CH-UA-* y un switch para pisar también navigator dentro de la página.

▸ TRÁFICO
Log en vivo que muestra los headers finales que efectivamente salieron, para comprobar que la modificación se aplicó. Cuerpos opcionales, copiado como cURL o fetch, export a HAR, y un botón para convertir cualquier response en un mock.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSPECCIONAR EL SITIO

▸ COOKIES
ABM completo con todos los atributos, apagado individual, filtro, decodificador de JWT inline y snapshots con nombre del set completo del dominio: saltás entre usuarios logueados de un click.

▸ STORAGE
Lo mismo para localStorage y sessionStorage del origen activo.

▸ SCRIPTS
El equivalente a pegar un snippet en la consola, pero que persiste. JavaScript y CSS que escribís vos, aplicados a los sitios que elegís, con match patterns, momento de ejecución y elección de mundo (el de la página o uno aislado). No trae scripts precargados ni descarga scripts de ningún repositorio: todo el código lo escribís vos y se guarda solo en tu equipo.

▸ DISEÑO
Inspector de box model, regla y medidor de espaciados que se dibujan sobre la página. Cuentagotas, auditoría de paleta, tipografías, espaciados y variables :root del sitio.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DÓNDE VIVE

La misma app en el popup, en el panel lateral y en una pestaña completa. Cambia el ancho, no las funciones.

Atajos:
• Alt+Shift+T — prender/apagar todas las reglas
• Alt+Shift+P — abrir el panel lateral

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIVACIDAD

Bender no recolecta ni transmite ningún dato. No hay servidores, analytics ni telemetría. Tu configuración se guarda solo en tu equipo con chrome.storage.local y ni siquiera se sincroniza con tu cuenta de Google. La extensión no hace una sola petición de red hacia afuera.

Requiere Chrome 120 o superior.
```

---

## Justificación de permisos

Pegar cada texto en su campo del dashboard (pestaña **Privacy practices**).

### `declarativeNetRequest`

```
Es el motor principal de la extensión. Aplica las reglas de headers, bloqueo y redirección que el usuario define explícitamente en la interfaz. Sin este permiso la extensión no tiene función.
```

### `declarativeNetRequestFeedback`

```
Se usa exclusivamente para onRuleMatchedDebug, que permite mostrarle al usuario qué regla suya afectó a cada request en el log de tráfico. Es información de diagnóstico para el propio usuario sobre sus propias reglas; no se registra ni transmite a ningún lado.
```

### `webRequest`

```
Se usa solo en modo lectura para alimentar el log de tráfico: URL, método, status, timing y los headers finales que efectivamente salieron. Esto último no es obtenible con declarativeNetRequest, que no expone el resultado de las reglas ya aplicadas, y es justamente el valor de la función: verificar que la modificación se aplicó. La extensión NO declara webRequestBlocking y por lo tanto no puede alterar el tráfico por esta vía. Los datos quedan en memoria del service worker y se descartan al cerrar el navegador.
```

### `storage`

```
Guarda localmente la configuración del usuario: perfiles de headers, reglas de tráfico, entornos guardados, scripts, snapshots de cookies y preferencias. Se usa chrome.storage.local, no sync, así que nada se replica a la cuenta de Google del usuario.
```

### `cookies`

```
La extensión incluye un gestor de cookies: ver, crear, editar y borrar cookies del sitio activo, y guardar snapshots con nombre del set completo de un dominio para alternar entre sesiones de prueba. Es una función central y explícita del producto.
```

### `scripting`

```
Dos usos, ambos sobre la pestaña activa y a pedido del usuario: leer y escribir localStorage/sessionStorage del origen (el gestor de storage no tiene otra API disponible), y montar el overlay del inspector de diseño sobre la página. El código inyectado es estático y viene en el paquete.
```

### `userScripts`

```
La extensión permite al usuario escribir y ejecutar sus propios snippets de JavaScript y CSS en los sitios que elija, con match patterns y momento de ejecución configurables. Es la función "Scripts". Todo el código lo escribe el usuario en la interfaz de la extensión y se guarda solo en su equipo. Bender no trae scripts precargados, no descarga scripts de ningún repositorio y no ejecuta código remoto.
```

### `tabs`

```
Necesario para saber cuál es la pestaña activa y su URL. Con eso la extensión acota reglas a la pestaña actual, muestra las cookies y el storage del origen correcto, y resuelve valores dinámicos como {{tabUrl}}.
```

### `sidePanel`

```
La interfaz de la extensión se puede abrir en el panel lateral de Chrome, además del popup, para poder trabajar sin que se cierre al hacer foco en la página.
```

### `host_permissions: <all_urls>`

```
Bender es una herramienta de desarrollo de propósito general: modifica headers, gestiona cookies y storage, y registra tráfico en los sitios donde el usuario está trabajando. No es posible saber de antemano en qué dominios desarrolla cada usuario -- pueden ser localhost, entornos de staging internos o dominios de producción propios --, y una lista fija de hosts haría la extensión inservible. Ningún dato de esos sitios sale del navegador del usuario: la extensión no realiza ninguna petición de red hacia servidores externos.
```

### Content script en el mundo MAIN (no hay campo propio: tenerlo listo por si preguntan)

```
El paquete declara dos content scripts. `bridge.js` corre en el mundo aislado y solo pasa mensajes entre la página y el service worker. `inject.js` corre en el mundo MAIN porque necesita envolver window.fetch, XMLHttpRequest y navigator.sendBeacon del propio documento: es la única forma de que un mock definido por el usuario devuelva una respuesta simulada, o de que una regla de latencia o de fallo simulado afecte a las llamadas que hace el JavaScript del sitio. Es exactamente la técnica que usa cualquier librería de mocking en el browser.

Ese wrapper es transparente y pasivo por defecto: si el usuario no tiene ninguna regla activa que matchee la URL, delega en la función original sin tocar argumentos ni respuesta. No lee, acumula ni transmite el contenido de las requests: los cuerpos solo se retienen en memoria si el usuario enciende explícitamente la captura de cuerpos en el log, y se descartan al cerrar el navegador. El código de `inject.js` es estático, viene en el paquete y se puede leer entero con los source maps incluidos.
```

### Justificación de código remoto

```
La extensión NO usa código remoto. Todo el JavaScript y CSS se distribuye dentro del paquete. No hay eval(), ni new Function(), ni carga de scripts o módulos desde URLs externas. Los source maps se incluyen en el paquete para facilitar la revisión del código.
```

---

## Data usage (pestaña Privacy practices)

**Propósito único declarado:**

```
Bender tiene un único propósito: ser una herramienta de depuración web que le permite al desarrollador inspeccionar y modificar la comunicación entre el navegador y un sitio mientras lo está construyendo o probando.

Todas las funciones son medios para ese fin y operan sobre el mismo objeto -- la sesión del navegador con un sitio -- desde una única interfaz y un único almacén de configuración. Los headers y las reglas de tráfico modifican la request; el log verifica el resultado de esa modificación; las cookies y el storage son el estado del lado del cliente que determina cómo responde el sitio; los scripts del usuario y el inspector de diseño actúan sobre el documento que devuelve. Ninguna de estas funciones tiene sentido ni utilidad fuera del contexto de depurar un sitio web, y ninguna opera de forma independiente de las demás.
```

**Recolección de datos — dejar TODAS las casillas SIN marcar:**

| Categoría | Marcar |
|---|---|
| Información de identificación personal | ☐ No |
| Información de salud | ☐ No |
| Información financiera y de pago | ☐ No |
| Autenticación | ☐ No |
| Comunicaciones personales | ☐ No |
| Ubicación | ☐ No |
| Actividad web | ☐ No |
| Contenido del sitio web | ☐ No |

> Justificación: "recolectar" en el sentido de la política de Google significa transmitir datos
> fuera del cliente. Bender no transmite absolutamente nada; todo el procesamiento es local y
> efímero. Si un revisor cuestiona esto, la respuesta está en `PRIVACY.md`.

**Certificaciones — marcar las tres:**

- ☑ No vendo ni transfiero datos de usuarios a terceros, fuera de los casos de uso aprobados
- ☑ No uso ni transfiero datos de usuarios con propósitos ajenos al propósito único del artículo
- ☑ No uso ni transfiero datos de usuarios para determinar solvencia ni con fines de préstamo

---

## URLs a completar

| Campo | Valor |
|---|---|
| **Política de privacidad** | `https://matiascaliz.com.ar/bender/privacidad` |
| **Sitio web** | `https://matiascaliz.com.ar` *(opcional)* |
| **Correo de soporte** | mati-caliz |

El campo **Sitio web** es opcional. No pongas el repositorio: es privado, así que el enlace
daría 404 al revisor y a cualquier usuario, que es peor que dejarlo vacío. Tu página personal
sirve bien, y de paso le da al revisor una identidad real detrás de una extensión con permisos
sensibles.
