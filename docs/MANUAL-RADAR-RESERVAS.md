# Radar de Usados · Reservas, fotos tapadas y stock propio

Manual interno (también para Claudio). Versión del backend: Code.gs v2.14.

## Para qué sirve

El Radar lo usan los negociadores de X5 (no los clientes), muchas veces con el cliente mirando la pantalla al lado. Esta versión suma tres cosas:

1. **Reservas compartidas**: un negociador reserva una unidad para su cliente y esa unidad queda bloqueada para todos los demás.
2. **Fotos tapadas**: las patentes, los carteles amarillos y los logos de las agencias se tapan con un recuadro desenfocado. El logo de X5 nunca se agrega ni se tapa.
3. **Stock propio**: el Radar ya está preparado para mostrar los autos propios de X5 desde una planilla, primero en la lista y con su propio precio.

## Reservas

### Quién puede qué

| Rol | Ver reservas | Reservar | Extender | Liberar / Se vendió | Avisar a la agencia | Tapar fotos | Cargar WhatsApp de agencias |
|---|---|---|---|---|---|---|---|
| Asesor (negociador) | Sí (de los demás, solo el nombre del negociador) | Sí | Su reserva, una vez | Su reserva | No | No | No |
| Jefe de Ventas / Referente | Sí, con cliente y teléfono | Sí | Cualquiera, sin límite | Cualquiera | Sí | Sí | No |
| Gerente Comercial | Sí, con cliente y teléfono | Sí | Cualquiera, sin límite | Cualquiera | Sí | Sí | Sí |
| Supervisor | Sí (solo lectura) | No | No | No | No | No | No |
| Control / Personal | No | No | No | No | No | No | No |

### Cómo reserva el negociador

1. Ingresa al Hub con su usuario. El Radar usa la misma sesión.
2. Abre la unidad (en Cliente o en Interno) y toca **Reservar para un cliente**.
3. Carga el nombre del cliente (obligatorio), y si quiere el teléfono y una nota (seña, forma de pago).
4. Toca **Confirmar reserva**. La unidad queda reservada por 48 horas.

Desde ese momento:
- Para los demás negociadores, la unidad aparece como **Reservado** (con el nombre de quien la reservó en la vista Interna). No pueden copiar los datos ni enviarla por WhatsApp.
- En la vista Cliente, la tarjeta se ve apagada con la cinta «Reservado», sin nombres. Lo vendido ya no aparece en la vista Cliente.
- Gerencia y el jefe del negociador reciben un aviso por Telegram.

En su ficha, el negociador tiene tres botones: **Se vendió**, **Extender 48 h** (una sola vez; después la extiende su jefe) y **Liberar**.

Dos horas antes de que venza, el negociador recibe un recordatorio por Telegram. Si nadie la extiende, la reserva vence sola y la unidad vuelve a estar disponible (se avisa a gerencia, al jefe y al negociador).

Si dos negociadores tocan «Reservar» casi al mismo tiempo, gana el primero; al segundo le aparece «Otro negociador la reservó recién».

### Cómo se frena la venta en todas las plataformas

- **En el Hub (todas las vistas)**: la planilla de reservas es la única fuente. Cualquier pantalla del Hub la lee y bloquea la unidad.
- **Página pública de autos propios (cuando exista)**: puede consultar qué unidades están reservadas o vendidas en `SCRIPT_URL?action=radar_estado`. Devuelve solo los códigos de las unidades y su estado, sin datos de clientes ni negociadores.
- **Páginas de las agencias (terceros)**: X5 no puede bloquearlas porque no son propias. Por eso el aviso de Telegram trae un botón **Avisar por WhatsApp** que abre el chat de la agencia con el pedido de reserva ya escrito. Si la agencia no tiene WhatsApp cargado, el botón abre la publicación para reservar desde ahí. Cuando ya se avisó, gerencia o el jefe tocan **Marcar avisada** en el panel de reservas.

Se eligió que el aviso a la agencia lo haga gerencia y no el negociador por tres motivos: queda un solo canal con cada agencia, los contactos de las agencias no quedan a la vista del cliente, y gerencia controla qué se pide.

### Panel de reservas (vista Interna)

Arriba del resumen aparece el panel **Reservas** (para jefes y gerencia, **Reservas del equipo**) con las reservas activas: unidad, negociador, cliente, vencimiento y si falta avisar a la agencia. Los botones son **Ver**, **Avisar por WhatsApp** o **Abrir publicación**, y **Marcar avisada**.

Gerencia además tiene el botón **Agencias** para cargar el WhatsApp y el contacto de cada agencia.

## Fotos tapadas

Según lo hablado con el Director Comercial, las fotos de las agencias solo traen patentes y carteles amarillos, y las agencias ya están informadas. Si se suman agencias nuevas, se les informa en su momento.

- El tapado se aplica en las vistas Cliente e Interna, en la ficha y en los resultados del buscador de Compra que vienen del stock de las agencias.
- Las fotos de DeRuedas y Autocosmos que trae el buscador de Compra todavía no se tapan: son publicaciones de fuera del Radar y el editor trabaja sobre el stock de las agencias. Quedan para la detección automática.
- No se agrega ningún logo de X5. Solo se tapan los ajenos.

