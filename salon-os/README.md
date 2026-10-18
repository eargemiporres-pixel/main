# SalonPro · CRM/ERP para salones de belleza

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

### Demo sin instalar nada (en el navegador)

`web-demo/` contiene una versión que funciona entera en el navegador: el
mismo código del servidor corre dentro de la página con SQLite en memoria
(sql.js), así que no necesita servidor ni base de datos. Los datos de ejemplo
se generan al abrirla y se reinician al recargar. Sirve para enseñar la
herramienta con un enlace.

```bash
node web-demo/build.mjs        # genera web-demo/dist, publicable en cualquier hosting estático
```

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

**Agenda y reservas online**

- **Agenda semanal** por estilista, con huecos fuera del horario sombreados y
  línea de la hora actual. En el móvil se muestra como lista por días.
- **Nueva cita en tres toques:** clienta, servicios (la duración se suma sola) y
  uno de los huecos libres que propone. Si eliges «cualquiera libre», se asigna
  a quien tenga menos citas.
- Desde una cita:
  - confirmar, cambiar día u hora, marcar que no vino o cancelar;
  - **Empezar servicio**, que arranca el cronómetro del cobro y así mide el
    tiempo real;
  - **Cobrar** con todo ya rellenado.
- **Página de reservas para clientas** en `/reservar/<salón>`: servicios,
  profesional, día y hora. Se puede incrustar en la web del salón.
  - La reserva entra en la agenda, se crea la ficha si es nueva y el salón
    recibe un aviso en Mensajes.
  - La clienta recibe un enlace para añadir la cita a su calendario o
    cancelarla.
- **Recordatorio «Citas de mañana»** en Mensajes, para reducir los plantones.
- **Conexión con otras agendas:**
  - calendarios iCal (Google Calendar, Outlook y muchos programas de reservas),
    que se sincronizan cada 15 minutos;
  - `POST /api/ingest/appointments` para Booksy, Treatwell o Fresha vía Make o
    Zapier: crea, mueve y cancela citas por su referencia;
  - la agenda como calendario suscribible desde el móvil.

**Tiempos reales y rentabilidad**

- El tiempo real de cada servicio sale de la hora de inicio y fin de cada
  ticket: cronómetro del cobro, TPV o importación. Si un ticket tiene varios
  servicios, su tiempo se reparte según la duración del menú.
- **Tiempos y rentabilidad**, por servicio y por empleado:
  - minutos del menú frente a minutos reales;
  - precio, €/min y €/hora;
  - **rentable a partir de 0,85 €/min** (el distribuidor lo puede cambiar por
    salón), con el precio mínimo o el tiempo necesario para llegar.
- **Reporte del salón para el distribuidor** (pantalla, impresión y Excel
  `.xlsx`): empleados, horas, servicios y ticket medio por empleado; servicios y
  ticket medio de mujer y de hombre; ticket medio general y precio hora;
  precios y tiempos de cada servicio; panel de rentabilidad.

**Comunicación con clientes (Mensajes)**

- Bandeja compartida de conversaciones (WhatsApp, email, SMS) con estados
  (abierta, pendiente, cerrada), asignación a una persona del equipo y contador
  de no leídos.
- **WhatsApp Business conectado** (Cloud API de Meta). Los mensajes al número de
  empresa entran solos en la bandeja del salón; si el número es nuevo, se crea su
  ficha. Las respuestas salen por la API. Sin conectar funciona en modo manual:
  se registra todo y se abre WhatsApp con el texto.
- **Recordatorios sugeridos** cada día, con el mensaje ya escrito y envío en bloque:
  - le toca volver;
  - te echamos de menos;
  - segunda visita;
  - gracias por venir.
- **Plantillas** editables con variables (`{nombre}`, `{salon}`, `{servicio}`,
  `{dias}`, `{fecha}`).
- **Lo que sabemos por sus mensajes**, en la ficha de cada cliente: tono
  emocional, por qué escribe, servicios que le interesan, días y franjas que pide,
  estilista de confianza, alertas (alergias o quejas) y tiempo de respuesta. Lo
  calcula un análisis por reglas que funciona sin servicios externos. Con
  `ANTHROPIC_API_KEY`, el botón «Analizar con IA» añade un resumen con Claude.

**Para empezar a vender**

- Web comercial en `/`, con el formulario de prueba gratuita. Las solicitudes
  llegan a la consola, en **Solicitudes de prueba**, y desde ahí se da de alta el
  salón con un clic.
- **Primeros pasos** en el panel de cada salón nuevo, incluido un menú de
  servicios típico para cargar.
- Guía completa de lanzamiento en [`PILOTO.md`](PILOTO.md): despliegue en Render
  (`render.yaml`), conexión de WhatsApp, email y qué medir en cada piloto.

## Cómo entran los datos (sin teclear dos veces)

