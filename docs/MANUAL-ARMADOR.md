# Armador de Plan — Manual interno (X5 Cuyo)

**Qué es:** una tarjeta del Hub comercial (sección Ventas) que hace el trabajo del *setter*: con las respuestas del cliente elige el sistema de plan, calcula su **monto total disponible** y le muestra a qué vehículos llega. La idea es abrirle el juego: el cliente no va por un auto puntual, sino por un rango de vehículos dentro de un valor. Siempre se vende plan; el contado no se trabaja hasta el final.

## Qué se le pregunta al cliente
1. **Qué busca:** auto o camioneta, o moto.
2. **Para qué lo quiere:** trabajo, familia, ciudad, ruta o campo (se pueden marcar varios). Resalta las categorías que le sirven.
3. **Qué tiene:** valor estimado del usado que entrega y efectivo disponible.
4. **Cuánto puede pagar por mes.**
5. **Cuotas por mes:** 1 por mes (lo normal) o 2 juntas del mismo plan (se fuerza a mano para llegar antes).
6. **Para cuándo lo necesita:** urgente (menos de 1 mes), 1 a 5 meses, o tiene tiempo.

## Formulario o Guiado (a elección)
Arriba hay un selector **Formulario / Guiado**. Es opcional: cada asesor usa el que le quede cómodo y puede cambiar en cualquier momento sin perder lo cargado.
- **Guiado:** una pregunta por pantalla (8 en total), con la frase sugerida para decirle al cliente y botones grandes para responder. Cada respuesta completa el formulario. Todas se pueden saltar. Para la cuota hay montos rápidos.
- **Copiar pregunta para el chat:** copia la frase para pegarla en Messenger, WhatsApp o el chat de Instagram. El cliente responde y el asesor toca la respuesta. Así se atienden los chats con el mismo guion, sin permisos de Meta.
- Al terminar, aparece el resultado (sistema, monto disponible, guardar en el CRM) y el botón **Nuevo cliente** limpia todo para el siguiente.

## Los tres sistemas
| Sistema | Cuota | Adelantos | Negocia desde | Para |
|---|---|---|---|---|
| 10 adelantos | cualquier valor del vector ($90.000 a $700.000) | 10, hasta 2 por mes | 5 a 10 meses | autos, camionetas y motos |
| 5 adelantos (anexo de cuota 5) | $350.000 o más, **con capital de más de $6 M** | 5, hasta 2 por mes | 45-60 días a 5 meses | autos y camionetas |
| Entrega programada (plan especial) | contrato desde $3.500.000, con capital de $10 M o más | 5: el 1.º como seña y los 4 siguientes juntos | 20 a 25 días | autos y camionetas |

- Las motos solo van a 10 adelantos.
- **Vector de cuotas:** solo se ofrecen los valores de la lista de precios: $90.000, $130.000, $200.000, $250.000, $300.000, $350.000, $400.000, $450.000, $500.000, $550.000, $600.000 y $700.000. Se toma el valor más alto que entra en lo que el cliente puede pagar. Los pagos 1 y 2 llevan el sellado sumado (por ejemplo, cuota de $300.000 + sellado de $55.000 = $355.000) y la herramienta lo muestra. El vector se edita en «Parámetros de los planes» y se puede pegar desde la lista de precios.
- **Lo que define 5 o 10 adelantos es el capital**, no el valor de la cuota. Con capital de más de $6 M y cuota de $350.000 o más, puede ir al anexo de cuota 5. Sin ese capital va a 10 adelantos, aunque pague $700.000.
- Se hace **un solo contrato** del valor que el cliente puede pagar (por ejemplo, uno de $400.000). Solo se hacen **2 contratos o más** cuando lo que paga supera la cuota máxima del vector ($700.000): por ejemplo, $1.000.000 por mes son 2 contratos de $500.000.
- Entrega programada: es un plan especial y puede quedar fuera del rango del vector. Se arma con el **contrato más bajo válido** ($3.500.000 = 5 adelantos de $700.000). Lo ideal es pagarlo con el efectivo del cliente; si no alcanza, se completa con lo que paga por fuera ese mes.
- El sellado siempre queda por fuera de la cuota: se suma solo en los pagos 1 y 2.

**Cuál recomienda:** urgente → programado, si no 5 adelantos, si no 10. De 1 a 5 meses → 5 adelantos, si no programado, si no 10. Tiene tiempo → el que da mayor monto disponible. Tocando cada sistema se puede comparar.

## Monto total disponible
Es lo que el cliente puede negociar con lo integrado (adelantos del plan más su capital), **siempre sujeto a aprobación crediticia**. El vendedor del plan no verifica el crédito. En esta etapa el negociador todavía no trabaja con el sistema. Papeles aparte.

- **Por dentro** (uso interno, no se muestra): según el contrato (cláusula 2.ª c), los primeros pagos incluyen los gastos de admisión, el 4% del valor del bien elegido. La herramienta los descuenta sola. En el sistema, lo que vale es la columna de cuota pura (capitalización).
- **En pantalla y en los mensajes** no aparecen gastos ni descuentos: solo el monto final total disponible. Así lo presenta el vendedor y no se entorpece la venta.
- Contrato, cláusula 3.ª a.1: para negociar hay que integrar como mínimo el **50% en usados y motos** (hasta el doble de lo integrado) y el **35% en 0 km** (hasta unas 2,85 veces). Por eso la herramienta da dos montos: disponible en usados y disponible en 0 km. El 0 km permite financiar más.
- Plan de 5 adelantos y entrega programada: mismo contrato, con un anexo que permite negociar desde la cuota 5 paga. El resto del funcionamiento (devolución o derivación de capital) rige recién después de la cuota 10 paga.

