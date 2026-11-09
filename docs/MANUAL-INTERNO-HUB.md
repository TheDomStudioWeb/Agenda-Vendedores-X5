# Manual interno · Hub Comercial X5 Cuyo

> Documento de referencia para Claudio y para el equipo de The DOM Studio Web.
> Explica qué es el Hub, cómo funciona por dentro y cómo responder las dudas más comunes.
> Versión 2.4 · Octubre 2026 · Desarrollado por The DOM Studio Web (Mendoza).

## 1. Qué es

El Hub Comercial X5 Cuyo es la herramienta de trabajo del equipo de ventas de X5 Argentina, Región Cuyo. Reúne en una sola app la agenda de entrevistas, los leads, la auditoría de inversión para el cliente, el escaneo de documentos y el checklist de vehículos.

- **Dirección web:** https://thedomstudioweb.github.io/Agenda-Vendedores-X5/
- **Android:** app "X5 Cuyo" (APK interna, paquete `com.thedomstudioweb.x5cuyo`).
- **iPhone:** se agrega desde Safari a la pantalla de inicio. No hay versión App Store.
- **Código:** repositorio GitHub `TheDomStudioWeb/Agenda-Vendedores-X5`.
- **Datos:** una planilla de Google Sheets, conectada por Google Apps Script.

## 2. Las herramientas

### Mini CRM (`crm.html`)
Agenda de entrevistas y seguimiento de leads. Es la única herramienta que pide usuario y clave. La sesión dura 30 días.

- **Pestañas:** Agenda, Leads y Métricas. Métricas la ven solo los roles Gerente Comercial, Jefe de Ventas y Referente.
- **Resumen del día:** entrevistas de hoy, leads de hoy y vencidos.
- **Agenda:** se carga prospecto, vehículo, lugar (agencia o domicilio con auto de flota), asesor, fecha y hora. Después de la entrevista se marca el estado (Pendiente, Realizada o Cancelada) y el resultado (Venta cerrada, En seguimiento o Descartado). Si hubo venta, se cargan N° de contrato y monto.
- **Leads:** posibles clientes asignados por un jefe, con hora límite de contacto. Los asesores también pueden **cargar sus propios leads** (botón «Cargar un lead propio»): piden prospecto, teléfono, interés, origen y observaciones; el lead queda asignado al propio asesor, sin hora límite (no se marca vencido ni avisa al jefe). Si el teléfono ya existe en su lista, la app lo avisa antes de cargarlo. Un asesor no puede asignar leads a otra persona: eso es de jefes y gerencia (el script también lo exige). Estados: Pendiente, Entrevista pactada, En seguimiento y Descartado/frío. Filtros: Para hoy, Abiertos, Vencidos y Todos.
- **Observaciones y notas:** se guardan solas mientras se escribe. Si no hay señal, quedan en una cola del teléfono y se envían al volver la conexión.
- **Indicador de conexión:** "Al día" (verde), "Guardando" (amarillo) o "Sin señal" (rojo).
- **Campanita:** activa los avisos de Telegram.
- **Filtros (botón Filtros en Agenda y Leads):**
  - **Asesor o equipo:** solo para jefes y gerencia. Elige una persona o un equipo completo (el jefe y quienes le reportan). Se aplica a Agenda, Leads, Métricas y al resumen del día, y queda recordado en el teléfono.
  - **Estado:** en Agenda, pendiente, atrasada, realizada, cancelada, venta, seguimiento o descartado. En Leads, pendiente, vencido, entrevista, seguimiento o descartado.
  - **Fecha:** hoy, ayer, esta semana, semana pasada, este mes, mes anterior o un rango a elección. Al elegir una fecha, la vista pasa sola a Historial/Todos.
  - Debajo aparece un resumen, por ejemplo "12 entrevistas · Equipo de X · Venta". Cada filtro se quita con la ×.
