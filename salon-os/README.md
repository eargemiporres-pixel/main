# Salon OS · CRM/ERP para salones de belleza

Cuadro de mando, clientes, caja y distribución de producto para salones de
peluquería y belleza, con una consola para el distribuidor/asesor que da
servicio a varios salones.

Primera versión funcional (v0.1). Sin dependencias externas: Node.js 22 con
su servidor HTTP y su SQLite integrados, y una interfaz web en HTML/CSS/JS.

## Probarlo en 1 minuto

Necesitas Node.js 22.13 o superior (la versión LTS de https://nodejs.org).

- **Windows**: doble clic en `Iniciar demo (Windows).bat`.
- **Mac**: doble clic en `Iniciar demo (Mac).command` (la primera vez: clic
  derecho → Abrir).
- **Desde la terminal**, en cualquier sistema:

```bash
cd salon-os
npm run demo          # carga 6 salones de ejemplo con ~20 meses de actividad
```

Se abre solo el navegador en http://localhost:3000. Para pararla, cierra la
ventana negra o pulsa Ctrl + C.

| Acceso | Email | Contraseña |
| --- | --- | --- |
| Dueño de salón (Estudio Norte) | `norte@demo.com` | `demo1234` |
| Distribuidor (consola de la red) | `admin@demo.com` | `demo1234` |

Los demás salones de la demo: `alba@`, `ondas@`, `lia@`, `rizo@`, `sol@demo.com`.
`npm run demo:reset` borra la demo y la vuelve a generar.

## Qué hace

**Para cada salón**

- **Panel**: por mes, trimestre o año (y cualquier mes anterior):
  - facturación, crecimiento mensual, trimestral y anual, facturación por
    empleado, precio hora, y facturación en servicios y en producto;
  - servicios vendidos, retail vendido, ticket medio, servicios de mujer y de
    hombre, capacidad potencial y ocupación;
  - empleados, clientes atendidos, clientes por colaborador, clientes nuevos,
    visitas, horas trabajadas y tiempo medio por cliente;
  - pedidos de compra, producto comprado, consumo de producto (%) y stock
    estimado;
  - rendimiento por empleado, servicios más contratados y recomendaciones
    automáticas.
- **Clientes**: estado automático (Nueva, Fiel, VIP, En riesgo, Perdida).
  La ficha incluye visitas al mes, recurrencia, ticket medio, gasto,
  producto retail comprado, top 3 servicios, historial, próxima visita
  estimada, notas técnicas y un botón de WhatsApp.
- **Nuevo cobro**: TPV sencillo para salones sin integración. En pocos
  toques registra servicios y productos, cliente, empleado, método de pago y
  hora de inicio y fin.
- **Caja**: dinero que entra y sale cada día, desglosado por método de pago.
  También permite:
  - registrar gastos e ingresos;
  - hacer el arqueo de efectivo y ver el descuadre;
  - cerrar la caja (después no se pueden anular cobros de ese día).
- **Equipo y horas**, **servicios y productos**, **pedidos de producto** y
  **ajustes**.

**Para ti (distribuidor / dueño del SaaS)**

- Salones activos, lo que ingresas por suscripciones (MRR), lo que factura
  toda la red, el producto vendido a los salones y los salones en riesgo.
- **Señales de compra**: cada salón suele pedir producto técnico cada X
  días. Con su actividad reciente en caja se estiman los días de stock que
  le quedan y el importe del pedido sugerido.
- **Asesorías a priorizar**:
  - riesgos: caídas de facturación, ocupación baja o consumo alto;
  - oportunidades: por ejemplo, una ocupación alta.
- **Media de la red** y una tabla de salones con filtros.
- Botón **Ver panel**, que abre cualquier salón con todos sus datos.
- Altas de salones y edición de su plan y cuota.

## Cómo entran los datos (sin teclear dos veces)

1. **Importación CSV/Excel** (*Conectar TPV / importar*). Casi todos los TPV
   y programas de peluquería exportan sus ventas. Salon OS reconoce las
   columnas por su nombre, en español o en inglés: fecha, ticket, cliente,
   teléfono, empleado, concepto, cantidad, importe, forma de pago, horas…
   - Entiende números y fechas en formato español.
   - Crea solo los clientes, empleados y servicios que falten.
   - Muestra una revisión antes de guardar.
   - No duplica nada si se vuelve a importar el mismo archivo.
   - Hay una plantilla descargable en la propia pantalla.
2. **API de integración**, para que los datos lleguen en tiempo real. Cada
   salón tiene su clave:
   - `POST /api/ingest/tickets`: cobros, con cliente, empleado y líneas.
   - `POST /api/ingest/hours`: fichajes u horas trabajadas.
   - `POST /api/ingest/expenses`: gastos, por ejemplo desde el banco.

   Se autentica con `Authorization: Bearer <clave>`. El campo `ref` de cada
   ticket evita duplicados. Sirve para conectar un TPV, un integrador o una
   automatización (Zapier, Make, n8n…).
3. **Cobro manual** desde la pantalla *Nuevo cobro*.

## Cómo se calcula cada métrica

| Métrica | Cálculo |
| --- | --- |
| Ticket medio | facturación / nº de visitas (tickets) |
| Clientes atendidos | clientes distintos con al menos un ticket en el periodo |
| Clientes nuevos | clientes cuya primera visita cae en el periodo |
| Horas trabajadas | horas registradas en *Equipo*. Si no hay, se estiman: empleados × horas/mes (en *Ajustes*) |
| Precio hora | facturación / horas trabajadas |
| Ocupación | horas de servicio vendidas (duración de cada servicio) / horas trabajadas |
| Capacidad potencial | horas trabajadas × facturación por hora de servicio vendida |
| Tiempo medio por cliente | media de (hora de fin − hora de inicio). Si no hay horas, se estima con la duración de los servicios |
| Consumo de producto | compras de producto técnico / facturación en servicios |
| Crecimiento mensual | mes vs mes anterior |
| Crecimiento trimestral | últimos 3 meses vs los 3 anteriores |
| Crecimiento anual | de enero al mes elegido vs el mismo tramo del año anterior |
| Stock estimado | (intervalo medio entre pedidos − días desde el último) / ritmo de actividad de los últimos 30 días |

Un periodo en curso siempre se compara con **los mismos días** del periodo
anterior. Así, el mes a medias no sale en negativo frente a un mes completo.

## Estructura

```
salon-os/
  server.js          arranque (variables de entorno abajo)
  src/db.js          esquema SQLite
  src/app.js         API JSON y archivos estáticos
  src/metrics.js     motor de métricas y recomendaciones
  src/clients.js     clientes y ficha
  src/importer.js    alta de cobros (CSV y API), idempotente
  src/csv.js         lectura de CSV de TPVs
  src/network.js     consola del distribuidor y señales de compra
  src/auth.js        contraseñas (scrypt) y sesiones
  src/seed.js        datos de demostración
  public/            interfaz web (index.html, app.js, styles.css)
  test/              tests (npm test)
```

## Puesta en producción

Necesita un servidor con Node.js 22.13 o superior y **disco persistente**
para el archivo SQLite. Opciones sencillas: Railway, Render o Fly.io con un
volumen, o cualquier VPS. Hay un `Dockerfile` listo:

```bash
docker build -t salon-os .
docker run -p 3000:3000 -v salon-data:/data \
  -e ADMIN_EMAIL=tu@email.com -e ADMIN_PASSWORD='una-contraseña-larga' \
  -e COOKIE_SECURE=1 salon-os
```

| Variable | Uso |
| --- | --- |
| `PORT` | puerto (3000 por defecto) |
| `DB_PATH` | archivo de la base de datos |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | cuenta del distribuidor que se crea en el primer arranque |
| `DEMO=1` | si la base está vacía, la llena con datos de ejemplo |
| `COOKIE_SECURE=1` | cookie de sesión solo por HTTPS (actívalo en producción) |

Copias de seguridad: basta con copiar el archivo `.db`, por ejemplo con
`sqlite3 salon-os.db ".backup copia.db"`.

## Seguridad

- Cada salón solo ve sus datos: todas las consultas filtran por salón. Hay
  tests que lo comprueban.
- Contraseñas con scrypt y sal.
- Sesiones en una cookie `HttpOnly` y `SameSite=Lax`.
- Límite de intentos de login.
- Las peticiones que modifican datos exigen JSON, lo que protege frente a
  CSRF.
- Cabeceras de seguridad y política de contenido (CSP).

## Próximos pasos sugeridos

- Conectores directos con los TPV más usados por tus salones.
- Agenda y citas, con recordatorios automáticos por WhatsApp o SMS.
- Comisiones por empleado y objetivos.
- Informe mensual en PDF para cada salón, que puedes enviar como asesor.
- Catálogo de tu producto y pedidos que el salón hace desde la app.
- Usuarios de tipo empleado, con permisos limitados.