## Validación contra el vehículo más económico
Antes de dar el monto, el Armador busca el **usado más económico del Radar** (con precio X5) y el **0 km más económico** (stock 0 km del Radar o valor de guía por categoría).
- Si el monto al terminar los adelantos **no llega al usado más económico**, calcula con la misma regla del contrato **desde qué cuota llega** y lo informa: "retira desde la cuota 20 (unos 20 meses)", con el monto en usados en esa cuota. El mensaje al cliente dice "podés retirar tu vehículo a partir de la cuota 20".
- Si ni en 84 cuotas llega, avisa que con esa cuota no alcanza y que conviene subir la cuota o sumar capital.
- **0 km:** si el monto para 0 km no llega al 0 km más económico, no se dice nada del 0 km (ni en pantalla ni en el mensaje).
- Ejemplo: cliente sin capital ni usado que paga $400.000 por mes (un contrato de $400.000 a 10 adelantos). A los 10 adelantos no llega al usado más barato del Radar; retira desde la cuota 20 con usados de hasta unos $14,8 M. No se muestra 0 km.

## Qué muestra
- **Monto total disponible** en usados y en 0 km, y desde cuándo negocia.
- **Sistemas:** los tres, con el recomendado marcado y los que no aplican con el motivo.
- **Cómo se arma:** adelantos del plan, capital que aporta y los dos montos finales (sin gastos).
- **¿A qué llega?:** tabla por categoría (auto chico, familiar, utilitario, SUV, camioneta) y antigüedad (2010-15, 2015-20, 2020-25, 0 km) con valores de la guía CCA. Usados a guía + 20% contra el monto de usados; 0 km a valor de guía contra el monto de 0 km. En verde lo que entra.
- **Opciones en stock:** hasta 6 modelos distintos del Radar de Usados dentro del rango, con el precio X5 de la regla «El mayor».
- **Mensaje para el cliente** por WhatsApp (sin prometer crédito) y **«Copiar cómo se armó»**: una consulta interna del negocio, por si alguien pregunta cómo se llegó al monto (no es un pase al negociador).
- Los parámetros de los planes se cambian en «Parámetros de los planes» y quedan guardados en el teléfono.

## Mensaje de calificación (anti-ghosting)
El botón principal es **«Mensaje de calificación»**: le dice al cliente que califica para un plan X5, **sin montos ni detalle del plan**, y le pide elegir cómo lo contactamos (llamada hoy por la tarde, mañana por la mañana, visita en su casa o trabajo, o pasar por la oficina). Va con voseo, para generar confianza. El detalle se da en la llamada o en la visita, para que el cliente no use la propuesta para salir a comparar. Si se cargó el teléfono, abre directamente el chat de ese cliente.
- **«Mensaje con el detalle del plan»** queda como segunda opción, para cuando el asesor ya habló con el cliente.
- Al guardar el lead, el próximo paso por defecto es **Esperando horario**. En el Mini CRM ese lead avisa cuándo toca cada recordatorio: el 1 a las 24 h y el 2 a las 72 h, con botón para mandarlo por WhatsApp. Después del segundo, no se insiste. El día que toca, el lead aparece en la vista «Hoy».

## Guardar en el CRM
Con el usuario del Mini CRM abierto en el mismo teléfono, el Armador muestra «Guardar en el CRM»: teléfono, origen y próximo paso (esperando horario, seguimiento o entrevista pactada). Guarda el lead en la lista del asesor con el interés, la urgencia, el sistema, la cuota, el capital y los dos montos disponibles. En el Mini CRM, ese lead aparece con la etiqueta **Calificado**. Sin señal, queda en cola y se envía al abrir el CRM. Los usuarios de solo lectura (Supervisor, Control) no pueden guardar.

## Pendientes
- Catálogo de motos y listado de 0 km por plan.
- Después: la misma lógica dentro de DOMino, como setter automático por WhatsApp.

**Para responder por voz:**

- "¿Cómo se calcula el monto disponible?" → Con lo integrado (adelantos más capital) llega hasta el doble en usados y motos, y hasta unas 2,85 veces en 0 km, sujeto a crédito. La herramienta descuenta por dentro los gastos de admisión del contrato; al cliente se le dice solo el monto final.
- "¿Quién puede ir a 5 adelantos?" → Quien tenga capital de más de 6 millones y pueda pagar cuotas de 350 mil o más. Sin ese capital va a 10 adelantos, aunque pague una cuota alta.
- "¿Qué sistema le conviene a alguien urgente?" → Entrega programada, si tiene capital de 10 millones o más y puede pagar un contrato desde 3 millones y medio; negocia en 20 a 25 días.
- "¿Dónde quedan los clientes calificados?" → En el Mini CRM, en la lista de leads del asesor, con la etiqueta Calificado.
- "¿Cómo atiendo una consulta por Messenger con el Armador?" → En modo Guiado, tocá «Copiar pregunta para el chat», pegala en Messenger y cargá la respuesta del cliente. Al final, guardalo como lead calificado.
- "¿Qué pasa si el cliente no llega a ningún vehículo con los adelantos?" → El Armador calcula desde qué cuota llega al usado más económico del Radar y lo informa; si no llega al 0 km más barato, no menciona el 0 km.
- "¿Qué le mando al cliente al terminar?" → El mensaje de calificación: le avisa que califica y le pide un horario, sin montos. Si no responde, el CRM recuerda mandar un recordatorio a las 24 horas y otro a las 72; después no se insiste.
- "¿Las motos pueden ir a 5 adelantos?" → No, las motos solo van a 10 adelantos.
