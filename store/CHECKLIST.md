# Checklist de publicación — Bender

## Estado de la auditoría (5 ago 2026)

| Chequeo | Resultado |
|---|---|
| `npm run typecheck` | ✅ Sin errores |
| `npm test` | ✅ 262 tests, 21 archivos |
| `eval()` / `new Function()` | ✅ Ninguno |
| Código remoto (script/módulo/fetch a URL externa) | ✅ Ninguno |
| `innerHTML` / `document.write` | ✅ Ninguno |
| Salida de red hacia servidores externos | ✅ Ninguna — cero `fetch`/XHR/beacon/WebSocket propios |
| Permisos declarados vs. usados | ✅ Los 9 se usan; ninguno sobra |
| `console.*` en producción | ✅ 1 `console.error` legítimo en el service worker; los otros 2 son strings de plantillas que ve el usuario |
| ZIP con `manifest.json` en la raíz | ✅ `bender-1.0.0.zip`, 21 archivos, 999 KB |
| Íconos 16/32/48/128 | ✅ Presentes y legibles |

**Veredicto: el código pasa todos los chequeos de política de Google.**

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

Están automatizadas. Con `dist/` ya construido:

```bash
npm run screenshots:capture
```

Levanta un Chrome con la extensión cargada, siembra datos inventados
(`e2e/capture/seed.ts`), abre un sitio de demo local (`e2e/capture/demo-site.ts`) y
captura todo en 1280x800 exactos. Sale en `store/screenshots/`:

| Archivo | Qué muestra |
|---|---|
| `01-headers.png` | Perfil "API staging" con 4 headers, valores dinámicos y alcance por dominio |
| `02-trafico.png` | El log con requests reales y la etiqueta del mock que se aplicó |
| `03-reglas.png` | Las cuatro clases de regla: mock, bloqueo, redirect y chaos |
| `04-cookies.png` | La lista del dominio con el decodificador de JWT abierto |
| `05-diseno.png` | El inspector de box model dibujado sobre la página de demo |
| `06-storage.png` | localStorage del origen activo (suplente, si querés cambiar alguna) |

Subí las cinco primeras. Los datos son todos inventados: dominios `acme.dev`, un JWT
sin firma armado a mano. Nunca se capturan cookies ni tokens de cuentas reales.

### Por qué no hay captura de Resumen ni de Scripts

Se generan en `store/screenshots/extra/`, pero **no sirven para subir**: el Chrome que
levanta Playwright no expone `chrome.userScripts`, así que ambas vistas salen con un
cartel de advertencia que un usuario real no ve. Desde Chrome 138 el permiso ya no
depende del modo desarrollador sino de un toggle por extensión que no se puede sembrar
en el perfil antes de conocer el ID.

Si las querés igual, sacalas a mano con la extensión instalada de verdad: DevTools (F12)
→ Ctrl+Shift+M → "Responsive" → 1280 x 800 → tres puntos → "Capture screenshot".

### Capturas hechas a mano

Si alguna te sale en otro tamaño, no la recortes. Dejala en `store/screenshots/raw/` y
corré `npm run screenshots`: cada imagen se escala para entrar completa y se centra
sobre el fondo `#0a0d16` de Bender.

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
usás el repo como sitio web de la ficha, se va a ver mal.

Los textos de `LISTING.md` estaban escritos sin acentos por este mismo motivo; ya se les
pusieron, porque el dashboard de Google recibe UTF-8 sin problema. Al copiarlos, pegalos
directo del archivo — no los pases por un editor que reinterprete el encoding.

### 3. Source maps incluidos

El ZIP incluye los `.map` (unos 750 KB de los 999 KB). Es deliberado: con permisos sensibles
como estos, que el revisor pueda leer el código original agiliza la revisión. Si preferís no
enviarlos: `npm run zip -- --no-maps`.
