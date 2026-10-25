# Limitaciones conocidas

- Pisar `navigator` se registra como userscript por dominio, así que ignora el filtro de URL y el
  alcance "solo la pestaña activa" del User-Agent, y necesita el modo desarrollador prendido.
- El selector nativo de archivos puede cerrar el popup en Linux; para importar conviene el panel
  lateral o la pestaña completa (el cuadro de pegar JSON funciona en los tres).
- Los mocks no cubren navegación ni subrecursos; para eso está el redirect.
- Los cuerpos de las requests los lee la propia página, así que valen las mismas limitaciones que los
  mocks: solo lo que pide su JavaScript. Se cortan a los 20.000 caracteres y se pegan a la entrada
  del log por URL + método, así que dos requests idénticas en vuelo pueden cruzarse.
- Un nombre de header inválido según RFC 7230 se ignora y queda avisado en Resumen y en Ajustes.
- Los valores dinámicos de un header se congelan al compilar las reglas, no se resuelven por request:
  DNR es declarativo. Se recalculan al guardar un cambio, al cambiar de pestaña si el valor depende de
  ella y al arrancar el navegador.
- El inspector de diseño solo entra en el frame principal, y las variables `:root` de hojas de
  estilo cross-origin no se pueden leer. El cuentagotas depende de la API `EyeDropper`.
