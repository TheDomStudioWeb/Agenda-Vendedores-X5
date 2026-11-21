# Radar de Usados · Reservas, fotos tapadas y stock propio

Manual interno (también para Claudio). Versión del backend: Code.gs v2.14.

> Cambio de criterio (20/11/2026): en un principio no se iba a poner ningún logo propio. Ahora las patentes pasan a la placa X5 y los carteles amarillos a cartel rojo X5. Los logos ajenos se siguen desenfocando.

## Para qué sirve

El Radar lo usan los negociadores de X5 (no los clientes), muchas veces con el cliente mirando la pantalla al lado. Esta versión suma tres cosas:

1. **Reservas compartidas**: un negociador reserva una unidad para su cliente y esa unidad queda bloqueada para todos los demás.
2. **Fotos tapadas**: el sistema detecta solo las patentes (las cubre con una placa X5) y los carteles amarillos (los cambia por un cartel rojo X5). Los logos de otras agencias se desenfocan.
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

## Fotos tapadas (automático)

Las fotos de las agencias traen patentes y carteles amarillos. Las agencias ya están informadas por el Director Comercial; si se suman agencias nuevas, se les informa en su momento.

**Qué se ve:**
- **Patentes:** quedan cubiertas por una placa blanca con el logo de X5 Argentina.
- **Carteles amarillos** («VENDO» con teléfono): quedan cubiertos por un cartel rojo X5 con el logo en blanco.
- **Logos de otras agencias:** se desenfocan.

Se aplica en las vistas Cliente e Interna, en la ficha y en los resultados del buscador de Compra que vienen del stock de las agencias. Las fotos de DeRuedas y Autocosmos todavía no se tapan.

**Cómo funciona:** el lector del stock (GitHub Action, dos veces por día) descarga cada foto nueva y busca dos cosas:
- **Patentes:** con un modelo de detección de patentes de código abierto. Corre gratis dentro de la Action.
- **Carteles amarillos:** por color, con un rectángulo amarillo intenso y texto oscuro adentro.

Cada foto se analiza una sola vez y el resultado queda en `radar/data/cubrir.json`. El Radar lee las tapas de `stock.json` (campo `cubrir`).

**Revisión (jefes y gerencia):** en la vista Interna, toca **Tapar fotos** en el panel de reservas, o abre una unidad y toca **Tapar patentes y logos**.
- Las cajas con línea celeste punteada («auto») las puso el sistema. Si están bien, no hace falta tocar nada.
- Si falta una, elige **Patente → placa X5**, **Cartel → rojo X5** o **Logo → desenfocar** y arrastra un rectángulo sobre la foto.
- Si sobra una, la quita la ✕ roja.
- Cuando se toca una foto, lo guardado a mano reemplaza a lo automático de esa foto.
- **Toda la agencia** aplica la caja a todas las fotos de esa agencia. Sirve para un logo que siempre está en la misma esquina.

**Calibración:** cada corrida deja en GitHub → Actions → la corrida → «Artifacts» un paquete `muestras-tapas` con hasta 40 fotos que muestran lo que detectó. Si cambian los criterios, se sube `VERSION` en `radar/scraper/cubrir.py` y se vuelven a analizar todas las fotos.

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
- Las tapas de la demo simulan la detección automática. A propósito, a la Ford Ranger «se le escapó» la patente, para probar la corrección a mano.
- Cuando se hace una reserva, un aviso explica qué mensaje de Telegram llegaría en el Hub real.

## Preguntas frecuentes

- **¿El cliente ve quién reservó?** No. En la vista Cliente solo dice «Reservado», sin nombres ni datos.
- **¿Un asesor ve el cliente de otro asesor?** No. Solo ve el nombre del negociador y el vencimiento.
- **¿Qué pasa si se corta internet?** El Radar sigue mostrando el stock. Las reservas se vuelven a leer solas cada minuto y cada vez que se vuelve a la pantalla.
- **¿Se puede reservar un auto que ya se vendió?** No. El sistema lo rechaza con «La unidad ya se vendió».
- **IA:** queda para una etapa futura.

---
Desarrollado por The DOM Studio Web · thedomstudioweb.github.io · WhatsApp 261-3431216
