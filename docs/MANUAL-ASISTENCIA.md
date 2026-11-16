# Ingreso y egreso del personal · Hub X5 Cuyo

Manual interno (también para Claudio). Herramienta del Hub para el personal que cobra por horas: marca su llegada y su salida, y al terminar la semana se exporta un PDF para quien cuenta las horas.

## Qué hace
- Tarjeta **«Ingreso y egreso»** en el Hub, en el grupo **Personal**.
- Dos botones grandes: **Ingreso** (verde) y **Salida** (rojo). Solo se puede tocar el que corresponde: si estás adentro, solo Salida; si estás afuera, solo Ingreso. Antes de registrar pide confirmar la hora.
- **La hora la pone el servidor** (Google), no el teléfono: aunque alguien cambie la hora del celular, se registra la real.
- Se pueden marcar varios turnos en el mismo día (por ejemplo, mañana y tarde).
- Abajo se ve la semana (lunes a domingo): cada día con sus turnos, las horas de cada uno, el total de horas de la semana y los días trabajados. Con las flechas se ven semanas anteriores.
- **Exportar semana en PDF**: hoja A4 con la marca X5, día por día (ingreso, salida, horas y observaciones), total en horas y minutos y en horas con decimales (por ejemplo «22:33 h (22,55 horas)»), lugar para la firma del empleado y del responsable. En el teléfono se abre «Compartir» para mandarlo por WhatsApp o mail.

## Quién ve qué
- **Rol «Personal»** (por ejemplo, la persona de limpieza): al entrar al Hub solo ve la tarjeta de Ingreso y egreso. No entra al CRM, a contratos ni al resto, y no aparece en las listas de vendedores ni de responsables.
- **Gerente Comercial**: ve a todos. Arriba elige de quién ver el registro, ve quién está «adentro» en ese momento, exporta el PDF de cualquiera y puede **corregir** (olvido de marcar la salida, una hora mal), **borrar** un turno duplicado o **cargar un turno a mano**. Toda corrección pide un motivo y queda escrita en las observaciones del turno y del PDF (quién, cuándo y por qué). Lo borrado queda copiado en la hoja «Eliminados».
- **Supervisor**: ve todo, solo lectura.
- Cualquier otro usuario del Hub también puede usar la tarjeta para marcar sus propias horas, si alguna vez hace falta.

## Avisos automáticos
- Si alguien marca la salida más de 16 horas después del ingreso (se olvidó de marcar), el turno queda señalado «Revisar» para que gerencia lo corrija.
- Un turno sin salida no suma horas en el total ni en el PDF hasta que se corrija; el PDF lo avisa en rojo.

## Puesta en marcha (una sola vez)
1. **Apps Script del Hub**: abrí el proyecto de Apps Script de la planilla del Hub, reemplazá todo `Code.gs` por el de `apps-script/Code.gs` del repositorio y guardá. Después **Implementar → Administrar implementaciones → editar la actual → Versión: Nueva versión → Implementar** (así la dirección /exec no cambia).
2. **Planilla, hoja «Personal»**: agregá una fila para la persona: `nombre` (como querés que figure, por ejemplo «Rosa Pérez»), `rol` = **Personal**, `estado` = **Activo**, `reporta_a` = tu nombre, `clave` = una clave simple (se protege sola en el primer ingreso).
3. La hoja **«Asistencia»** se crea sola con el primer ingreso marcado. No hace falta tocarla.
4. En el teléfono de la persona: abrí el Hub (APK o enlace web), elegí su nombre, poné la clave y listo. La sesión dura 30 días y se renueva sola mientras la usa.

## Uso diario (para explicarle a la persona)
1. Al llegar: abrir el Hub → **Ingreso y egreso** → tocar **Ingreso** → **Confirmar**.
2. Al irse: tocar **Salida** → **Confirmar**.
3. Si no hay señal, el registro no se guarda: la app avisa «Sin conexión: no se registró». Hay que volver a tocar cuando haya señal (o avisar a gerencia para que lo cargue a mano).

## Frases para Claudio
- «Para marcar la llegada: Hub → Ingreso y egreso → Ingreso → Confirmar.»
- «Para mandar las horas de la semana: Ingreso y egreso → Exportar semana en PDF → elegí WhatsApp.»
- «Si se olvidó de marcar la salida, gerencia la corrige desde Ingreso y egreso: tocá Corregir en el turno y escribí el motivo.»
- «La hora la pone el sistema, no el teléfono.»

Desarrollado por The DOM Studio Web · WhatsApp 261-3431216 · thedomstudioweb@gmail.com
