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
