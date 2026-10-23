# Avisos por Telegram y widget del launcher

Todo esto ya está programado en `apps-script/Code.gs` (v2.1) y en `crm.html`.
Solo falta activarlo. Tiempo estimado: 15 minutos, con buena conexión.

---

## 1. Crear el bot de Telegram (una sola vez, 3 min)

1. En Telegram, buscá **@BotFather** (tiene tilde azul) y tocá **Iniciar**.
2. Escribí `/newbot`.
3. Nombre visible: `X5 Cuyo Avisos` (o el que quieras).
4. Usuario del bot: tiene que terminar en `bot`, por ejemplo `X5CuyoAvisosBot`.
5. BotFather te responde con un **token** parecido a `7412345678:AAH...`. Copialo. **No lo compartas.**
6. Opcional, para que se vea prolijo: `/setuserpic` (logo X5) y `/setdescription`.

## 2. Actualizar el Apps Script (5 min)

1. Abrí el proyecto de Apps Script del Hub.
2. Reemplazá todo el contenido de `Code.gs` por el de `apps-script/Code.gs` de este repo y guardá con **Ctrl + S**.
3. Andá a **Configuración del proyecto** (ícono ⚙️ a la izquierda) → **Propiedades del script** → **Agregar propiedad**:
   - Propiedad: `TELEGRAM_TOKEN`
   - Valor: el token del paso 1
4. Revisá en esa misma pantalla que la **zona horaria** sea `(GMT-03:00) Argentina/Mendoza`. Los vencidos se calculan con esa hora.
5. Volvé al editor, elegí la función **`configurarTelegram`** en el desplegable de arriba y tocá **Ejecutar**.
   - Google va a pedir permisos nuevos ("conectarse a un servicio externo" y "ejecutar cuando no estás presente"). Aceptá.
   - En el registro de ejecución vas a ver: `✅ Telegram listo. Bot: @...` y la **LAUNCHER_KEY** para el widget. Anotala.
6. **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. La URL no cambia.

`configurarTelegram` también:
- crea las columnas `telegram` (Personal), `aviso_vencido` (Leads) y `aviso_venta` (Hoja 1);
- marca como "ya avisados" los vencidos y las ventas que existen hoy, para que no llegue una lluvia de mensajes viejos;
- crea un disparador que corre cada minuto.

## 3. Que cada persona active sus avisos (1 min por persona)

Cada vendedor, jefe y gerente:
1. Instala **Telegram** (Android o iPhone) si no lo tiene.
2. Entra al **Mini CRM** del Hub y toca la **campanita 🔔** de arriba.
3. Se abre Telegram con el bot → toca **Iniciar**.
4. El bot responde: "✅ Listo, Laura. Desde ahora vas a recibir acá los avisos…".

Para probar: en el editor de Apps Script ejecutá **`probarTelegram`**. Les llega un mensaje de prueba a los Gerentes Comerciales vinculados.

## ¿Qué avisos llegan y a quién?

| Evento | Vendedor asignado | Su jefe (`reporta_a`) | Gerente Comercial |
|---|---|---|---|
| 🎯 Nuevo lead asignado | ✅ al instante | — | — |
| ⚠️ Lead vencido sin contactar | ✅ | ✅ | ✅ |
| 🎉 Venta cerrada | — | ✅ | ✅ |

- **Lead vencido:** estado "Pendiente" y pasó la hora límite. Se revisa cada 10 minutos y se avisa **una sola vez** por lead.
- **Venta cerrada:** se avisa apenas se carga el **monto**. Si queda marcada como venta sin monto, se avisa igual a los 30 minutos.
- Cada aviso trae un botón que abre el Hub directo en el lugar correcto.

Para cambiar los tiempos, editá al principio de la sección Telegram de `Code.gs`:
`MINUTOS_REVISION_VENCIDOS` y `MINUTOS_GRACIA_VENTA`.

---

## 4. Widget del launcher

### Endpoint

```
GET <URL /exec del Apps Script>?action=widget&key=<LAUNCHER_KEY>
```