- **Visibilidad:** cada vendedor ve lo suyo, un jefe ve lo suyo y lo de su equipo (`reporta_a`), y el Gerente Comercial ve todo.
- **Tiempo de respuesta:** al tocar Llamar o WhatsApp en un lead, o al cambiarle el estado por primera vez, se registran los minutos desde que fue asignado.

### Auditoría de Inversión (`simulador.html`)
Muestra al cliente qué porcentaje del vehículo tiene cubierto, cuánto le falta para la meta de entrega y en cuántos meses llega.

- **Meta:** 50% para usados y 35% para 0 km.
- **Valor del vehículo X5:** precio base por tipo y año × 1,32.
- **Capital:** 80% de lo abonado + 90% del valor Infoauto del usado + ahorro + inyección extra.
- **Meses estimados:** lo que falta para la meta ÷ (cuota × 0,80).
- **Simulador:** botones +500K, +1M y +2M para mostrar cuántos meses se ahorra el cliente.
- "Compartir imagen" genera el reporte para WhatsApp.

### Gestor Documental (`unificador.html`)
Escanea hojas con la cámara y arma un legajo en un solo PDF A4.
- El escáner detecta los bordes, endereza la hoja y ofrece tres filtros: Original, Color mejorado y Documento.
- Calcula la proporción real de la hoja a partir de la perspectiva: una hoja fotografiada en ángulo ya no sale estirada. Si la forma se parece a una A4 o a una tarjeta (DNI), se ajusta a esa medida.
- En el Gestor Documental, con la casilla "Abrir la cámara de nuevo después de cada página" activa (viene activada), se escanean varias páginas seguidas: al guardar una, la cámara vuelve a abrirse sola. Para terminar, se cierra la cámara sin sacar foto.
- También suma fotos o PDFs existentes, permite reordenar páginas y después compartir o guardar.

### Validador DNI (`dni.html`)
Frente y dorso del DNI en una hoja A4 PDF, en dos tamaños: Ampliado o Tamaño real.

### X5 Check (`x5check.html`)
Checklist del vehículo para controles semanales y recepciones. Cada ítem se marca B, R, M o N/A, y R o M exigen observación. Suma fotos y firma con el dedo, y genera un Word (DOCX). Guarda un borrador si se cierra la app.

## 3. Avisos por Telegram

Bot propio configurado en el Apps Script. Cada persona lo activa desde la campanita del CRM y después toca "Iniciar" en Telegram.

| Evento | A quién le llega |
| --- | --- |
| Lead asignado | Al vendedor, al instante |
| Lead vencido sin contactar | Al vendedor, a su jefe y a gerencia (una vez por lead; se revisa cada 10 minutos) |
| Venta cerrada | Al jefe y a gerencia, cuando se carga el monto (o a los 30 minutos sin monto) |

## 4. Widget del launcher (uso de Daniel)

El launcher personal de Daniel consulta `…/exec?action=widget&key=LAUNCHER_KEY` y muestra:
- entrevistas de hoy,
- leads a contactar,
- leads vencidos,
- un aviso cuando se carga una venta.

Al tocar los vencidos se abre `crm.html?tab=leads&ver=vencidos`.

## 5. Datos (Google Sheets)

| Pestaña | Contenido | Columnas principales |
| --- | --- | --- |
| Hoja 1 | Agenda de entrevistas | id, cliente, vehiculo, asesor, fecha, hora, estado, resultado, notas, lugar, auto_usado, nro_contrato, monto, actualizado, aviso_venta |
| Leads | Leads asignados | id, cliente, telefono, interes, origen, asignado_a, fecha_asignacion, hora_limite, estado, resultado, hora_contacto, notas, actualizado, aviso_vencido |
| Personal | Usuarios | nombre, rol, estado (Activo), reporta_a, clave, telegram |
| Flota | Autos para entrevistas a domicilio | vehiculo, patente, estado |

- **Alta de un vendedor:** agregar una fila en Personal con estado "Activo", su rol, su jefe en `reporta_a` y una clave.
- **Baja:** cambiar el estado a otro valor. La sesión se le corta sola.
- **Cambio de clave:** se edita en la planilla.