0. **Traer mis datos** (migración desde otro programa). El salón elige de dónde
   viene (Fresha, Booksy, Treatwell, Koibox, Flowww, Bewe, Shore, Excel propio u
   otro) y ve cómo descargar sus datos de ese programa. Después sube los
   archivos, en Excel (`.xlsx`) o CSV, varios a la vez:
   - Reconoce qué contiene cada archivo y qué columna es cada dato, en español o
     en inglés: clientas, servicios, productos, citas, ventas, **movimientos y
     cierres de caja, facturas (serie, número, NIF, base, IVA, total y estado),
     cobros y deudas, y bonos y tarjetas regalo** (sesiones y saldo que quedan).
     Las columnas se pueden corregir a mano.
   - Las entradas de caja que son ventas de un día cuyas ventas ya se importaron
     no se suman otra vez. Las facturas a empresas no crean clientas.
   - Todo ese histórico se consulta en *Facturas y cobros*, y la ficha de cada
     clienta muestra sus bonos activos, sus facturas y lo que tiene pendiente.
   - Enseña lo que va a entrar antes de guardar nada.
   - Una clienta que ya existe (mismo teléfono o email) no se duplica: solo se
     completan los datos que le faltan. Reimportar el mismo archivo no cambia nada.
   - Las citas crean a los profesionales que falten y se enlazan con clientas y
     servicios. Hay plantillas descargables para quien empieza de cero.
   - El Excel se lee en el navegador, sin librerías. Los `.xls` antiguos hay que
     guardarlos antes como `.xlsx` o `.csv`.
1. **Importación CSV/Excel** (*Conectar TPV*). Casi todos los TPV
   y programas de peluquería exportan sus ventas. SalonPro reconoce las
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
| `WA_VERIFY_TOKEN` | token para verificar el webhook de WhatsApp en Meta |
| `WA_APP_SECRET` | *App secret* de Meta: comprueba la firma de cada aviso de WhatsApp |
| `ANTHROPIC_API_KEY` | opcional: resumen de clientes con IA (requiere `npm install`) |
| `PUBLIC_URL` | dirección pública (`https://app.tudominio.es`) para los enlaces de los emails |
| `SIGNUP=0` | cierra el alta libre de salones (abierta por defecto) |
| `TRIAL_DAYS` | días de prueba gratuita en el alta libre (30 por defecto) |
| `RESEND_API_KEY`, `MAIL_FROM` | envío de emails de la plataforma (recuperar contraseña) con Resend |
| `SUPPORT_EMAIL`, `SUPPORT_PHONE` | contacto del botón «Elegir plan» (el teléfono abre WhatsApp) |
| `TERMS_URL`, `PRIVACY_URL` | enlaces a las condiciones y la privacidad en el alta |

Copias de seguridad: basta con copiar el archivo `.db`, por ejemplo con
`sqlite3 salon-os.db ".backup copia.db"`.

## Cuentas, equipo y prueba gratuita

- **Alta libre** (`/app#/registro`): cualquier salón crea su cuenta y empieza
  en el plan *Prueba* durante `TRIAL_DAYS` días (30 por defecto). Se cierra con
  `SIGNUP=0`; entonces la pantalla remite a la web comercial.
- **Prueba caducada**: el salón puede consultar todo, pero no guardar cambios
  hasta que el distribuidor le cambie el plan (Consola → *Plan*). Ahí también
  se amplía la fecha de fin o se desactiva la cuenta.
- **Usuarios del equipo** (*Ajustes → Usuarios y accesos*). Dos accesos:
  - *Dueño/a*: ve todo.
  - *Equipo*: agenda, cobros, caja, clientes y mensajes. No ve facturación,
    rentabilidad, ajustes ni importaciones. El servidor lo impide aunque se
    escriba la dirección a mano.
- **Recuperar la contraseña**: con email configurado (`RESEND_API_KEY` y
  `MAIL_FROM`) se envía un enlace de un solo uso, válido 24 horas. Sin email, el
  dueño (para su equipo) o el distribuidor (para el dueño) generan ese enlace y
  lo mandan por WhatsApp.

## Seguridad

- Cada salón solo ve sus datos: todas las consultas filtran por salón. Hay
  tests que lo comprueban.
- Contraseñas con scrypt y sal.
- Sesiones en una cookie `HttpOnly` y `SameSite=Lax`.
- Límite de intentos de login, de altas y de peticiones de contraseña.
- Permisos por rol comprobados en el servidor; los enlaces de contraseña se
  guardan cifrados y sirven una sola vez.
- Las peticiones que modifican datos exigen JSON, lo que protege frente a
  CSRF.
- Cabeceras de seguridad y política de contenido (CSP).

## Próximos pasos sugeridos

- Conectores directos con los TPV más usados por tus salones.
- Agenda y citas, con recordatorios automáticos por WhatsApp o SMS.
- Comisiones por empleado y objetivos.
- Informe mensual en PDF para cada salón, que puedes enviar como asesor.
- Catálogo de tu producto y pedidos que el salón hace desde la app.
