# Salon OS · Guía para lanzar los primeros pilotos

Pasos para poner Salon OS en internet, conectar el WhatsApp de un salón y
llevar una prueba de 30 días de principio a fin.

## 1. Publicar la aplicación (una vez)

Necesitas un servidor con disco persistente. Lo más sencillo es **Render**:

1. Crea una cuenta en render.com y conecta este repositorio de GitHub.
2. *New → Blueprint* y elige el repositorio: Render lee `render.yaml` (en la
   raíz) y crea el servicio `salon-os` con un disco de 1 GB para la base de datos.
3. Rellena las variables que pide:
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD`: tu acceso de distribuidor.
   - `WA_APP_SECRET`: el "App secret" de tu app de Meta (paso 3). Puedes dejarlo
     vacío al principio y añadirlo después.
   - `ANTHROPIC_API_KEY` (opcional): activa el botón «Analizar con IA» en la ficha.
   - `WA_VERIFY_TOKEN` lo genera Render solo; lo usarás en el paso 3.
4. Cuando termine, tendrás una dirección del tipo `https://salon-os-xxxx.onrender.com`:
   - `/` es la web comercial, con el formulario de prueba;
   - `/app` es la aplicación.
5. (Recomendado) Conecta tu dominio, por ejemplo `app.tumarca.es`, en
   *Settings → Custom domains*.

Alternativas: cualquier servidor con Docker (`docker build` + volumen en `/data`,
ver `README.md`) o Railway / Fly.io con un volumen persistente.

**Copias de seguridad:** el archivo `/data/salon-os.db` contiene todo. Programa una
copia diaria (Render permite instantáneas del disco).

## 2. Tu flujo comercial

1. Comparte la web (`/`). Las solicitudes llegan a **Consola → Solicitudes de prueba**.
2. Llama al salón, cambia el estado a *Contactado* y pulsa **Dar de alta**: se crea
   el salón en plan *Prueba* (0 €) con una contraseña inicial que le envías.
3. Al abrir el salón aparecen los **Primeros pasos**. Hazlos con el dueño en la
   primera sesión (unos 45 minutos):
   - **Cargar menú típico** y ajustar los precios a los suyos.
   - Añadir al equipo.
   - Importar las ventas del último año desde su TPV (*Conectar TPV / importar*).
     Si no puede exportarlas, empieza a cobrar desde *Nuevo cobro*.
   - Registrar las horas del mes.
   - Conectar WhatsApp (paso 3) o usar el modo manual.
   - Enviar los primeros recordatorios.
4. Durante la prueba, revisa su panel desde tu consola (*Ver panel*).
5. A los 30 días, haced la sesión de resultados y pasa el salón a *Base* o *Pro*
   desde **Plan**.

## 3. Conectar el WhatsApp de empresa de un salón

Salon OS usa la API oficial de WhatsApp Business (Cloud API de Meta). Una sola
app de Meta, la tuya como proveedor, sirve para todos tus salones.

**Una vez, en tu app de Meta**
1. En developers.facebook.com crea una app de tipo *Business* y añade el producto *WhatsApp*.
2. En *WhatsApp → Configuración*, en **Webhook**:
   - URL de devolución de llamada: `https://TU-DOMINIO/api/webhooks/whatsapp`
   - Token de verificación: el valor de `WA_VERIFY_TOKEN` (en Render, pestaña *Environment*).
   - Suscríbete al campo **messages**.
3. Copia el *App secret* (Configuración → Básica) en la variable `WA_APP_SECRET`.
   Así Salon OS rechaza cualquier aviso que no venga de Meta.

**Por cada salón**
1. Añade su número de empresa en *WhatsApp → Configuración de la API*. El número no
   puede estar a la vez en la app normal de WhatsApp Business: Meta lo migra.
2. Copia el **Phone number ID** y genera un **token permanente** con un usuario de
   sistema que tenga el permiso `whatsapp_business_messaging`.
3. En Salon OS, entra al salón → **Ajustes → Canales de comunicación → WhatsApp
   Business**, pega los dos datos y guarda. El estado pasa a *Conectado*.

Desde ese momento:
- Cada mensaje que un cliente envía al número del salón aparece en **Mensajes**.
  Si el número no está en Clientes, se crea su ficha.
- Las respuestas y los recordatorios salen por WhatsApp al momento.
- Lo que el cliente cuenta se resume en su ficha, en **Lo que sabemos por sus
  mensajes**: tono, servicios que le interesan, días que pide, alergias o quejas.

**Regla de las 24 horas de WhatsApp.** Puedes responder libremente durante las 24 h
siguientes al último mensaje del cliente. Fuera de esa ventana, Meta solo permite
**plantillas aprobadas**. Si un envío falla por eso, Salon OS te da un enlace para
mandarlo desde el móvil. Para recordatorios automáticos a gran escala, da de alta
en Meta las plantillas de *Mensajes → Plantillas*.

**Sin conectar (modo manual)** todo funciona igual, salvo el envío: cada mensaje
queda registrado y Salon OS abre WhatsApp con el texto escrito para enviarlo.

## 4. Email (opcional)

Crea una cuenta en resend.com y verifica el dominio del salón (o el tuyo). En
**Ajustes → Canales → Email**, pega la clave de API y el remitente
(`Salón Ana <hola@salonana.es>`).

## 5. Otros canales

Instagram, formularios web o un email reenviado pueden entrar en la bandeja con
la API de integración del salón:

```
POST https://TU-DOMINIO/api/ingest/messages
Authorization: Bearer <clave del salón>
{ "messages": [{ "channel": "instagram", "from": "usuario", "name": "Ana", "body": "Hola…", "id": "abc" }] }
```

Con Make o Zapier se conecta en minutos. La clave está en *Conectar TPV / importar*.

## 6. Qué medir en cada piloto

| Indicador | Dónde | Señal de que funciona |
| --- | --- | --- |
| Clientes recuperados | Clientes en riesgo que vuelven tras un recordatorio | Al menos 5 al mes |
| Ocupación | Panel → Menú de servicios | Sube respecto al primer mes |
| Tiempo de respuesta | Ficha → Lo que sabemos | Menos de 1 h |
| Uso semanal | El dueño entra al panel cada semana | Sí, sin que se lo recuerdes |
| Venta de producto | Panel → retail por empleado | Sube en quien estaba por debajo |

Pregunta al final: *«¿Pagarías por seguir usándolo? ¿Qué es lo que más te ha servido?»*
y anota las respuestas en la solicitud (estado *Cliente* o *Descartado*).

## 7. Antes de salones reales: lista legal mínima

- Contrato de encargado del tratamiento (RGPD) con cada salón.
- Aviso de privacidad en la web comercial y en el formulario.
- Las clientas deben haber dado su consentimiento para recibir mensajes. En
  España, un recordatorio de servicio a una clienta habitual suele estar cubierto;
  las promociones necesitan consentimiento expreso.
- Revisa estos puntos con tu asesoría: esta guía no es asesoramiento legal.
