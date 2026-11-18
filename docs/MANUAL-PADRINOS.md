# Manual interno · Padrinos X5 (club de referidos)

**Qué es:** la tarjeta «Padrinos X5» del Hub comercial. Cada cliente que tiene su plan puede ser **padrino**: recibe un código y, cuando alguien que él recomienda compra su plan, suma puntos para canjear por premios. Arrancó el 18/11/2026. Los premios se empiezan a dar a los 3 meses; puntos y premios están en revisión con el directorio y pueden cambiar.

Propuesta completa para el directorio: https://claude.ai/artifact/BTFvRDEJACoBjqAruCfebG

## Pantallas
1. **Padrinos:** números del club (padrinos, referidos en curso, planes firmados, puntos emitidos), buscador y lista de padrinos ordenada por puntos. Botón **+ Padrino**.
2. **Pase del padrino** (al tocar uno): tarjeta con nombre, nivel, código y puntos disponibles y pendientes; barra hacia el próximo nivel; aviso en el mes de su cumpleaños; botón **Enviarle su pase por WhatsApp**; **+ Cargar referido**; lista de referidos con sus pasos; «Su plan» (bienvenida, cuotas al día, retiro, cumpleaños, reseña).
3. **Premios:** catálogo con los puntos de cada premio (los canjes todavía no están habilitados).
4. **Cómo funciona:** tabla de puntos, niveles y reglas.

## Paso a paso del asesor
1. Cuando un cliente firma su plan: **+ Padrino** → nombre, teléfono, cumpleaños y número de contrato. El sistema le genera un código.
2. **Enviarle su pase por WhatsApp:** le llega su código y cómo funciona, con su nombre y sus puntos.
3. Cuando el padrino recomienda a alguien: entrar a su pase → **+ Cargar referido**. Se crea solo el lead en el Mini CRM con origen «Referido», a nombre del asesor que lo atiende, y le llega el aviso por Telegram.
4. A medida que avanza: **Marcar: Entrevista** y **Marcar: Firmó** (con sistema y número de contrato).
5. Supervisión confirma **Cuota 3** (ahí se liberan los puntos), **Retiró** y las **bajas**.

## Tarjeta del cliente (link personal)
Cada padrino tiene su propia tarjeta en un link único (`pase.html?c=CÓDIGO&k=LLAVE`). El botón **Enviarle su pase por WhatsApp** ya manda el mensaje con ese link, y **Copiar el link de su tarjeta** lo copia para pegarlo donde quieras.
- El cliente no necesita usuario ni clave. La tarjeta tiene 4 pantallas con una barra abajo: **Mi pase** (bienvenida, tarjeta con puntos, nivel y código, cumpleaños, recomendar, acceso a sus referidos y su plan), **Referidos** (cada uno con sus pasos, solo el nombre de pila), **Premios** y **Cómo sumo**. La parte de gerencia no aparece: eso queda solo en el Hub.
- Tiene un botón **Recomendar a un amigo** que arma el mensaje de WhatsApp con su código, y otro **+ Cargar un referido**: el cliente pone nombre, teléfono, qué busca y un comentario, y confirma que le avisó a esa persona. Entra solo al Mini CRM como lead con origen «Referido», asignado a su asesor, con **plazo de contacto de 2 horas** (si lo carga después de las 18 o antes de las 9, vence a las 11 del día hábil siguiente) y aviso por Telegram. En el Hub se ve «lo cargó el padrino». Máximo 5 por día por padrino. Si esa persona ya era lead o ya fue referida, no se carga y no se le muestran datos de otros.
- Puede guardarla en la pantalla de inicio del teléfono.
- Es de solo lectura y no muestra teléfonos ni datos de otros clientes. La llave del link es secreta y no se puede adivinar; si el padrino se da de baja, el link deja de funcionar.
- Billetera (Google/Apple Wallet): no hace falta por ahora. No es para pagar; solo suma avisos en el teléfono y un QR para escanear. Se evalúa si Gangas Club valida beneficios con QR.

## Automático desde el Mini CRM (v2.12)
- Cuando la entrevista de un referido se marca **realizada** en el CRM, su paso pasa solo a **Entrevista**.
- Cuando se cierra la **venta** con N.º de contrato, pasa solo a **Firmó**, con el contrato y el sistema según el código del plan (apertura 10 = 10 adelantos, 5 = 5 adelantos).
- La entrevista se reconoce por el lead del referido; si se cargó suelta, por el nombre del cliente y el asesor. Nunca hace retroceder un paso.
- **Cuota 3 y retiro** los sigue confirmando supervisión a mano: el Hub no está conectado al sistema de cobranzas de X5 (Flexipyme).

## Puntos (propuesta)
Por referido: entrevista 10 · firma 100 × multiplicador (pendientes) · cuota 3 50 × multiplicador (se liberan) · retiro 100. Multiplicador por sistema: 10 adelantos ×1, 5 adelantos ×1,5, entrega programada ×2.
Por el plan propio: bienvenida 20 · cada 6 cuotas al día 30 · retiro de su vehículo 150 (y sube un nivel) · cumpleaños 50 · reseña en Google 20. Cuotas al día, retiro y reseña los carga supervisión en «Editar padrino».