## 6. Arquitectura técnica (resumen)

- **Web (PWA):** HTML, CSS y JavaScript sin frameworks, publicada con GitHub Pages.
  - Tema compartido: `x5-theme.css`, en negro y oro de The DOM Studio con cromado y cian de X5. Tiene modo claro y oscuro.
  - Utilidades: `x5-core.js`. Escáner: `x5-scanner.js`. Librerías locales en `libs/`.
  - Service worker `sw.js`: funciona sin conexión y se actualiza solo. Hay que subir `VERSION` en cada cambio grande.
- **Backend:** Google Apps Script (`apps-script/Code.gs`), publicado como aplicación web.
  - Login validado en el servidor con token firmado. Las claves nunca salen de la planilla.
  - Escribe por nombre de columna y crea las columnas que falten.
  - Backend cerrado: sin iniciar sesión (o sin la clave del widget, `LAUNCHER_KEY`) no se puede leer ni escribir nada. Si algún widget viejo deja de mostrar datos, hay que agregarle `&key=<LAUNCHER_KEY>` a su dirección.
- Seguridad del login: después de 5 claves incorrectas de un mismo usuario, el acceso queda bloqueado 10 minutos.
  - Para publicar cambios: Implementar → Administrar implementaciones → editar → **Nueva versión**. La URL no cambia.
- **Android:** carpeta `android/` del repo, un WebView nativo que carga la web. Agrega guardar en Descargas, compartir, cámara y apertura de enlaces externos. Guía de compilación: `docs/APK-ANDROID.md`.

## 7. Preguntas frecuentes (para responder por voz)

- **¿Cómo instalo el Hub en Android?** Abrir el archivo X5-Cuyo.apk, permitir "instalar de esta fuente" e Instalar. Si Play Protect avisa, elegir "Instalar de todas formas".
- **¿Y en iPhone?** Abrir el enlace en Safari, tocar Compartir y después "Agregar a pantalla de inicio".
- **No me deja entrar.** Revisar mayúsculas de la clave. Si sigue, el jefe la verifica en la hoja Personal.
- **"Tu sesión venció".** Volver a ingresar. Pasa cada 30 días o si el usuario fue dado de baja.
- **No veo un lead.** Tocar el indicador de conexión para actualizar, elegir la vista Todos y revisar que no haya filtros activos (el botón Filtros muestra un número cuando los hay).
- **No me llegan los avisos.** Tocar la campanita, luego Iniciar en Telegram, y revisar que Telegram tenga las notificaciones activadas.
- **¿Se pierde lo que escribo sin señal?** No. Queda en el teléfono y se envía al volver la señal. No hay que cerrar sesión mientras diga "Sin señal".
- **¿Dónde quedan los PDF en Android?** En Descargas › X5 Cuyo.
- **¿Cada cuánto hay que actualizar la app?** La web se actualiza sola. La APK solo se cambia si cambia la parte Android.
- **¿Cómo calcula la Auditoría los meses?** Divide lo que falta para la meta por el 80% de la cuota mensual.
- **¿Quién da soporte?** Usuarios y claves: el jefe de ventas o la gerencia comercial. Problemas técnicos: The DOM Studio Web, WhatsApp 261-3431216, thedomstudioweb@gmail.com.

- **¿Cómo veo solo lo de un vendedor o un equipo?** Siendo jefe o gerente, tocar Filtros y elegir en "Asesor o equipo".

## 8. Rutina diaria recomendada para vendedores

1. Al llegar, mirar el resumen del día y empezar por los vencidos.
2. Cuando llega un aviso, contactar al lead antes de su hora límite y dejar una nota.
3. En cada entrevista, usar la Auditoría con el cliente.
4. Después de cada entrevista, cargar estado, resultado y observaciones.
5. Al cerrar una venta, cargar contrato y monto, armar el legajo PDF y avisar al jefe.
6. Antes de irse, verificar que diga "Al día" y que no queden leads pendientes de hoy.

## Editar, eliminar y duplicados en el mini CRM (19/10/2026)

