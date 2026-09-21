# Muttto · Constructor de Carta de Servicios

Landing interna para construir la carta de precios de la peluquería a partir de
servicios seleccionables. Por cada servicio activo se indican sus tiempos
(aplicación, exposición, lavado), la herramienta calcula la **duración total**
y el **precio** aplicando una tarifa por minuto. Al terminar, se exporta como
PDF con el logo de Muttto y una de las 3 gamas cromáticas.

Es una web 100% estática (HTML + CSS + JS, sin backend ni build). Todo el
cálculo y la maquetación del PDF ocurren en el navegador.

## Estructura del proyecto

```
index.html   Estructura de la página (panel de edición + vista previa)
styles.css   Estilos, incluidos los 3 temas de color y las reglas de impresión
app.js       Lógica: servicios por defecto, cálculos, guardado, exportar PDF
assets/      Logo de Muttto
```

## Cómo funciona

1. **Tarifa por minuto**: se elige entre 0,85 € / 0,95 € / 1,10 € por minuto
   (0,85 € es el mínimo de referencia). La tarifa se aplica a la duración de
   todos los servicios activos.
2. **Servicios**: cada fila tiene un check (incluir/excluir), nombre,
   categoría, color identificativo y 3 tiempos en minutos (aplicación,
   exposición, lavado). La duración y el precio se recalculan al vuelo. Se
   pueden añadir filas nuevas, renombrar, cambiar de categoría o eliminar
   libremente — no hay una lista "cerrada" de servicios.
3. **Vista previa**: a la derecha se ve en tiempo real cómo quedará la carta,
   agrupada por categoría.
4. **Gama cromática**: 3 temas —
   - *Verde y Dorado* (premium)
   - *Rosas y Pastel*
   - *Minimalista, Dorado y Blanco*
5. **Imprimir / Descargar PDF**: genera una versión a tamaño A4 con el logo y
   el tema elegido y abre el diálogo de impresión del navegador. Desde ahí se
   elige "Guardar como PDF" (o imprimir en papel). Si la carta tiene muchos
   servicios, se reparte automáticamente en varias páginas — nada se recorta.
6. **Guardado**: la carta se guarda automáticamente en el navegador
   (`localStorage`), así que si se cierra la pestaña no se pierde nada. Además
   hay botones para **exportar** la configuración a un archivo `.json` (copia
   de seguridad o para pasarla a otro ordenador) e **importarla** de vuelta.

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

- **Cambios de contenido** (añadir/quitar servicios, cambiar tiempos, precios,
  nombre del salón, tema de color por defecto...): se hacen **directamente en
  la propia página**, sin tocar código. Es el uso normal de la herramienta.
  Si varias personas del equipo la usan desde distintos ordenadores y quieres
  que todas vean la misma configuración, exporta el `.json` desde un puesto e
  impórtalo en los demás (o guardadlo en un Drive/Dropbox compartido).

- **Cambios de diseño o funcionalidad** (nuevo tema de color, cambiar la
  estructura del PDF, añadir un campo nuevo, cambiar el logo...): requieren
  editar `index.html` / `styles.css` / `app.js`. Sobre "permisos de
  administrador": esta herramienta no tiene login ni backend, así que no
  existe un usuario "admin" dentro de la web — cualquiera con el enlace puede
  editar su propia carta en su navegador (los datos no son compartidos ni
  visibles entre usuarios). Para pedir este tipo de cambios de código, la vía
  más simple es seguir usando esta misma sesión/repositorio de Claude Code: se
  describe el cambio y se sube directamente a la rama del proyecto. Si en el
  futuro quieres que un cambio hecho por una persona (p. ej. los precios) se
  vea igual en todos los ordenadores sin tener que importar el `.json` a mano,
  eso ya implicaría añadir una base de datos/backend sencillo — se puede
  plantear como una mejora aparte si os hace falta.

## Desarrollo local

No requiere instalación. Basta con abrir `index.html` en el navegador, o
servir la carpeta con cualquier servidor estático, por ejemplo:

```bash
python3 -m http.server 8000
```

y visitar `http://localhost:8000`.
