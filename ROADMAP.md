# Roadmap

Orden sugerido: fase 0 y 1 son deuda técnica barata que conviene sacar antes de sumar superficie.
Fase 2 en adelante es funcionalidad nueva. Cada tarea es independiente y commiteable sola.

---

## Fase 0 — Bugs y fugas del motor

Todo esto es de bajo riesgo y toca pocos archivos. Ideal para empezar.

### 0.1 Indexar el log de red por `requestId`

- [x] `src/background/network-log.ts`

`findEntry` hace `entries.find(...)` lineal sobre hasta 2000 entradas, y se invoca desde los seis
listeners de `webRequest` por cada request. Sumar un `Map<string, NetworkEntry>` mantenido en
paralelo al array (el array sigue existiendo porque define el orden y el trim).

Cuidar que `trim()` y `clearNetworkLog()` borren también del Map, si no queda una fuga peor que la
que se arregla.

**Verificación:** abrir una página pesada con el log prendido y confirmar que la lista sigue
completa y ordenada.

### 0.2 Limpiar `pendingRuleMatches`

- [x] `src/background/network-log.ts`

`onRuleMatchedDebug` puede llegar para requests que nunca disparan `onBeforeRequest` (por ejemplo
con el log recién detachado). Esas keys no se borran nunca.

Opciones: guardar timestamp y descartar entradas viejas al insertar, o limitar el tamaño del Map.
También conviene vaciarlo en `detach()`.

### 0.3 No volcar el buffer entero a `storage.session`

- [x] `src/background/network-log.ts`

`scheduleFlush` escribe `entries` completo cada 400 ms. Con el buffer en 2000 y headers incluidos
son varios MB por escritura contra una cuota de 10 MB, y el `set` no tiene `catch`, así que si
revienta lo hace en silencio.

Mínimo: agregar el `catch` y reportar el fallo como diagnóstico del motor. Mejor: persistir solo un
recorte (las últimas N entradas o las entradas sin headers) y aceptar que el detalle completo vive
en memoria del service worker.

### 0.4 Sacar el doble arranque

- [x] `src/background/service-worker.ts`

`restoreNetworkLog().then(scheduleApply)` corre en el top level del módulo y otra vez en
`chrome.runtime.onStartup`. En el arranque real del navegador se ejecuta dos veces.

### 0.5 Autenticar el puente con la página

- [x] `src/content/bridge.ts`, `src/content/inject.ts`, `src/types/index.ts`

Hoy los dos lados usan `postMessage(msg, '*')` y solo filtran por `event.source === window` y
`channel === 'bender'`. Consecuencias:

- cualquier script de la página puede inyectar sus propios mocks mandando `type: 'mocks'`;
- cualquier script puede ensuciar el log mandando `mock-hit`;
- las definiciones de mock quedan visibles para la página.

Resuelto con un `MessageChannel` en vez del nonce que decía el plan original: `inject.ts` crea el
canal al cargar y transfiere el `port2` al bridge en un único mensaje de handshake; de ahí en más
mocks y hits viajan por el port, que la página no puede leer ni forjar. El bridge acepta un solo
handshake y lo ignora todo después.

El nonce se descartó porque no aportaba: viajaba en cada mensaje `mocks`, así que cualquier listener
de la página lo leía y podía reusarlo. El `targetOrigin` quedó en `'*'` porque en frames de origen
opaco `location.origin` vale `"null"` y `postMessage` tira `SyntaxError`; siendo un mensaje a la
misma ventana, el `targetOrigin` no aporta seguridad — la protección real es el port.

Queda un resquicio: si un script de la página llega a correr entre el `postMessage` del handshake y
su entrega, puede quedarse con el port. En la práctica los dos content scripts corren en
`document_start`, antes que cualquier script de la página.

### 0.6 Validar el estado en vez de castear

- [x] `src/lib/state.ts`

`normalizeState` hace `stored.profiles as ToolkitState['profiles']` sin mirar los items. Un backup
editado a mano o de una versión vieja rompe con un throw adentro de `compileRules`.

Validar item por item (descartando los inválidos y contándolos) y exponer lo descartado como
diagnóstico del motor, para que el usuario se entere en Ajustes.

### 0.7 Migraciones por `schemaVersion`

- [x] `src/lib/state.ts`, `src/lib/constants.ts`

`SCHEMA_VERSION` existe pero no hay ninguna función de migración. Antes de cambiar la forma de
`Scope` (fase 1) hace falta la infraestructura: un mapa `version -> (state) => state` que se aplique
en cadena dentro de `normalizeState`.

Esto es prerequisito de 1.1 y 1.2.

### 0.8 Evitar el recompile total en cada cambio de pestaña

- [x] `src/background/service-worker.ts`, `src/lib/dnr.ts`

`chrome.tabs.onActivated` dispara `scheduleApply`, que borra y reaplica **todas** las session rules.
Las requests en vuelo durante ese swap salen sin modificar.

Saltear el recompile cuando ninguna regla depende de la pestaña activa: ningún `scope.activeTabOnly`
prendido y CORS sin `allowOrigin: 'reflect'`. Conviene exponer ese cálculo desde `dnr.ts` para no
duplicar la regla en el service worker.