Para Claudio: explicalo en lenguaje simple.

- **Editar:** cada lead y cada entrevista tiene un botón "Editar". Abre un formulario con todos los datos (nombre, teléfono, interés, origen, asesor, fecha, hora, observaciones; en entrevistas de venta también contrato y monto). "Guardar cambios" lo actualiza en la hoja.
- **Eliminar:** botón "Eliminar" con confirmación. Lo puede usar el gerente, el jefe de ventas, el referente, o el asesor dueño del registro. Antes de borrar, el script guarda una copia en la hoja **Eliminados** (fecha, tabla, quién lo eliminó y todos los datos), por si hay que recuperarlo.
- **Duplicados:** el botón "Buscar duplicados" (o "Posibles duplicados (n)" cuando hay) muestra los grupos sospechosos. En leads: solo el mismo teléfono (últimos 8 dígitos); dos prospectos con el mismo nombre pero distinto teléfono no se marcan. En entrevistas: mismo nombre el mismo día y hora, o con el mismo vehículo. Se marca por defecto el registro con más información (venta, monto, estado avanzado, observaciones, contacto hecho). Se revisa y se toca "Conservar el marcado y eliminar los otros".
- **Requiere actualizar el script:** para que "Eliminar" funcione hay que pegar el `apps-script/Code.gs` nuevo y desplegarlo con "Nueva versión" (la URL no cambia). Sin eso, editar funciona pero eliminar avisa "Falta actualizar el script".
- **Si dos personas son distintas pero comparten teléfono** (por ejemplo, de la misma familia), el sistema las propone como posible duplicado: hay que mirar antes de eliminar.

## Resumen por período (semanal a anual) (19/10/2026, ampliado 03/11/2026)

Pestaña **Resumen** en el menú inferior. Solo la ven Gerente Comercial, Jefe de Ventas y Referente.

- **Período del informe:** se elige arriba con el selector. Opciones: **semanal** (lunes a domingo), **quincenal** (del 1 al 15 y del 16 a fin de mes), **mensual**, **trimestral** (ene-mar, abr-jun, jul-sep, oct-dic), **semestral** (ene-jun, jul-dic) y **anual**. Lo elegido queda recordado en el teléfono; por defecto abre en semanal.
- Al elegir un período abre en el **anterior, completo** (semana pasada, mes pasado, etc.). Las flechas ‹ › cambian de período hacia atrás y adelante; el primero es el período en curso, que es parcial y aparece marcado "(en curso)".
- El selector "Asesor o equipo" filtra igual que en Métricas.
- Arriba: una frase con el resumen y 4 números (leads, % contactados, respuesta promedio, ventas con monto).
- Gráficos: respuesta a los leads (recibidos / contactados / sin contactar) y resultado de las entrevistas realizadas (venta, seguimiento, descartado, sin resultado).
- **Por asesor**: leads, contactados, tiempo de respuesta, entrevistas realizadas (entre paréntesis las canceladas) y ventas.
- **Para atender**: leads del período sin contactar, entrevistas pasadas sin marcar, asesor más rápido y más lento.
- **Observaciones**: las notas cargadas en leads y entrevistas del período. En períodos largos se muestran las más recientes y se indica cuántas más hay.
- Botón **Descargar PDF**: arma una hoja A4 clara con el título del período elegido (por ejemplo "Resumen trimestral"), de una o más páginas. En el celular abre "Compartir" (WhatsApp, mail); en la compu lo descarga.
- Cómo se calcula: lead contactado = estado distinto de "pendiente" o con tiempo de contacto cargado. Los leads se cuentan por su fecha de asignación y las entrevistas por su fecha. No hay cambios en el script ni en la planilla.

## Usuario Supervisor, solo lectura (03/11/2026)

Cuenta para quien necesita **mirar todo el Hub sin poder cambiar nada** (por ejemplo, un directivo o un auditor).

