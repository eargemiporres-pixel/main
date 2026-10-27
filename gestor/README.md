# Muttto · Gestor de Proyectos (`gestor/`)

Gestor de proyectos y tareas para toda la empresa (estilo Monday / ClickUp, en pequeño):
proyectos por **departamento** y **línea de negocio**, responsable, estado, prioridad,
fechas; tareas en lista, tablero (arrastrar y soltar) y cronograma; comentarios,
"Mis tareas", resumen con atrasos y vista de equipo. Los archivos y catálogos siguen en Drive.

- **Departamentos**: Proyectos (nuevo), Operaciones, Marketing, Logística y almacén,
  Finanzas y administración, Formación, Consultoría y equipo interno, Comercial.
- **Líneas**: Formaciones, Consultoría, Venta de producto, Reformas e interiorismo,
  Venta de mobiliario, Vibro Wellness Suite.

## Cómo funciona
Un servidor Node sin librerías web (`server.js`, solo `pg` para Postgres) que sirve la web (`public/`) y una API con
usuario y contraseña (contraseñas con scrypt, sesión en cookie). Los datos se guardan en
la base de datos Postgres de Render. Sin `DATABASE_URL` (en local) usa un archivo
`data.json`, solo para pruebas.

## Publicar en Render (desde GitHub)
1. En Render: **New → Blueprint** y elegir este repositorio. Lee `render.yaml` (en la raíz)
   y crea el servicio web `muttto-gestor` y la base de datos `muttto-gestor-db`.
2. Esperar al primer despliegue y abrir la URL `https://muttto-gestor.onrender.com`
   (o la que asigne Render). Cada push a la rama conectada vuelve a desplegar solo.
3. Al arrancar con la base vacía se crean 4 usuarios tipo y 3 proyectos "(EJEMPLO)":
   `proyectos@`, `comercial@`, `marketing@`, `operaciones@` `muttto.com`,
   contraseña inicial `Muttto2026!` (cámbiala con la variable `INITIAL_PASSWORD`
   antes del primer arranque, o crea usuarios nuevos y borra estos).
4. Cualquiera puede crear su usuario desde "Crear usuario nuevo". Para cerrar el registro
   una vez entre todo el equipo, poner la variable `ALLOW_SIGNUP=false`.

**Coste y límites:** `render.yaml` usa plan `starter` (web) y `basic-256mb` (base de datos),
de pago, para que no se duerma ni caduque. La base de datos gratuita de Render se borra a
los 30 días, así que no es apta para datos reales; si pruebas con el plan gratuito, pon
`plan: free` en ambos y no guardes nada importante.

## Desarrollo local
```bash
cd gestor && npm install && npm start   # http://localhost:3000
```
