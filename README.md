# Muttto · Constructor de Menú de Servicios

Landing interna para construir el menú de precios de la peluquería a partir de
servicios seleccionables. Ya viene cargada con los 38 servicios reales del
"Cuadrante del Estilista de Muttto", con sus tiempos de aplicación, exposición
y lavado. Por cada servicio activo la herramienta calcula la **duración
total** y el **precio** aplicando una tarifa por minuto. Al terminar, se
descarga como PDF con el logo de Muttto y una de las 3 gamas cromáticas.

Es una web 100% estática (HTML + CSS + JS, sin backend ni build). Todo el
cálculo y la maquetación del PDF ocurren en el navegador, y **no se guarda
nada**: cada vez que se recarga la página se vuelve a partir de los valores
por defecto (ver "Sin guardado" más abajo).

## Estructura del proyecto

```
index.html   Estructura de la página (panel de edición + vista previa)
styles.css   Estilos, incluidos los 3 temas de color y las reglas de impresión
app.js       Lógica: servicios por defecto, cálculos, exportar PDF
assets/      Logo de Muttto
```

## Cómo funciona

1. **Tarifa por minuto**: 0,85 € / 0,95 € / 1,10 € por minuto (0,85 € es el
   mínimo de referencia), o una 4ª opción para escribir cualquier tarifa
   personalizada. Se aplica a la duración de todos los servicios que no
   tengan un precio manual propio.
2. **Servicios**: cada fila tiene un check (incluir/excluir), nombre,
   categoría, color identificativo, 3 tiempos en minutos (aplicación,
   exposición, lavado), precio y controles para reordenar (↑ ↓) o eliminar.
   La duración y el precio se recalculan al vuelo. Se pueden añadir filas
   nuevas, renombrar, cambiar de categoría, reordenar o eliminar libremente —
   no hay una lista "cerrada" de servicios.
3. **Precio manual**: se puede escribir un precio propio en cualquier fila —
   queda fijo (no lo mueve la tarifa) hasta que se pulsa ↺ para volver al
   cálculo automático. Los servicios que ya traían un precio pactado en el
   documento de referencia se marcan como "★ Recomendado".
4. **Grupos de categoría**: encima de la tabla, un interruptor por categoría
   enciende o apaga de golpe todos sus servicios (sin eliminarlos — para
   quitar uno de la carta basta con desmarcar su casilla, y se puede volver a
   marcar cuando se quiera).
5. **Vista previa**: a la derecha se ve en tiempo real cómo quedará el menú,
   agrupado por categoría.
6. **Gama cromática**: 3 temas —
   - *Verde y Dorado* (premium)
   - *Rosas y Pastel*
   - *Minimalista, Dorado y Blanco*
7. **Imprimir / Descargar PDF**: genera una versión a tamaño A4 con el logo y
   el tema elegido y abre el diálogo de impresión del navegador. Desde ahí se
   elige "Guardar como PDF" (o imprimir en papel). Si el menú tiene muchos
   servicios, se reparte automáticamente en varias páginas — nada se recorta.
   La última página es una guía interna de tiempos (aplicación/exposición/
   lavado) para el equipo, no de cara al cliente.
8. **Sin guardado**: la página no usa `localStorage` ni ningún otro
   almacenamiento — al recargar, siempre se vuelve a los servicios y valores
   por defecto. Los cambios de una sesión de edición no persisten; si se
   necesita retomar una configuración concreta más adelante, hay que volver a
   hacer los ajustes (o guardar el PDF resultante como referencia).

## Cómo publicarla (para que el equipo la use desde una URL)

Al ser una web estática, se puede publicar gratis en minutos con cualquiera de
estas opciones (elige una, no hace falta configurar servidor ni base de
datos):

- **GitHub Pages**: en la configuración del repositorio, activar Pages sobre
  la rama `main` (o la rama por defecto) y carpeta raíz `/`. Quedará
  disponible en `https://<usuario>.github.io/<repositorio>/`.
- **Netlify / Vercel**: conectar el repositorio y desplegar sin configuración
  adicional (no hay build, es "static site").

## Cómo hacer cambios más adelante

Hay dos niveles:

- **Cambios de contenido puntuales** (marcar/desmarcar servicios, ajustar un
  precio, cambiar la tarifa o el tema para un PDF concreto...): se hacen
  **directamente en la propia página**, sin tocar código — recuerda que no se
  guardan: son válidos solo para esa sesión de edición, hasta que se
  descargue el PDF o se recargue la página.

- **Cambios permanentes** (añadir/quitar servicios de forma definitiva,
  cambiar tiempos o precios por defecto, el nombre del salón, el tema por
  defecto...): al no haber guardado en el navegador, hay que editar los
  valores por defecto en el código (`DEFAULT_SERVICES` y `defaultState()` en
  `app.js`) y volver a desplegar — pide este cambio en el repositorio (ver
  siguiente punto) en vez de repetirlo a mano en cada sesión.

- **Cambios de diseño o funcionalidad** (nuevo tema de color, cambiar la
  estructura del PDF, añadir un campo nuevo, cambiar el logo...): requieren
  editar `index.html` / `styles.css` / `app.js`. Sobre "permisos de
  administrador": esta herramienta no tiene login ni backend, así que no
  existe un usuario "admin" dentro de la web — cualquiera con el enlace puede
  editar su propio menú en su navegador (los datos no son compartidos ni
  visibles entre usuarios). Para pedir este tipo de cambios de código, la vía
  más simple es seguir usando esta misma sesión/repositorio de Claude Code: se
  describe el cambio y se sube directamente a la rama del proyecto. Si en el
  futuro quieres que la configuración persista entre sesiones o se comparta
  entre ordenadores, eso ya implicaría añadir guardado o una base de
  datos/backend sencillo — se puede plantear como una mejora aparte si os
  hace falta.

## Desarrollo local

No requiere instalación. Basta con abrir `index.html` en el navegador, o
servir la carpeta con cualquier servidor estático, por ejemplo:

```bash
python3 -m http.server 8000
```

y visitar `http://localhost:8000`.
