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

## Puntos (propuesta)
Por referido: entrevista 10 · firma 100 × multiplicador (pendientes) · cuota 3 50 × multiplicador (se liberan) · retiro 100. Multiplicador por sistema: 10 adelantos ×1, 5 adelantos ×1,5, entrega programada ×2.
Por el plan propio: bienvenida 20 · cada 6 cuotas al día 30 · retiro de su vehículo 150 (y sube un nivel) · cumpleaños 50 · reseña en Google 20. Cuotas al día, retiro y reseña los carga supervisión en «Editar padrino».

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
- Canjes (a los 3 meses), vencimiento de puntos a 12 meses y puntos dobles del mes de cumpleaños (hoy solo se avisan).
- Más adelante: pase propio para el cliente (link o Google Wallet) y que la venta cerrada en el CRM marque sola la firma del referido.

## Preguntas frecuentes (para Claudio)
- **¿Cómo cargo un padrino?** En el Hub, Padrinos X5 → + Padrino. Nombre, teléfono y cumpleaños; el código sale solo.
- **¿El referido va al CRM?** Sí, se crea solo como lead con origen «Referido» y el asesor recibe el aviso.
- **¿Por qué los puntos están pendientes?** Porque el referido firmó pero todavía no pagó la cuota 3; la confirma supervisión.
- **¿Cuándo se canjean?** A los 3 meses del lanzamiento; los premios se están definiendo.

Desarrollado por The DOM Studio Web · WhatsApp 261-3431216 · thedomstudioweb@gmail.com
