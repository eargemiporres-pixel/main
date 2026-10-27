# Muttto · Gestor de Proyectos (`/gestor/`)

Gestor de proyectos y tareas para toda la empresa (estilo Monday / ClickUp, en pequeño):
proyectos por **departamento** y **línea de negocio**, responsable, estado, prioridad,
fechas, tareas con vista de lista, tablero (arrastrar y soltar) y cronograma, comentarios,
"Mis tareas", resumen con atrasos y vista de equipo.

- **Departamentos**: Proyectos (nuevo), Operaciones, Marketing, Logística y almacén,
  Finanzas y administración, Formación, Consultoría y equipo interno, Comercial.
- **Líneas de negocio**: Formaciones, Consultoría, Venta de producto, Reformas e interiorismo,
  Venta de mobiliario, Vibro Wellness Suite.
- Los archivos y catálogos se quedan en Google Drive: aquí solo se gestiona el trabajo.

Es estática (HTML/CSS/JS) y se publica sola con GitHub Pages en `…/gestor/`.

## Modo demo (por defecto)
Sin configurar nada funciona ya, pero los datos se guardan **solo en el navegador** y no se
comparten. Usuarios de prueba (contraseña `muttto2026`): proyectos@, comercial@, marketing@,
operaciones@ `muttto.com`. Los proyectos "(EJEMPLO)" se pueden borrar.

## Pasar a la nube compartida (Supabase, gratis)
1. Crear un proyecto en https://supabase.com.
2. SQL Editor → pegar y ejecutar `supabase.sql` (tablas + permisos).
3. Authentication → Providers → Email: desactivar "Confirm email" para que cualquiera pueda
   crear su usuario y entrar al momento.
4. (Opcional) ejecutar `supabase-seed-usuarios.sql`: crea los 4 usuarios tipo con la
   contraseña inicial `Muttto2026!`. No está probado contra todas las versiones de Supabase;
   si falla, los usuarios se crean igual desde la pantalla "Crear usuario nuevo".
5. Project Settings → API: copiar **Project URL** y **anon public key** en `config.js`
   y hacer push. La clave anon es pública por diseño; la seguridad la dan las políticas del SQL.

Privacidad baja a propósito: cualquier persona con usuario ve y edita todo. Para cerrar el
acceso, desactivar "Allow new users to sign up" en Supabase tras crear a las personas.
