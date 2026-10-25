# Decisiones que no se leen en el código

**Todo se compila a una sola tanda de reglas DNR de sesión.** El motor (`src/lib/dnr.ts`) toma el
estado completo y devuelve la lista entera de reglas; el service worker borra las anteriores y
aplica las nuevas. Son _session rules_ y no _dynamic rules_ porque son las únicas que aceptan la
condición `tabIds`, que es lo que hace posible el alcance "solo la pestaña activa". Se rearman al
arrancar el navegador, así que no perder persistencia no es un problema.

**Las prioridades definen quién gana.** De menor a mayor: perfiles (10 + posición en la lista),
CORS (100), User-Agent (120), redirects (150) y bloqueos (200). Por eso, si dos perfiles activos
tocan el mismo header, gana el que esté más abajo en el rail, y el User-Agent de su pestaña siempre
le gana a un `user-agent` escrito a mano en un perfil.

**Los mocks no pasan por DNR.** `declarativeNetRequest` solo sabe bloquear o redirigir: no puede
inventar un cuerpo de respuesta. Por eso los mocks se resuelven en la página, parchando `fetch` y
`XMLHttpRequest` desde un content script en el mundo MAIN (`src/content/inject.ts`), con un puente
en el mundo aislado que le pasa las reglas y le reporta los hits al logger. La contra es que solo
aplican a requests que hace el JavaScript de la página: navegación, imágenes y requests de otras
extensiones no se pueden mockear.

**El logger cruza dos fuentes.** `chrome.webRequest` (solo observación, MV3 no permite bloquear)
aporta los headers finales que realmente salieron, y `onRuleMatchedDebug` aporta qué regla matcheó
cada request. Se unen por `requestId`. Ese evento existe únicamente en extensiones cargadas
descomprimidas, que es justo como se usa esta.

**El apagado de cookies y storage es blando.** Apagar un item lo borra del navegador pero guarda una
copia completa en `chrome.storage.local`; prenderlo lo restaura tal cual. Como no hay nada vigilando
en background, si el sitio lo vuelve a crear reaparece con el badge `reaparecio`.

**Restaurar un snapshot de cookies pisa el estado del dominio.** Borra las cookies vivas y escribe
las del snapshot, no las mezcla; si una cookie del snapshot estaba apagada, restaurarla la vuelve a
prender. Las `HttpOnly` entran igual porque las escribe `chrome.cookies`, no la página.

**El spoof de `navigator` viaja como un userscript más.** Es la única vía que corre código propio en
el mundo MAIN en `document_start` de forma sincrónica, antes de que la página lea `navigator`. Se
genera a partir del User-Agent elegido y se re-registra en cada cambio de estado, junto con los
userscripts del usuario.

**El CSS de los userscripts no usa `chrome.userScripts`.** Esa API solo registra JavaScript, así que
los estilos se inyectan con `chrome.scripting.insertCSS` escuchando `tabs.onUpdated`. Consecuencia
práctica: el CSS se aplica al cargar la página, no al instante de guardarlo.