- **Qué ve:** toda la agenda y todos los leads de todo el equipo, Métricas, Resumen por período, el gestor de **Control de contratos** completo (incluidos los contratos que están en gerencia) y todas las herramientas del Hub. Puede filtrar por asesor o equipo y descargar el PDF del resumen.
- **Qué no puede hacer:** cargar ni editar entrevistas o leads, cambiar estados u observaciones, asignar, eliminar, buscar y limpiar duplicados, archivar, tocar contratos ni listas de precios, ni activar avisos de Telegram. Esos botones no aparecen, y además **el script rechaza cualquier cambio** aunque alguien lo intente por otra vía.
- **Cómo se crea (2 pasos):**
  1. Pegar el `apps-script/Code.gs` nuevo en Apps Script y desplegarlo con **Implementar > Administrar implementaciones > Editar > Nueva versión** (la URL no cambia).
  2. En la hoja **Personal** agregar una fila: `nombre` (lo que va a escribir al entrar), `rol` = **Supervisor** (exacto, con esa mayúscula), `estado` = **Activo**, `reporta_a` vacío y una `clave`. La columna `telegram` queda vacía.
- **Importante:** sin el paso 1 el rol no se reconoce y la cuenta vería la app como un asesor sin datos. La baja funciona como siempre: poner `estado` distinto de Activo corta su sesión en un minuto.
- **Diferencia con el rol Control:** «Control» ve solo el gestor de contratos y no entra al CRM. «Supervisor» ve todo.

## Limpiar / archivar descartados (19/10/2026)

Botón **Limpiar / archivar** al lado de "Buscar duplicados", en las pestañas Agenda y Leads. Lo ve solo el **Gerente Comercial** (el script también lo exige: nadie más puede archivar ni restaurar).

- Mueve a una hoja nueva de la planilla, **Archivo**, los leads con estado "Descartado" y las entrevistas con resultado "Descartado". Se crea sola la primera vez.
- Opciones antes de confirmar, con el número exacto de lo que se va a mover: leads, entrevistas, incluir también las entrevistas canceladas (apagado por defecto) y antigüedad (cualquier fecha, o solo las de más de 30, 60 o 90 días).
- **No borra nada.** Cada registro queda en "Archivo" con quién lo archivó y la fecha. **Ver archivo** lista lo archivado y permite **Restaurar** uno por uno; vuelve con el mismo estado que tenía.
- Lo archivado deja de aparecer en la agenda, en los leads y en el resumen semanal y las métricas, porque ya no está en las hojas principales.
- Requiere conexión. Si el script de la planilla todavía no se actualizó, avisa "Falta actualizar el script de la planilla para poder archivar".
- Hojas de la planilla: **Eliminados** guarda lo borrado a mano; **Archivo** guarda lo archivado.

## Imagen de marca (kit X5)
Todo el Hub usa el kit de marca de X5 Argentina: rojo #E3182D, negro carbón y grafito, plata como acento secundario, tipografía Montserrat. El logo oficial (carpeta `brand/`) va en blanco sobre fondo oscuro y en rojo sobre fondo claro, y cambia solo según el modo del teléfono. Los colores se ajustan en un único lugar: las variables al inicio de `x5-theme.css`. La firma de The DOM Studio Web conserva su dorado.

## Radar de Usados (20/10/2026)
Es una tarjeta del Hub, entre Mini CRM y Auditoría. Muestra el stock de usados de las agencias con el precio X5 ya calculado. Tiene cuatro vistas: **Cliente** (tarjetas con fotos, para mostrarle al cliente), **Interno** (precio de la agencia, guía y diferencia), **Compra** (buscador de unidades en otras provincias) y **Novedades** (qué se publicó, bajó de precio o salió). El precio X5 se ajusta en el desplegable «Precio X5»: regla (guía + % o precio de agencia + monto fijo), papeles y dólar. Los datos se actualizan solos varias veces al día; la app los pide siempre frescos y nunca los guarda en el teléfono.


