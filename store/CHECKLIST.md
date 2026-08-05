# Checklist de publicación — Bender

## Estado de la auditoría (5 ago 2026)

| Chequeo | Resultado |
|---|---|
| `npm run typecheck` | ✅ Sin errores |
| `npm test` | ✅ 165 tests, 13 archivos |
| `eval()` / `new Function()` | ✅ Ninguno |
| Código remoto (script/módulo/fetch a URL externa) | ✅ Ninguno |
| `innerHTML` / `document.write` | ✅ Ninguno |
| Salida de red hacia servidores externos | ✅ Ninguna — cero `fetch`/XHR/beacon/WebSocket propios |
| Permisos declarados vs. usados | ✅ Los 9 se usan; ninguno sobra |
| `console.*` en producción | ✅ 1 `console.error` legítimo en el service worker; los otros 2 son strings de plantillas que ve el usuario |
| ZIP con `manifest.json` en la raíz | ✅ `bender-1.0.0.zip`, 19 archivos, 360 KB |
| Íconos 16/32/48/128 | ✅ Presentes y legibles |

**Veredicto: el código pasa todos los chequeos de política de Google.** Pero hay trabajo sin
commitear en el árbol que hay que cerrar antes de generar el ZIP definitivo — ver
"Advertencias → 0" al final.

---

## Antes de empezar

- [ ] Cuenta de desarrollador creada en [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole) (pago único de US$5)
- [ ] Correo de contacto verificado en Account settings
- [ ] `PRIVACY.md` publicado en una URL pública

### Publicar la política de privacidad

La opción más rápida es GitHub Pages sobre el mismo repo:

```bash
git add store/ scripts/zip.mjs package.json
git commit -m "Material de publicacion para Chrome Web Store"
git push
```

Después, en Settings → Pages del repo, activá Pages desde la rama `main` y la carpeta raíz.
La URL queda: `https://<usuario>.github.io/bender/store/PRIVACY`

Alternativa sin Pages: pegar el contenido en un Gist público y usar esa URL.

---

## Generar el paquete

```bash
npm run build
npm run zip
```

Sale `bender-1.0.0.zip`. El script valida que la versión del `manifest.json` coincida con la
del `package.json` y falla si no.

Probar el paquete antes de subirlo: `chrome://extensions` → Modo desarrollador →
Cargar descomprimida → `dist/`.

---

## Completar el dashboard

Todos los textos están en `LISTING.md`, listos para copiar y pegar.

1. **Package** → subir `bender-1.0.0.zip`
2. **Store listing** → nombre, descripciones, categoría, idioma, ícono, capturas
3. **Privacy practices** → propósito único, justificación por permiso, código remoto, las 3 certificaciones
4. **Distribution** → visibilidad y países
5. **Submit for review**

---

## Capturas de pantalla

Requisito: mínimo 1, máximo 5. **1280x800** o 640x400, PNG o JPEG, sin bordes ni marcos.

Recomendadas, en este orden:

1. **Headers** — un perfil activo con varios headers y el alcance configurado
2. **Tráfico** — el log con requests reales y la columna de regla que aplicó
3. **Cookies** — la lista con el decodificador de JWT abierto
4. **Panel lateral** — la app abierta al costado de un sitio real, que muestra el contexto de uso
5. **Diseño** — el inspector de box model dibujado sobre una página

Para capturarlas en 1280x800 exactos, con la extensión cargada:

```
1. Abrir la extensión en pestaña completa (chrome-extension://<id>/index.html)
2. DevTools (F12) → Ctrl+Shift+M → seleccionar "Responsive" → 1280 x 800
3. Menú de los tres puntos de DevTools → "Capture screenshot"
```

Si te salen en otro tamaño, no las recortes a mano. Dejalas en
`store/screenshots/raw/` y corré:

```bash
npm run screenshots
```

Cada imagen se escala para entrar completa y se centra sobre el fondo `#0a0d16` de Bender.
Las versiones de 1280x800 quedan en `store/screenshots/`, listas para subir.

> Sacá las capturas con datos de prueba, no con cookies o tokens de cuentas reales.

---

## Sugerencia de estrategia

Publicá la v1.0.0 como **Unlisted**:

- Funciona con link directo, se instala normal, pero no aparece en búsquedas.
- La revisión suele ser más rápida.
- Te deja verificar el flujo completo de instalación desde la Store antes de exponerla.

Cuando confirmes que todo anda, cambiás la visibilidad a Public. Ese cambio dispara otra
revisión, pero partís de una versión ya aprobada.

**Tiempos esperables:** con `<all_urls>` + `userScripts` + `webRequest`, contá entre 1 y 4
semanas. No es raro que pidan aclaraciones por mail; las respuestas están en `LISTING.md`.

---

## Advertencias

### 0. Hay una feature a medio integrar en el árbol de trabajo — BLOQUEANTE

Durante la auditoría apareció trabajo sin commitear sobre "environments"
(`src/lib/environments.ts` nuevo, más cambios en `state.ts`, `sanitize.ts`, `types/index.ts`,
`OverviewView.tsx`, `RulesView.tsx`, `HeadersView.tsx`, `constants.ts` y `service-worker.ts`).

**No publiques desde este estado.** Antes de generar el ZIP definitivo:

1. Terminá o revertí la feature de environments.
2. Commiteá.
3. Recién ahí `npm run build && npm run zip`.

El `bender-1.0.0.zip` que hay ahora mismo se armó con ese código a medio camino y **no sirve
para enviar**.

Nota: `tests/state.test.ts:68` no contemplaba el contador `environments` que agregó esa feature
y hacía fallar la suite. Quedó corregido.

### 1. `onRuleMatchedDebug` no funciona instalado desde la Store

`chrome.declarativeNetRequest.onRuleMatchedDebug` solo está disponible en extensiones cargadas
descomprimidas. En la versión instalada desde la Chrome Web Store la API es `undefined`.

El código ya lo contempla (`src/background/network-log.ts:185` y `:200` chequean antes de
suscribirse), así que no rompe nada. Pero **la columna "qué regla tocó esta request" va a
aparecer siempre vacía** para quien instale desde la Store.

Opciones:
- Dejarlo así y aclarar en la descripción que esa columna requiere carga descomprimida.
- Derivar la info de forma aproximada matcheando las reglas contra la request en el propio log.

No bloquea la publicación, pero conviene decidirlo antes de que llegue el primer reporte.

### 2. Encoding del README

`README.md` está guardado con mojibake: aparece `pestaÃ±a` y `DiseÃ±o` en vez de `pestaña` y
`Diseño`. Es UTF-8 interpretado como latin-1. No afecta a la extensión ni a la revisión, pero si
usás el repo como sitio web de la ficha, se va a ver mal. Los textos de `LISTING.md` ya están
escritos sin acentos a propósito, para evitar el problema.

### 3. Source maps incluidos

El ZIP incluye los `.map` (unos 250 KB de los 360 KB). Es deliberado: con permisos sensibles
como estos, que el revisor pueda leer el código original agiliza la revisión. Si preferís no
enviarlos: `npm run zip -- --no-maps`.