**Cómo tapar (jefes y gerencia):** en la vista Interna, toca **Tapar fotos** en el panel de reservas, o abre una unidad y toca **Tapar patentes y logos**. Después arrastra un rectángulo sobre la patente, el cartel o el logo.
- **Esta foto** (línea verde): tapa solo esa imagen. Úsalo para patentes y carteles.
- **Toda la agencia** (línea amarilla punteada): tapa ese lugar en todas las fotos de la agencia. Úsalo para un logo que la agencia pone siempre en la misma esquina.
- La ✕ roja quita una caja. Las flechas ‹ › pasan de foto y de unidad.

Las cajas se guardan en proporción a la foto, así que se ven bien en cualquier tamaño de pantalla.

**A futuro:** el lector del stock (GitHub Action) puede detectar solo las patentes y los carteles amarillos y guardar las cajas en `stock.json` (campo `cubrir`). El Radar ya las lee. Falta calibrar el detector con fotos reales.

## Stock propio

El Radar lee los autos propios de X5 desde una planilla, los muestra primero (con la etiqueta **Propio** en Interno) y les pone como precio X5 el precio cargado, más papeles para el puesto en calle. Las unidades marcadas como «Vendido» o «Baja» no se muestran.

**Opción A:** una pestaña `StockPropio` en la misma planilla del Hub.

**Opción B:** la planilla que ya usan:
1. Compartir esa planilla (solo lectura alcanza) con la cuenta dueña del Apps Script del Hub.
2. En Apps Script, ir a Configuración del proyecto → Propiedades del script y agregar:
   - `STOCK_PROPIO_ID`: el código de la planilla (la parte de la URL entre `/d/` y `/edit`).
   - `STOCK_PROPIO_HOJA`: el nombre de la pestaña (opcional; si no se pone, se usa la primera).

**Columnas** (la plantilla está en `docs/plantillas/StockPropio.csv`): `id, marca, modelo, version, anio, km, combustible, caja, color, precio, moneda, fotos, estado, ubicacion, notas, alta`.
- También se aceptan nombres comunes: Año, Kilómetros, Precio venta, Transmisión, Imágenes, Situación, Observaciones.
- En `fotos` van uno o más enlaces separados por espacio, coma o punto y coma.
- La patente (si la planilla la tiene) no se muestra.
- Si en `moneda` dice USD, se convierte con el dólar configurado en el Radar.

**Pendiente:** cuando llegue el acceso a la planilla real, revisar sus encabezados y agregar los nombres que falten al alias (`ALIAS_PROPIO` en Code.gs).

## Puesta en marcha (una vez)

1. **Code.gs v2.14**: pegar el Code.gs nuevo en Apps Script → Implementar → Gestionar implementaciones → editar → **Nueva versión**. La URL no cambia.
2. Las pestañas `RadarReservas`, `RadarRetoques` y `RadarProveedores` se crean solas con el primer uso.
3. **Opcional:** agregar la propiedad del script `RESERVA_HORAS` para cambiar la duración de la reserva (por defecto, 48).
4. **Gerencia:** en Radar → Interno → **Agencias**, cargar el WhatsApp de cada agencia.
5. **Jefes:** en Radar → Interno → **Tapar fotos**, revisar las unidades. Lo primero es el logo de cada agencia con la opción «Toda la agencia».

Mientras no se publique la v2.14, el Radar funciona igual que antes y muestra «Las reservas necesitan el Code.gs v2.14».

## Demo con datos inventados

- **En línea:** `radar/index.html?demo=1`. Usa agencias, autos, fotos, negociadores y clientes inventados. Nada se guarda en el Hub.
- **Archivo descargable:** `python3 radar/armar-demo.py` genera `radar-demo.html`, que se abre sin conexión y no necesita instalar nada. Trae las vistas Cliente, Interna y Novedades.
- Arriba hay un selector para probar como asesora, otro asesor, jefa de ventas o gerencia.
- Para probar el editor de tapado, el Fiat Cronos y la Ford Ranger vienen sin tapar.
- Cuando se hace una reserva, un aviso explica qué mensaje de Telegram llegaría en el Hub real.

## Preguntas frecuentes

- **¿El cliente ve quién reservó?** No. En la vista Cliente solo dice «Reservado», sin nombres ni datos.
- **¿Un asesor ve el cliente de otro asesor?** No. Solo ve el nombre del negociador y el vencimiento.
- **¿Qué pasa si se corta internet?** El Radar sigue mostrando el stock. Las reservas se vuelven a leer solas cada minuto y cada vez que se vuelve a la pantalla.
- **¿Se puede reservar un auto que ya se vendió?** No. El sistema lo rechaza con «La unidad ya se vendió».
- **IA:** queda para una etapa futura.

---
Desarrollado por The DOM Studio Web · thedomstudioweb.github.io · WhatsApp 261-3431216