## Seguridad y mantenimiento (v2.3, 23/10/2026)
- **Cada asesor modifica solo lo suyo.** El servidor valida al crear, editar y eliminar: un asesor solo toca sus propias entrevistas y leads y no puede pasárselos a otro. Gerente Comercial, Jefe de Ventas y Referente pueden tocar todo. Si un cambio es rechazado por permisos, la app avisa «No tenés permiso para modificar ese registro» y sigue guardando el resto.
- **El puesto es privado.** La pantalla de ingreso muestra solo los nombres; el puesto se conoce recién al iniciar sesión.
- **La sesión se renueva sola** mientras se usa (dura 30 días y se extiende cuando le quedan menos de 15). Quien no abre el Hub en un mes tiene que volver a ingresar.
- **Hoja «Eliminados»:** guarda copia de cada registro borrado y se limpia sola: pasados 90 días se quitan las copias más viejas.
- **Más rápido:** la lista de personal se guarda 60 segundos en memoria del servidor. Si se da de baja a alguien, su sesión se corta como máximo al minuto.
- Para publicar estos cambios: pegar `Code.gs` nuevo en Apps Script y **Nueva versión** de la implementación existente.

## Claves protegidas y sesión fuera de la dirección (v2.4, 23/10/2026)
- **Claves protegidas en la planilla.** En la hoja Personal, la columna `clave` deja de mostrar la clave real: guarda una huella («h1$…») que no se puede revertir. Quien administra la planilla ya no ve las claves del equipo.
- **Cómo se protegen:** al ejecutar `protegerClaves()` en Apps Script (una sola vez), o solas en el primer ingreso de cada persona.
- **Dar o cambiar una clave:** escribirla normal en la celda de esa persona (ej. 4821). Se protege sola en su primer ingreso. Si alguien la olvida, no se puede «ver»: se le asigna una nueva.
- **La sesión ya no viaja en la dirección.** Los datos y el enlace de Telegram se piden por POST, así que el token no queda en los registros del servidor. El widget del launcher sigue usando su clave de solo lectura (`LAUNCHER_KEY`).
- Limitación: si las claves son cortas y solo números, la huella protege de la lectura casual pero no de quien tenga la planilla y pruebe combinaciones. Conviene claves de 6 caracteres o más.

## Nueva imagen del mini CRM: barra inferior y Métricas (09/11/2026)
Cambio solo visual: no cambia ningún dato, permiso ni cálculo.
- **Barra inferior flotante.** El menú de abajo (Agenda, Leads, Métricas, Resumen) ahora flota como una píldora de vidrio. Sobre la pestaña activa cae un haz de luz rojo X5 que se desliza al cambiar de pestaña, y el ícono activo brilla. Los nombres siguen debajo de cada ícono.
- **Métricas (gerencia, jefes, referentes y supervisor):**
  - *Facturación del período* va en una tarjeta roja brillante con un reflejo que la cruza al entrar.
  - Los números (facturación, cierres, leads, conversión) suben contando desde el valor anterior. Solo se animan si el número cambió; las sincronizaciones automáticas no los repiten.
  - *Conversión de leads* tiene un medidor semicircular que se llena según el porcentaje.
  - En *Facturación por asesor* y *Ventas por auto de flota*, el primero se resalta en rojo con la etiqueta **MEJOR** y los demás quedan más tenues. En *Minutos hasta el primer contacto* se resalta el **MÁS RÁPIDO** (el menor tiempo), porque ahí menos es mejor.
  - La dona de *Origen de las ventas* se dibuja por partes y las tarjetas entran con un desenfoque suave.
- Si el teléfono tiene activado "reducir movimiento", todo se muestra sin animaciones.
- La APK abre la web publicada, así que el cambio llega solo, sin recompilar (se subió la versión de caché a x5-os-v32).
- Referencia de estilo: videos "Admin Dashboard V5" y "Glassy Navigation Tabs V5" guardados por Daniel.

**Para responder por voz:** "¿Qué significa MEJOR en las barras?" → Es el asesor que más facturó (o el auto de flota con más ventas) en el período y equipo elegidos. "¿Y MÁS RÁPIDO?" → El asesor que, en promedio, tardó menos en contactar a sus leads.