---

## Fase 1 — Cerrar los huecos del scope

Acá se amplía `Scope`, por eso depende de 0.7.

### 1.1 Filtro por método HTTP

- [x] `src/types/index.ts`, `src/lib/scope.ts`, `src/lib/dnr.ts`, `src/lib/mocks.ts`,
      `src/ui/components/ScopeEditor.tsx`, `src/content/inject.ts`

DNR soporta `requestMethods` en la condición y hoy no está expuesto: no se puede bloquear solo los
`POST` ni mockear el `DELETE` distinto del `GET`.

Alcance:

1. sumar `requestMethods: string[]` a `Scope` (vacío = todos) y su migración;
2. mapearlo en `scopeToCondition` / `toRuleCondition`;
3. propagarlo a `MockDefinition` y chequearlo en `findMatchingMock`, que hoy matchea **solo por
   URL** — el mock de `/api/users` intercepta el GET y el POST por igual;
4. pasarle el método a `findMatchingMock` desde los dos call sites de `inject.ts` (fetch y XHR), que
   ya lo tienen calculado;
5. selector de métodos en el `ScopeEditor`.

**Verificación:** tests en `tests/dnr.test.ts` y `tests/mocks.test.ts`.

### 1.2 Filtro por dominio iniciador

- [x] `src/types/index.ts`, `src/lib/scope.ts`, `src/lib/dnr.ts`,
      `src/ui/components/ScopeEditor.tsx`

Hoy solo se compila `requestDomains` ("a qué dominio va la request"). El caso real de ModHeader es
el inverso: "cuando navego `app.local`, tocá todo lo que salga de ahí". Eso es `initiatorDomains`.

Hoy se suple con "solo pestaña activa", que además fuerza el recompile de 0.8.

Sumar `initiatorDomains` / `excludedInitiatorDomains` al `Scope` y dejar claro en la UI la
diferencia entre destino e iniciador, que es lo que más confunde.

### 1.3 Resolver `captureBodies`

- [x] `src/types/index.ts`, `src/lib/constants.ts`

Se sacó al cerrar la fase 1 y volvió en 2.1 ya conectado de punta a punta, con su switch en
Ajustes. Nunca quedó un flag muerto en el estado.

### 1.4 Cubrir `sendBeacon`

- [x] `src/content/inject.ts`

`inject.ts` parchea `fetch` y `XMLHttpRequest`. `navigator.sendBeacon` es barato de sumar y aparece
en todo lo que sea analytics. `EventSource` y `WebSocket` quedan para más adelante: el modelo de
mock actual (status + body) no les aplica.

---

## Fase 2 — Lo que convierte el log en herramienta

### 2.1 Capturar cuerpos de request y response

- [x] `src/content/inject.ts`, `src/content/bridge.ts`, `src/background/network-log.ts`,
      `src/ui/views/NetworkView.tsx`

`webRequest` en MV3 no da cuerpos, pero `inject.ts` ya está parado arriba de `fetch` y XHR: clonar
la response ahí y mandarla por el puente. Respetar el flag `captureBodies` (1.3) y ponerle un tope
de tamaño por entrada.

Limitación a documentar: igual que los mocks, solo cubre lo que pide el JavaScript de la página.

Hecho: `inject.ts` clona la response (y lee `responseText` en XHR), corta a 20.000 caracteres y manda
todo por el port. `recordCapturedBodies` pega los cuerpos a la entrada del log buscando de atrás para
adelante por tab + URL + método, porque no hay un id compartido entre `webRequest` y la página: dos
requests idénticas en vuelo pueden cruzarse.

### 2.2 Convertir una response en mock

- [x] `src/ui/views/NetworkView.tsx`, `src/lib/factories.ts`

**La feature de mejor relación valor/código de todo el roadmap.** Las dos mitades ya existen: el log
con los headers finales y el motor de mocks. Falta el botón que las une.

Desde una entrada del log, crear una `TrafficRule` de tipo `mock` con la URL como `urlFilter`
anclado, el status, el content-type y el body capturado (2.1), y saltar a Reglas con esa regla ya
seleccionada.

Hecho con `createMockRuleFromEntry`: ancla la URL exacta con `|…|`, fija el método de la entrada y
copia status, content-type y cuerpo capturado. Si no se capturó nada, el cuerpo queda vacío.

### 2.3 Copiar como cURL y como fetch

- [x] `src/ui/views/NetworkView.tsx`, `src/lib/format.ts`

Con los headers finales que ya se capturan es casi todo formateo de strings. Cuidado con el escapeo
de comillas en el body para cURL.

### 2.4 Exportar HAR

- [x] `src/background/network-log.ts` o un `src/lib/har.ts` nuevo, `src/ui/views/NetworkView.tsx`

`NetworkEntry` ya tiene casi todos los campos que pide el formato. Reusar `downloadJson`.

---

## Fase 3 — Funcionalidad nueva

### 3.1 Valores dinámicos en headers