La `LAUNCHER_KEY` aparece al ejecutar `configurarTelegram`. También está en Propiedades del script.

### Respuesta

```json
{
  "ok": true,
  "generado": "2026-10-13T17:20:00.000Z",
  "resumen": { "entrevistas_hoy": 3, "leads_hoy": 5, "leads_vencidos": 2, "ventas_mes": 7, "facturacion_mes": 129500000 },
  "proxima_entrevista": { "cliente": "Pedro Ruiz", "hora": "16:00", "asesor": "Laura Paz", "vehiculo": "208" },
  "leads_vencidos": [
    { "id": "1760…", "cliente": "Juan Pérez", "asignado_a": "Laura Paz", "interes": "Amarok", "telefono": "261…", "vencio": "09:00 13/10", "minutos_atraso": 135 }
  ],
  "ventas_recientes": [
    { "id": "1759…", "cliente": "Ana D'Amico", "asesor": "Laura Paz", "vehiculo": "Cronos", "monto": 18500000, "cuando": "2026-10-13T16:58:12.000Z" }
  ],
  "links": {
    "leads_vencidos": "https://thedomstudioweb.github.io/Agenda-Vendedores-X5/crm.html?tab=leads&ver=vencidos",
    "leads": "…crm.html?tab=leads", "agenda": "…crm.html?tab=agenda", "metricas": "…crm.html?tab=dashboard", "hub": "…"
  }
}
```

### Qué mostrar (lo acordado)

- **Leads vencidos**: el número en rojo (`resumen.leads_vencidos`). Al tocarlo se abre `links.leads_vencidos`, y el CRM entra directo en Leads con el filtro **Vencidos**.
- **Pop-up de venta cerrada**: el widget consulta cada 2–5 minutos. Si en `ventas_recientes` aparece un `id` que no había visto, muestra el aviso.
  Igual, el aviso de Telegram ya te llega al teléfono aunque el launcher esté cerrado.

### Código de ejemplo para el widget (JavaScript)

```js
const X5_WIDGET_URL = 'https://script.google.com/macros/s/AKfycbwd9HUXBTCrmuZKglXS7cvPa56RHW3LcQQuXz-OgaMzYVQvcTnUZDA-QOukvf0bWqTu/exec?action=widget&key=PEGAR_LAUNCHER_KEY';

async function actualizarWidgetX5() {
  try {
    const d = await (await fetch(X5_WIDGET_URL, { cache: 'no-store' })).json();
    if (!d.ok) return;

    // 1) Leads vencidos
    const el = document.getElementById('x5-vencidos');
    el.textContent = d.resumen.leads_vencidos;
    el.classList.toggle('alerta', d.resumen.leads_vencidos > 0);
    el.onclick = () => window.open(d.links.leads_vencidos, '_blank');

    // 2) Pop-up por venta nueva
    const vistas = JSON.parse(localStorage.getItem('x5_ventas_vistas') || '[]');
    const nuevas = d.ventas_recientes.filter(v => !vistas.includes(v.id));
    if (vistas.length && nuevas.length) mostrarPopupVenta(nuevas[0]); // la primera vez solo memoriza
    localStorage.setItem('x5_ventas_vistas', JSON.stringify(d.ventas_recientes.map(v => v.id)));
  } catch (e) { /* sin señal: se reintenta en la próxima vuelta */ }
}

function mostrarPopupVenta(v) {
  const monto = v.monto ? ' · $ ' + v.monto.toLocaleString('es-AR') : '';
  // Reemplazar por el toast/pop-up propio del launcher:
  alert(`🎉 Venta cerrada: ${v.asesor} · ${v.cliente}${monto}`);
}

actualizarWidgetX5();
setInterval(actualizarWidgetX5, 3 * 60 * 1000);
```

---

## Lectura cerrada
Desde la v2.2 el backend está cerrado: nadie puede leer la base sin iniciar sesión o sin la clave del widget (`LAUNCHER_KEY`). El widget usa `action=widget&key=...`.
