# Importar de otras herramientas

La pestaña Headers acepta exports de ModHeader (`title` / `profile` / `backgroundColor` / `color` /
`headers` / `respHeaders` / `urlFilters` / `appendMode`) y del `dev-toolkit` anterior. Cookies acepta
el formato de `chrome.cookies.getAll`, que es el mismo que exporta Cookie-Editor.

ModHeader repite el mismo header una vez por cada valor que uno quiere tener a mano y deja prendido
el que está usando. Al importar, esos repetidos se juntan en una sola fila con varios valores, salvo
que haya más de uno prendido o que sean `append`, donde cada fila suma de verdad.

Desde el popup, el selector de archivos de Chrome cierra la ventana y se pierde lo cargado, así que
el botón de elegir archivo sigue el import en una pestaña.
