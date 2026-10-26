# Manual interno · Control de contratos (X5 Cuyo Hub)

Pantalla: **Hub → Ventas → Control de contratos** (`contratos.html`). Es solo **nominal**: se controla el número y el estado de cada contrato; no se suben archivos ni fotos.

## Estados
- **Disponible**: en gerencia, sin repartir.
- **Vacío**: entregado a un jefe o vendedor, sin completar.
- **Completo**: el cliente lo completó.
- **Cargado**: cargado en el sistema.
- **Recibido**: el jefe lo recibió del vendedor y lo tiene para rendir a gerencia.
- **Rendido**: rendido a gerencia; se registra el pago del sellado (el monto es libre, varía según el contrato).
- **Anulado**: extraviado, dañado o dado de baja (solo gerencia).
- **En la calle** = Vacío + Completo + Cargado + Recibido (todavía no rendidos a gerencia).

## Quién hace qué
- **Gerente Comercial**: carga números, ve todo, asigna, es el único que marca **Rendido**, corrige estados y anula.
- **Jefe de Ventas / Referente**: ve lo suyo y lo de su equipo (según Personal.reporta_a); reparte a su equipo, marca **Recibido** (no Rendido) y corrige.
- **Asesor**: ve sus contratos; marca Completo y Cargado.

## Flujo
1. Gerencia carga los números disponibles (lista o rangos: `1001-1050`).
2. Gerencia asigna a jefes; los jefes reparten a vendedores (tildar contratos → "Asignar a…"). Se puede devolver a gerencia.
3. El vendedor marca Completo y Cargado.
4. El jefe marca Recibido cuando el vendedor le entrega el contrato.
5. Gerencia rinde: se registra forma del sellado (Transferencia con N.º de operación, o Contado con el nombre de quien dio el visto bueno) y monto opcional.

## Carga inicial de lo ya repartido (solo gerencia)
Panel "Cargar números", segundo cuadro: un contrato por renglón `número;responsable;estado;cliente` (cliente opcional). El responsable debe existir en la hoja Personal. Si el contrato ya existe se actualiza. Los renglones con error se informan y no se cargan.

## Puesta en marcha
1. Pegar `apps-script/Code.gs` en Apps Script y **Implementar → Administrar implementaciones → Nueva versión**.
2. Se crean solas las hojas `Contratos` y `ContratosLog` (historial de cada cambio).
3. Subir los archivos del Hub a GitHub Pages (el servicio se actualiza al subir la versión del sw).

Desarrollado por The DOM Studio Web · WhatsApp 261-3431216 · thedomstudioweb@gmail.com

## Conexión con el CRM (venta cerrada)
- Al marcar **Venta cerrada** en el Mini CRM, el **N.º de contrato es obligatorio**: sin número la venta no se guarda, y no se puede borrar el número de una venta.
- Al guardar el número, el contrato pasa solo de **Vacío a Completo** en el gestor y toma el nombre del cliente. Solo si es del vendedor (o de su equipo, si carga un jefe).
- Si el número no existe, es de otra persona, está sin asignar, anulado o ya más avanzado, el CRM avisa con un cartel y **no cambia nada**.
- Si se corrige el número, el anterior vuelve a Vacío (solo si estaba Completo por esa misma venta) y avisa.
- Sin señal, el cambio queda en cola y se aplica al reconectar.

## Lista de precios (planes) y sellado
- Hoja `Precios`. Columnas: código (PX61…), vehículo, apertura de carpeta (cuota 5 o 10; solo informativo), **adelanto mensual (valor de cuota)**, **sellado**, pago 1 y 2 (solo informativo).
- Solo gerencia la carga: Hub → Control de contratos → "Lista de precios". Se puede pegar desde Excel o Word. Dos modos: **agregar o actualizar** solo los códigos pegados, o **reemplazar todo** (si hay un renglón con error, no cambia nada).
- En el CRM, al cerrar una venta se piden **N.º de contrato y código del plan**, los dos obligatorios. Se muestra el vehículo, la cuota y el sellado a rendir.
- El contrato guarda una copia del código, la cuota y el sellado del momento de la venta: si el listado cambia después, las ventas anteriores no se modifican.
- El vendedor ve en cada contrato el **sellado a rendir** y el total. Los jefes ven el total por vendedor.
- Al rendir, el monto del sellado se toma del contrato; gerencia puede escribir otro monto si se pagó distinto.

## Vistas de la pantalla
- **Rejilla** (por defecto): cada contrato es un cuadro con su número, coloreado por estado y con el nombre del responsable. Tocar un cuadro abre el detalle. **Elegir varios** permite tocar varios (o "Elegir todos") para asignarlos o cambiarles el estado juntos.
- **Lista**: tarjetas con el detalle de cada contrato; se elige con casillas.
- **Equipo** (jefes y gerente): una tarjeta por responsable con barra de avance (vacío, completo, cargado, recibido, rendido) y el sellado a rendir. Tocarla filtra los contratos de esa persona.
- Los botones de estado de arriba también filtran.

## Cargas y correcciones
- Los números de contrato llevan **solo cifras**. Si un renglón se carga mal (por ejemplo sin los `;`), el sistema lo rechaza y dice cuál es.
- En la rejilla, cada cuadro muestra las **iniciales** del responsable (nombre y apellido); al mantener apretado o en el detalle se ve el nombre completo.
- Un contrato cargado por error y que está en gerencia (o anulado) se puede **quitar del listado** (solo gerencia): se elige en la rejilla o en la lista y se toca "Quitar del listado". Queda anotado en el historial. Los que están en la calle o rendidos no se pueden quitar, solo anular.
