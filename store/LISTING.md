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
Headers, cookies, storage, CORS, user-agent, mocks, userscripts y log de red. Todo local, en una sola extension para devs.
```

*121 caracteres.*

---

## Descripción detallada

```
Bender reemplaza a ModHeader + Cookie-Editor + Tampermonkey + "Allow CORS" en una sola herramienta, pensada para el dia a dia de desarrollo web.

Todo corre en tu navegador. Bender no tiene servidores, no manda datos a ningun lado y no incluye analytics ni telemetria.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RED

▸ HEADERS
Perfiles de headers de request y response con set / append / remove. Varios perfiles activos a la vez, alcance por dominio, filtro por URL, por tipo de recurso o solo la pestana activa. Valores dinamicos: {{uuid}}, {{timestamp}}, {{tabUrl}} y mas.

▸ REGLAS DE TRAFICO
Bloquear, redirigir (con regex y grupos capturados) o mockear cualquier URL con status, headers, body y delay a medida.

▸ CORS
Un switch que reescribe Access-Control-Allow-*, con opcion de reflejar el origen real de la pestana (lo unico valido cuando la request manda credenciales) y de sacar CSP o X-Frame-Options.

▸ USER-AGENT
Presets de mobile, desktop y bots, los client hints Sec-CH-UA-* y un switch para pisar tambien navigator dentro de la pagina.

▸ TRAFICO
Log en vivo que muestra los headers finales que salieron y que regla de Bender toco cada request. Cuerpos opcionales, copiado como cURL o fetch, export a HAR, y un boton para convertir cualquier response en un mock.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SITIO

▸ COOKIES
ABM completo con todos los atributos, apagado individual, filtro, decodificador de JWT inline y snapshots con nombre del set completo del dominio: saltas entre usuarios logueados de un click.

▸ STORAGE
Lo mismo para localStorage y sessionStorage del origen activo.

▸ SCRIPTS
JavaScript y CSS propios por sitio, con match patterns, momento de ejecucion y eleccion de mundo (el de la pagina o uno aislado).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DISENO

Inspector de box model, regla y medidor de espaciados que se dibujan sobre la pagina. Cuentagotas, auditoria de paleta, tipografias, espaciados y variables :root del sitio.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DONDE VIVE

La misma app en el popup, en el panel lateral y en una pestana completa. Cambia el ancho, no las funciones.

Atajos:
• Alt+Shift+T — prender/apagar todas las reglas
• Alt+Shift+P — abrir el panel lateral

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIVACIDAD

Bender no recolecta ni transmite ningun dato. No hay servidores, analytics ni telemetria. Tu configuracion se guarda solo en tu equipo con chrome.storage.local y ni siquiera se sincroniza con tu cuenta de Google. La extension no hace una sola peticion de red hacia afuera.

Requiere Chrome 120 o superior.
```

---

## Justificación de permisos

Pegar cada texto en su campo del dashboard (pestaña **Privacy practices**).

### `declarativeNetRequest`

```
Es el motor principal de la extension. Aplica las reglas de headers, bloqueo y redireccion que el usuario define explicitamente en la interfaz. Sin este permiso la extension no tiene funcion.
```

### `declarativeNetRequestFeedback`

```
Se usa exclusivamente para onRuleMatchedDebug, que permite mostrarle al usuario que regla suya afecto a cada request en el log de trafico. Es informacion de diagnostico para el propio usuario sobre sus propias reglas; no se registra ni transmite a ningun lado.
```

### `webRequest`

```
Se usa solo en modo lectura para alimentar el log de trafico: URL, metodo, status, timing y los headers finales que efectivamente salieron. Esto ultimo no es obtenible con declarativeNetRequest, que no expone el resultado de las reglas ya aplicadas, y es justamente el valor de la funcion: verificar que la modificacion se aplico. La extension NO declara webRequestBlocking y por lo tanto no puede alterar el trafico por esta via. Los datos quedan en memoria del service worker y se descartan al cerrar el navegador.
```

### `storage`

```
Guarda localmente la configuracion del usuario: perfiles de headers, reglas de trafico, scripts, snapshots de cookies y preferencias. Se usa chrome.storage.local, no sync, asi que nada se replica a la cuenta de Google del usuario.
```

### `cookies`

```
La extension incluye un gestor de cookies: ver, crear, editar y borrar cookies del sitio activo, y guardar snapshots con nombre del set completo de un dominio para alternar entre sesiones de prueba. Es una funcion central y explicita del producto.
```

### `scripting`

```
Dos usos, ambos sobre la pestana activa y a pedido del usuario: leer y escribir localStorage/sessionStorage del origen (el gestor de storage no tiene otra API disponible), y montar el overlay del inspector de diseno sobre la pagina. El codigo inyectado es estatico y viene en el paquete.
```

### `userScripts`

```
La extension permite al usuario escribir y ejecutar sus propios snippets de JavaScript y CSS en los sitios que elija, con match patterns y momento de ejecucion configurables. Es la funcion "Scripts". Todo el codigo lo escribe el usuario en la interfaz de la extension y se guarda solo en su equipo. Bender no trae scripts precargados, no descarga scripts de ningun repositorio y no ejecuta codigo remoto.
```

### `tabs`

```
Necesario para saber cual es la pestana activa y su URL. Con eso la extension acota reglas a la pestana actual, muestra las cookies y el storage del origen correcto, y resuelve valores dinamicos como {{tabUrl}}.
```

### `sidePanel`

```
La interfaz de la extension se puede abrir en el panel lateral de Chrome, ademas del popup, para poder trabajar sin que se cierre al hacer foco en la pagina.
```

### `host_permissions: <all_urls>`

```
Bender es una herramienta de desarrollo de proposito general: modifica headers, gestiona cookies y storage, y registra trafico en los sitios donde el usuario esta trabajando. No es posible saber de antemano en que dominios desarrolla cada usuario -- pueden ser localhost, entornos de staging internos o dominios de produccion propios --, y una lista fija de hosts haria la extension inservible. Ningun dato de esos sitios sale del navegador del usuario: la extension no realiza ninguna peticion de red hacia servidores externos.
```

### Justificación de código remoto

```
La extension NO usa codigo remoto. Todo el JavaScript y CSS se distribuye dentro del paquete. No hay eval(), ni new Function(), ni carga de scripts o modulos desde URLs externas. Los source maps se incluyen en el paquete para facilitar la revision del codigo.
```

---

## Data usage (pestaña Privacy practices)

**Propósito único declarado:**

```
Herramienta de desarrollo web que permite inspeccionar y modificar headers HTTP, cookies, almacenamiento web y trafico de red del navegador durante el desarrollo y testing de sitios.
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