- [x] `src/lib/placeholders.ts`, `src/lib/dnr.ts`, `src/background/service-worker.ts`,
      `src/ui/views/HeadersView.tsx`

Placeholders tipo `{{uuid}}`, `{{timestamp}}`, `{{tabUrl}}` en el valor de un header. Es lo que más
se pide para tokens.

Ojo con el modelo: DNR es declarativo, el valor se congela en el momento de compilar. O sea que se
resuelve en cada `applyEngine` y no por request. Para `{{timestamp}}` eso alcanza; documentar el
límite y no prometer más.

Hecho con ocho marcadores (`uuid`, `timestamp`, `unix`, `isoDate`, `random`, `tabUrl`, `tabOrigin`,
`tabHostname`). Un marcador desconocido se manda tal cual y sale como diagnóstico; los de pestaña sin
pestaña activa quedan vacíos y también avisan. `TabOrigin` ahora lleva la URL además del origen, y
`dependsOnTabs` devuelve `true` si algún header prendido usa un marcador de pestaña, para que 0.8 no
deje el valor viejo al cambiar de tab.

### 3.2 Snapshots de cookies

- [x] `src/lib/cookie-snapshots.ts`, `src/lib/sanitize.ts`, `src/ui/views/CookiesView.tsx`,
      `src/ui/hooks/useCookies.ts`

Guardar el set completo de cookies de un origen con un nombre ("admin", "user readonly") y
restaurarlo de un click. Para QA que switchea entre usuarios logueados vale más que el ABM
individual que ya existe.

Reusar la mecánica de apagado blando que ya guarda copias en `chrome.storage.local`.

Hecho: se reusaron los helpers de mapa por scope de `toggleable.ts` (renombrados a
`loadScopedMap` / `saveScopedMap`, porque ya no guardan solo lo apagado). Cada dominio guarda un
`Record<id, CookieSnapshotSet>` y lo leído se pasa por `coerceCookieSnapshotSet` en vez de castear.
Guardar con un nombre que ya existe lo pisa. Restaurar borra las cookies vivas del dominio, escribe
las del snapshot y saca del mapa de apagadas las que el snapshot vuelve a prender.

### 3.3 Entornos

- [ ] `src/types/index.ts`, `src/ui/App.tsx`, vista nueva o dentro de Resumen

Un selector que prende y apaga un conjunto de perfiles + reglas de una (dev / staging / prod), en
vez de togglear uno por uno. Modelar como una lista de nombres de entorno donde cada uno guarda los
ids que deja prendidos.

### 3.4 Export e import por perfil

- [ ] `src/ui/views/HeadersView.tsx`, `src/lib/import.ts`

Hoy el backup es todo o nada (`SettingsView`). Para compartir con el equipo hace falta exportar un
perfil suelto e importarlo sin pisar el resto. El `ImportDialog` y el parser de `import.ts` ya están.

### 3.5 Latencia y fallos globales

- [ ] `src/types/index.ts`, `src/lib/dnr.ts` o `src/content/inject.ts`

Hoy el `delayMs` vive solo adentro de un mock. Sumar una regla de tráfico que solo demore, o que
falle un porcentaje de las requests, sin tener que inventar un body. Chaos testing casero.

### 3.6 Editor de storage y vista de IndexedDB

- [ ] `src/ui/views/StorageView.tsx`, `src/ui/hooks/useWebStorage.ts`

Los valores de `localStorage` suelen ser JSON largo y hoy se editan en un input plano. Sumar
detección de JSON con árbol plegable. IndexedDB es un laburo aparte y bastante más grande: dejarlo
para el final o descartarlo.

### 3.7 Scripts más usables

- [ ] `src/ui/views/ScriptsView.tsx`, `src/ui/components/CodeEditor.tsx`,
      `src/background/userscripts.ts`

- parsear el header `// ==UserScript==` al pegar, para importar de Tampermonkey (`@match`,
  `@run-at`, `@name`);
- mostrar errores de runtime del script, no solo los de registro que ya reporta
  `UserScriptsStatus`;
- reemplazar el `<textarea>` de `CodeEditor` por CodeMirror 6 en configuración mínima.

---

## Fase 4 — Infraestructura

### 4.1 ESLint

- [ ] `package.json`, config nueva

No hay linter. Con `typecheck` y `vitest` ya armados es lo único que falta. Recordar que el proyecto
no usa `eslint-disable`: si una regla molesta, se arregla el código o se saca la regla de la config.

### 4.2 CI

- [ ] `.github/workflows/`

Un workflow que corra `typecheck`, `lint` y `test` en cada push.

### 4.3 Tests del camino de mocks

- [ ] `tests/`

`src/content/inject.ts` son 184 líneas de parcheo de `XMLHttpRequest` —la parte más frágil del
repo— sin un solo test. Dos niveles posibles:

1. unitario con jsdom, simulando el `postMessage` del bridge y verificando los eventos que emite el
   XHR simulado (barato, cubre la mayoría);
2. Playwright levantando Chrome con la extensión cargada desde `dist/` (cubre de verdad, incluye el
   registro de userscripts y las reglas DNR).

Empezar por el 1.
