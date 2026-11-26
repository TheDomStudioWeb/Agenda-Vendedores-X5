# Ingreso y egreso del personal · Hub X5 Cuyo

Manual interno (también para Claudio). Herramienta del Hub para el personal que cobra por horas: marca su llegada y su salida con la ubicación del teléfono, y se exporta un PDF semanal, quincenal o mensual para quien cuenta las horas.

## Qué hace
- Tarjeta **«Ingreso y egreso»** en el Hub, en el grupo **Personal**.
- Dos botones grandes: **Ingreso** (verde) y **Salida** (rojo). Solo se puede tocar el que corresponde: si estás adentro, solo Salida; si estás afuera, solo Ingreso. Antes de registrar pide confirmar la hora.
- **La hora la pone el servidor** (Google), no el teléfono: aunque alguien cambie la hora del celular, se registra la real.
- **Cada marca guarda la ubicación del teléfono** (georreferenciada). Si el teléfono no da permiso de ubicación, no deja marcar y explica cómo activarlo. Si da permiso pero no consigue la señal a tiempo, marca igual y el turno queda «Sin ubicación» (en rojo, también en el PDF).
- **Ubicación de la agencia:** gerencia la fija una vez, parada dentro de la agencia (botón «Fijar aquí»). Desde ahí, cada marca sale como «En la agencia» (hasta 150 m) o «Fuera de la agencia · 2,2 km». Tocando la etiqueta se abre el punto en Google Maps.
- Se pueden marcar varios turnos en el mismo día (por ejemplo, mañana y tarde).
- Abajo se elige el período: **Semanal** (lunes a domingo), **Quincenal** (1 al 15 y 16 a fin de mes) o **Mensual**. Se ve cada día con sus turnos, la ubicación de cada marca, las horas, el total del período y los días trabajados. Con las flechas se ven períodos anteriores. El teléfono recuerda el último período elegido.
- **Exportar en PDF** (del período elegido): primero aparecen dos recuadros para **firmar con el dedo en el teléfono**: la persona que informa las horas y el responsable (con su nombre y aclaración). Las firmas pasan al PDF con la fecha y hora en que se firmaron. Si alguien no está, se deja vacío y queda la línea para firmar en papel. El PDF es A4 con la marca X5 (el mensual ocupa dos hojas, numeradas), día por día (ingreso, salida, horas, ubicación de cada marca y observaciones), con la cantidad de marcas sin ubicación o fuera de la agencia, total en horas y minutos y en horas con decimales (por ejemplo «22:33 h (22,55 horas)»). En el teléfono se abre «Compartir» para mandarlo por WhatsApp o mail.

## Quién ve qué
- **Rol «Personal»** (por ejemplo, la persona de limpieza): al entrar al Hub solo ve la tarjeta de Ingreso y egreso. No entra al CRM, a contratos ni al resto, y no aparece en las listas de vendedores ni de responsables.
- **Gerente Comercial**: ve a todos. Arriba elige de quién ver el registro, ve quién está «adentro» en ese momento, exporta el PDF de cualquiera y puede **corregir** (olvido de marcar la salida, una hora mal), **borrar** un turno duplicado o **cargar un turno a mano**. Toda corrección pide un motivo y queda escrita en las observaciones del turno y del PDF (quién, cuándo y por qué). Lo borrado queda copiado en la hoja «Eliminados».
- **RRHH** (Recursos Humanos): ve el registro de todo el personal, elige el período y **exporta el PDF**. No puede marcar horarios, ni corregir, borrar o cargar turnos. Al entrar al Hub solo ve la tarjeta de Ingreso y egreso, y no aparece en las listas de vendedores.
- **Supervisor**: ve todo, solo lectura.
- Cualquier otro usuario del Hub también puede usar la tarjeta para marcar sus propias horas, si alguna vez hace falta.

## Avisos automáticos
- Si alguien marca la salida más de 16 horas después del ingreso (se olvidó de marcar), el turno queda señalado «Revisar» para que gerencia lo corrija.
- Un turno sin salida no suma horas en el total ni en el PDF hasta que se corrija; el PDF lo avisa en rojo.

## Puesta en marcha (una sola vez)
1. **Apps Script del Hub**: abrí el proyecto de Apps Script de la planilla del Hub, reemplazá todo `Code.gs` por el de `apps-script/Code.gs` del repositorio y guardá. Después **Implementar → Administrar implementaciones → editar la actual → Versión: Nueva versión → Implementar** (así la dirección /exec no cambia).
2. **Planilla, hoja «Personal»**: agregá una fila para la persona: `nombre` (como querés que figure, por ejemplo «Rosa Pérez»), `rol` = **Personal**, `estado` = **Activo**, `reporta_a` = tu nombre, `clave` = una clave simple (se protege sola en el primer ingreso).
3. La hoja **«Asistencia»** se crea sola con el primer ingreso marcado. No hace falta tocarla. Las columnas de ubicación (`entrada_geo`, `salida_geo`) también se agregan solas.
4. **Usuario de RRHH:** otra fila en «Personal» con `rol` = **RRHH**, `estado` = **Activo** y su clave.
5. **Fijar la agencia:** gerencia entra a Ingreso y egreso parada dentro de la agencia y toca **Fijar aquí**.
6. **APK de Android:** para que la app pida el permiso de ubicación hay que compilar la versión nueva (2.2) en Android Studio y repartirla. En iPhone y en el navegador no hace falta nada.
7. En el teléfono de la persona: abrí el Hub (APK o enlace web), elegí su nombre, poné la clave y listo. La sesión dura 30 días y se renueva sola mientras la usa.

## Uso diario (para explicarle a la persona)
1. Al llegar: abrir el Hub → **Ingreso y egreso** → tocar **Ingreso** → **Confirmar**. La primera vez, el teléfono pide permiso de ubicación: tocar **Permitir**.
2. Al irse: tocar **Salida** → **Confirmar**.
3. Si no hay señal, el registro no se guarda: la app avisa «Sin conexión: no se registró». Hay que volver a tocar cuando haya señal (o avisar a gerencia para que lo cargue a mano).

## Frases para Claudio
- «Para marcar la llegada: Hub → Ingreso y egreso → Ingreso → Confirmar.»
- «Para mandar las horas: Ingreso y egreso → elegí Semanal, Quincenal o Mensual → Exportar en PDF → firman los dos en el teléfono → Armar PDF → elegí WhatsApp.»
- «Cada marca guarda dónde estaba el teléfono. Si dice Fuera de la agencia, se marcó a más de 150 metros; si dice Sin ubicación, el teléfono no la pudo dar.»
- «RRHH solo mira y exporta: no puede marcar ni corregir horarios.»
- «Si se olvidó de marcar la salida, gerencia la corrige desde Ingreso y egreso: tocá Corregir en el turno y escribí el motivo.»
- «La hora la pone el sistema, no el teléfono.»

Desarrollado por The DOM Studio Web · WhatsApp 261-3431216 · thedomstudioweb@gmail.com
