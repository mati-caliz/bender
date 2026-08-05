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
Headers, cookies, storage, CORS, user-agent, mocks, userscripts y log de red. Todo local, en una sola extensión para devs.
```

*121 caracteres.*

---

## Descripción detallada

```
Bender reemplaza a ModHeader + Cookie-Editor + Tampermonkey + "Allow CORS" en una sola herramienta, pensada para el día a día de desarrollo web.

Todo corre en tu navegador. Bender no tiene servidores, no manda datos a ningún lado y no incluye analytics ni telemetría.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RED

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
Log en vivo que muestra los headers finales que salieron y qué regla de Bender tocó cada request. Cuerpos opcionales, copiado como cURL o fetch, export a HAR, y un botón para convertir cualquier response en un mock.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SITIO

▸ COOKIES
ABM completo con todos los atributos, apagado individual, filtro, decodificador de JWT inline y snapshots con nombre del set completo del dominio: saltás entre usuarios logueados de un click.

▸ STORAGE
Lo mismo para localStorage y sessionStorage del origen activo.

▸ SCRIPTS
JavaScript y CSS propios por sitio, con match patterns, momento de ejecución y elección de mundo (el de la página o uno aislado).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DISEÑO

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

### Justificación de código remoto

```
La extensión NO usa código remoto. Todo el JavaScript y CSS se distribuye dentro del paquete. No hay eval(), ni new Function(), ni carga de scripts o módulos desde URLs externas. Los source maps se incluyen en el paquete para facilitar la revisión del código.
```

---

## Data usage (pestaña Privacy practices)

**Propósito único declarado:**

```
Herramienta de desarrollo web que permite inspeccionar y modificar headers HTTP, cookies, almacenamiento web y tráfico de red del navegador durante el desarrollo y testing de sitios.
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
| **Política de privacidad** | *(obligatorio — publicar `PRIVACY.md` y pegar la URL aquí)* |
| **Sitio web** | URL del repositorio |
| **Correo de soporte** | mati-caliz |
