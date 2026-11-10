# Armador de Plan — Manual interno (X5 Cuyo)

**Qué es:** una tarjeta del Hub comercial (sección Ventas) que hace el trabajo del *setter*: con las respuestas del cliente elige el sistema de plan, calcula su **monto total disponible** y le muestra a qué vehículos llega. La idea es abrirle el juego: el cliente no va por un auto puntual, sino por un rango de vehículos dentro de un valor. Siempre se vende plan; el contado no se trabaja hasta el final.

## Qué se le pregunta al cliente
1. **Qué busca:** auto o camioneta, o moto.
2. **Para qué lo quiere:** trabajo, familia, ciudad, ruta o campo (se pueden marcar varios). Resalta las categorías que le sirven.
3. **Qué tiene:** valor estimado del usado que entrega y efectivo disponible.
4. **Cuánto puede pagar por mes.**
5. **Cuotas por mes:** 1 por mes (lo normal) o 2 juntas del mismo plan (se fuerza a mano para llegar antes).
6. **Para cuándo lo necesita:** urgente (menos de 1 mes), 1 a 5 meses, o tiene tiempo.

## Los tres sistemas
| Sistema | Cuota | Adelantos | Negocia desde | Para |
|---|---|---|---|---|
| 10 adelantos | $90.000 a $300.000 | 10, hasta 2 por mes | 5 a 10 meses | autos, camionetas y motos |
| 5 adelantos | $350.000 a $700.000 (luego hasta $1 M), con capital de más de $6 M | 5, hasta 2 por mes | 45-60 días a 5 meses | autos y camionetas |
| Entrega programada | más de $800.000, con capital de $10 M o más | 5: el 1.º como seña y los 4 siguientes juntos | 20 a 25 días | autos y camionetas |

- Las motos solo van a 10 adelantos.
- Si la cuota que puede pagar supera el máximo del plan, se arman **2 contratos del mismo monto**.
- Los límites de contrato son la cuota y el capital. Con capital de $6 M o menos, va directo a 10 adelantos.
- En entrega programada, lo ideal es que los 5 adelantos salgan del efectivo del cliente; si no alcanza, se pagan por fuera del capital.

**Cuál recomienda:** urgente → programado, si no 5 adelantos, si no 10. De 1 a 5 meses → 5 adelantos, si no programado, si no 10. Tiene tiempo → el que da mayor monto disponible. Tocando cada sistema se puede comparar.

## Monto total disponible
Es lo que el cliente puede negociar: adelantos del plan más su capital, hasta el doble, **siempre sujeto a aprobación crediticia** (lo verifica el **negociador**, no el vendedor del plan). Papeles aparte.

- **Por dentro** (uso interno, no se muestra): según el contrato (cláusula 2.ª c), los primeros pagos incluyen los gastos de admisión, el 4% del valor del bien elegido. La herramienta los descuenta sola. En el sistema, lo que vale es la columna de cuota pura (capitalización).
- **En pantalla y en los mensajes** no aparecen gastos ni descuentos: solo el monto final total disponible. Así lo presenta el vendedor y no se entorpece la venta.
- Según el contrato, para negociar hay que integrar como mínimo el 35% del precio en 0 km y el 50% en usados y motos. Hoy la herramienta usa "hasta el doble" para todo.

## Qué muestra
- **Monto total disponible** y desde cuándo negocia.
- **Sistemas:** los tres, con el recomendado marcado y los que no aplican con el motivo.
- **Cómo se arma:** adelantos del plan, capital que aporta y el monto final (sin gastos).
- **¿A qué llega?:** tabla por categoría (auto chico, familiar, utilitario, SUV, camioneta) y antigüedad (2010-15, 2015-20, 2020-25, 0 km) con valores de la guía CCA. Usados a guía + 20%, 0 km a valor de guía. En verde lo que entra.
- **Opciones en stock:** hasta 6 modelos distintos del Radar de Usados dentro del rango, con el precio X5 de la regla «El mayor».
- **Mensaje para el cliente** por WhatsApp (sin prometer crédito) y **resumen para el negociador** (se copia).
- Los parámetros de los planes se cambian en «Parámetros de los planes» y quedan guardados en el teléfono.

## Pendientes
- Catálogo de motos y listado de 0 km por plan.
- Después: la misma lógica dentro de DOMino, como setter automático por WhatsApp.

**Para responder por voz:**
- "¿Cómo se calcula el monto disponible?" → Los adelantos del plan más el capital del cliente, hasta el doble, sujeto a crédito. La herramienta descuenta por dentro los gastos de admisión del contrato; al cliente se le dice solo el monto final.
- "¿Quién puede ir a 5 adelantos?" → Quien tenga capital de más de 6 millones y pueda pagar cuotas de 350 mil o más. Si no, va a 10 adelantos.
- "¿Qué sistema le conviene a alguien urgente?" → Entrega programada, si tiene capital de 10 millones o más y puede pagar cuotas de más de 800 mil; negocia en 20 a 25 días.
- "¿Las motos pueden ir a 5 adelantos?" → No, las motos solo van a 10 adelantos.
