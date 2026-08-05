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

El repo es privado, así que GitHub Pages no sirve (Pages sobre repos privados es una función
de los planes pagos). Se cuelga de **matiascaliz.com.ar**, que ya es un dominio propio con
certificado:

```
https://matiascaliz.com.ar/bender/privacidad
```

Va ahí y no en gastronova.com.ar: para el revisor, la política de una herramienta de desarrollo
firmada por su autor cierra sola, mientras que alojarla bajo la marca de un negocio de
gastronomía es justo el tipo de incoherencia que dispara una pregunta por mail.

La página lista para servir es `store/privacy.html`: autocontenida, sin una sola request
externa, y se adapta a tema claro y oscuro. `store/PRIVACY.md` es la fuente en markdown; si
tocás uno, tocá el otro.

Desde la raíz del repo, reemplazando `<IP>` por la del VPS:

```bash
ssh root@<IP> 'mkdir -p /var/www/bender'
scp store/privacy.html root@<IP>:/var/www/bender/
```

Después, en el server block que ya atiende `matiascaliz.com.ar` en el 443, pegar el bloque
`location` que está en `store/nginx-bender.conf` y recargar:

```bash
ssh root@<IP> 'nginx -t && systemctl reload nginx'
```

No hace falta certificado nuevo: el que ya tiene el dominio cubre la ruta. Si el dominio no
está servido desde este VPS, el mismo archivo trae un `server { }` completo para levantar
`bender.matiascaliz.com.ar` como subdominio.

Antes de pegar la URL en el dashboard, abrila desde afuera del servidor y confirmá que dé 200
por HTTPS y sin advertencia de certificado.

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
como estos, que el revisor pueda leer el código original agiliza la revisión. Con el repo
privado esto pesa todavía más: los source maps son lo único que le permite al revisor ver el
código como lo escribiste. **Dejalos.**

### 4. La URL de la política es infraestructura de la publicación

`https://matiascaliz.com.ar/bender/privacidad` tiene que seguir respondiendo mientras la
extensión esté publicada. Si el dominio se deja vencer, el VPS se da de baja o una migración
cambia las rutas, el enlace muere y Google puede bajar la extensión por política de privacidad
rota — sin más aviso que un mail.

Dos consecuencias prácticas:

- Poné la renovación del dominio en automático.
- Si algún día rehacés matiascaliz.com.ar, `/bender/privacidad` es una ruta que hay que
  preservar o redirigir, no una que se pueda borrar.
