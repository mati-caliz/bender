# Bender

Doblale las requests al navegador.

Extension de Chrome (Manifest V3) que reemplaza a ModHeader + Cookie-Editor + Tampermonkey +
"Allow CORS" en una sola herramienta, pensada para el dia a dia de desarrollo.

- **Headers**: perfiles de headers de request y response, con `set` / `append` / `remove`, varios
  perfiles activos a la vez, alcance por dominio, filtro de URL, tipo de recurso o solo la pestaña
  activa, y valores dinamicos (`{{uuid}}`, `{{timestamp}}`, `{{tabUrl}}`, …).
- **Reglas de trafico**: bloquear, redirigir (con regex y grupos capturados) o mockear una URL con
  status, headers, body y delay a medida.
- **CORS**: un switch que reescribe `Access-Control-Allow-*`, con opcion de reflejar el origen real
  de la pestaña (lo unico valido cuando la request manda credenciales) y de sacar CSP o
  `X-Frame-Options`.
- **User-Agent**: presets de mobile, desktop y bots, los client hints (`Sec-CH-UA-*`) y un switch para
  pisar tambien `navigator` dentro de la pagina.
- **Cookies**: ABM completo con todos los atributos, apagado individual, filtro, decodificador de
  JWT inline y snapshots con nombre del set completo del dominio, para saltar entre usuarios
  logueados de un click.
- **Storage**: lo mismo para `localStorage` y `sessionStorage` del origen activo.
- **Scripts**: JavaScript y CSS propios por sitio, con match patterns, momento de ejecucion y
  eleccion de mundo (el de la pagina o uno aislado).
- **Trafico**: log en vivo de requests que muestra los headers finales que salieron y que regla de
  Bender toco cada una, con cuerpos opcionales, copiado como cURL o `fetch`, export a HAR y un boton
  para convertir cualquier response en un mock.
- **Diseño**: inspector de box model, regla y medidor de espaciados que se dibujan sobre la pagina,
  mas cuentagotas, auditoria de paleta, tipografias, espaciados y variables `:root` del sitio.

La UI vive en el popup, en el panel lateral y en una pestaña completa: es la misma app, cambia el
ancho.

## Instalar

```bash
npm install
npm run build
```

Despues, en `chrome://extensions`: activar **Modo de desarrollador**, **Cargar descomprimida** y
elegir la carpeta `dist/`.

Hace falta Chrome 120 o mas nuevo (por `chrome.userScripts`) y el modo desarrollador prendido: sin
el, Chrome no expone esa API y la pestaña Scripts avisa.

Para desarrollar, `npm run dev` deja Vite y esbuild en watch; los cambios de UI necesitan cerrar y
volver a abrir el popup, y los del service worker un click en ↻ dentro de `chrome://extensions`.

## Decisiones que no se leen en el codigo

**Todo se compila a una sola tanda de reglas DNR de sesion.** El motor (`src/lib/dnr.ts`) toma el
estado completo y devuelve la lista entera de reglas; el service worker borra las anteriores y
aplica las nuevas. Son *session rules* y no *dynamic rules* porque son las unicas que aceptan la
condicion `tabIds`, que es lo que hace posible el alcance "solo la pestaña activa". Se rearman al
arrancar el navegador, asi que no perder persistencia no es un problema.

**Las prioridades definen quien gana.** De menor a mayor: perfiles (10 + posicion en la lista),
CORS (100), User-Agent (120), redirects (150) y bloqueos (200). Por eso, si dos perfiles activos
tocan el mismo header, gana el que este mas abajo en el rail, y el User-Agent de su pestaña siempre
le gana a un `user-agent` escrito a mano en un perfil.

**Los mocks no pasan por DNR.** `declarativeNetRequest` solo sabe bloquear o redirigir: no puede
inventar un cuerpo de respuesta. Por eso los mocks se resuelven en la pagina, parchando `fetch` y
`XMLHttpRequest` desde un content script en el mundo MAIN (`src/content/inject.ts`), con un puente
en el mundo aislado que le pasa las reglas y le reporta los hits al logger. La contra es que solo
aplican a requests que hace el JavaScript de la pagina: navegacion, imagenes y requests de otras
extensiones no se pueden mockear.

**El logger cruza dos fuentes.** `chrome.webRequest` (solo observacion, MV3 no permite bloquear)
aporta los headers finales que realmente salieron, y `onRuleMatchedDebug` aporta que regla matcheo
cada request. Se unen por `requestId`. Ese evento existe unicamente en extensiones cargadas
descomprimidas, que es justo como se usa esta.

**El apagado de cookies y storage es blando.** Apagar un item lo borra del navegador pero guarda una
copia completa en `chrome.storage.local`; prenderlo lo restaura tal cual. Como no hay nada vigilando
en background, si el sitio lo vuelve a crear reaparece con el badge `reaparecio`.

**Restaurar un snapshot de cookies pisa el estado del dominio.** Borra las cookies vivas y escribe
las del snapshot, no las mezcla; si una cookie del snapshot estaba apagada, restaurarla la vuelve a
prender. Las `HttpOnly` entran igual porque las escribe `chrome.cookies`, no la pagina.

**El spoof de `navigator` viaja como un userscript mas.** Es la unica via que corre codigo propio en
el mundo MAIN en `document_start` de forma sincronica, antes de que la pagina lea `navigator`. Se
genera a partir del User-Agent elegido y se re-registra en cada cambio de estado, junto con los
userscripts del usuario.

**El CSS de los userscripts no usa `chrome.userScripts`.** Esa API solo registra JavaScript, asi que
los estilos se inyectan con `chrome.scripting.insertCSS` escuchando `tabs.onUpdated`. Consecuencia
practica: el CSS se aplica al cargar la pagina, no al instante de guardarlo.

## Limitaciones conocidas

- Pisar `navigator` se registra como userscript por dominio, asi que ignora el filtro de URL y el
  alcance "solo la pestaña activa" del User-Agent, y necesita el modo desarrollador prendido.
- El selector nativo de archivos puede cerrar el popup en Linux; para importar conviene el panel
  lateral o la pestaña completa (el cuadro de pegar JSON funciona en los tres).
- Los mocks no cubren navegacion ni subrecursos; para eso esta el redirect.
- Los cuerpos de las requests los lee la propia pagina, asi que valen las mismas limitaciones que los
  mocks: solo lo que pide su JavaScript. Se cortan a los 20.000 caracteres y se pegan a la entrada
  del log por URL + metodo, asi que dos requests identicas en vuelo pueden cruzarse.
- Un nombre de header invalido segun RFC 7230 se ignora y queda avisado en Resumen y en Ajustes.
- Los valores dinamicos de un header se congelan al compilar las reglas, no se resuelven por request:
  DNR es declarativo. Se recalculan al guardar un cambio, al cambiar de pestaña si el valor depende de
  ella y al arrancar el navegador.
- El inspector de diseño solo entra en el frame principal, y las variables `:root` de hojas de
  estilo cross-origin no se pueden leer. El cuentagotas depende de la API `EyeDropper`.

## Importar de otras herramientas

La pestaña Headers acepta exports de ModHeader (`title` / `backgroundColor` / `headers` /
`respHeaders` / `urlFilters`) y del `dev-toolkit` anterior. Cookies acepta el formato de
`chrome.cookies.getAll`, que es el mismo que exporta Cookie-Editor.