## Vencimiento y cumpleaños
- Los puntos vencen a los **12 meses** de ganados. Cuando hay canjes, se usan primero los más viejos.
- La tarjeta avisa cuántos puntos vencen en los próximos 30 días.
- En el **mes del cumpleaños** del padrino, todo lo que gana vale **doble** (menos el regalo de 50 del día del cumpleaños). Los puntos pendientes de una firma se duplican si la cuota 3 se confirma en ese mes.
- En el pase del Hub, el bloque «Puntos» muestra ganados, canjeados, vencidos y disponibles.

## Canjes (preparados; se habilitan el 18/02/2027)
- Antes de esa fecha, la tarjeta muestra los premios y la fecha en que se habilitan.
- Desde esa fecha, el cliente toca **Canjear** en el premio (si le alcanzan los puntos y cumple el requisito: haber retirado o ser Padrino) y lo confirma. Puede tener hasta 3 pedidos pendientes.
- Llega un aviso por Telegram al asesor y a gerencia. En el Hub, en el pase del padrino, bloque **Canjes**: el Gerente Comercial **Aprueba** o **Rechaza**, y después marca **Entregado**. Si los canjes superan sus puntos, el Hub lo marca.
- Los pedidos, aprobados y entregados descuentan puntos; los rechazados los devuelven.
- La fecha se cambia en dos lugares: `CANJES_DESDE` en Code.gs y `canjesDesde` en padrinos-core.js.

## Eliminar un padrino (solo Gerente Comercial)
En «Editar padrino» → **Eliminar padrino…**. Borra al padrino, sus referidos y sus canjes, deja una copia en la hoja «Eliminados» y su link deja de funcionar. Los leads que ya se crearon en el CRM no se borran.

## Bases y condiciones
Están en la tarjeta del cliente, pantalla «Cómo sumo», y con un enlace al pie de «Mi pase». Es una **versión preliminar**: la tiene que revisar alguien de X5 antes de salir con todos los clientes.

## En el informe del CRM
El Resumen por período tiene la sección **Padrinos X5 · referidos**: referidos nuevos (y cuántos cargó el padrino desde su tarjeta), cuántos firmaron y su porcentaje, tiempo de respuesta a los leads referidos, puntos emitidos, canjes, entrevistas, firmas, cuota 3, retiros, los padrinos que más recomendaron y una tabla por asesor. Sale también en el PDF.

## Niveles
Cliente X5 (0 referidos con cuota 3) · Padrino (1) · Padrino Oro (3, ×1,25 en nuevos referidos) · Embajador X5 (6, ×1,5). Retirar el propio vehículo sube un nivel.

## Reglas
- Nadie se refiere a sí mismo y un referido vale para un solo padrino (el primero que lo carga).
- Si el teléfono ya estaba como lead en el CRM, no suma como referido.
- Los pasos se avanzan de a uno. Baja antes de la cuota 3: se anulan los pendientes.
- El asesor ve sus padrinos (y el jefe, los de su equipo). Gerencia ve todo. Supervisor solo mira. Control y Personal no entran.
- Todo cambio queda registrado en la hoja «PadrinosLog» (quién, cuándo y qué).

## Datos (Google Sheets)
Hojas nuevas, se crean solas con el Code.gs v2.7: **Padrinos** (id, codigo, nombre, telefono, cumple, nro_contrato, asesor, cuotas_al_dia, retiro, fecha_retiro, resena, estado, alta, notas, actualizado), **Referidos** (id, padrino_id, padrino_codigo, cliente, telefono, interes, sistema, asesor, estado, nro_contrato, lead_id, alta, fechas de cada paso, notas, actualizado) y **PadrinosLog**. Los puntos no se guardan: los calcula la app con las reglas, así se pueden cambiar los valores sin tocar la planilla.

## Pendiente
- Definir con el directorio el valor del punto, los premios, el premio del referido y la integración con Gangas Club.
- Más adelante: Google/Apple Wallet si hace falta, y que la venta cerrada en el CRM marque sola la firma del referido.

## Preguntas frecuentes (para Claudio)
- **¿Cómo cargo un padrino?** En el Hub, Padrinos X5 → + Padrino. Nombre, teléfono y cumpleaños; el código sale solo.
- **¿El referido va al CRM?** Sí, se crea solo como lead con origen «Referido» y el asesor recibe el aviso.
- **¿Por qué los puntos están pendientes?** Porque el referido firmó pero todavía no pagó la cuota 3; la confirma supervisión.
- **¿Cómo ve el cliente su tarjeta?** Con el link que le llega por WhatsApp desde «Enviarle su pase». No necesita clave.
- **¿El cliente puede cargar referidos solo?** Sí, desde su tarjeta con «+ Cargar un referido». Entra al CRM como lead referido con plazo de 2 horas.
- **¿Cuándo se canjean?** A los 3 meses del lanzamiento; los premios se están definiendo.

Desarrollado por The DOM Studio Web · WhatsApp 261-3431216 · thedomstudioweb@gmail.com
