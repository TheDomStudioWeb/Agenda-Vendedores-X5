# APK Android del Hub Comercial X5 Cuyo

El proyecto de Android Studio está en la carpeta `android/` de este repo.

## Cómo funciona

La app es un contenedor nativo liviano (WebView) que abre el Hub publicado en
GitHub Pages: `https://thedomstudioweb.github.io/Agenda-Vendedores-X5/`.

- **Los cambios del Hub llegan solos.** Todo lo que se sube a GitHub (CRM, Auditoría, escáner, etc.) aparece en la app sin generar una APK nueva.
- **Hay que generar una APK nueva solo si cambia algo de la parte Android:** el ícono, el nombre, los permisos o el código de `MainActivity.kt`.
- Los iPhone siguen usando la web desde Safari. Todos comparten el mismo código y los mismos datos.

Lo que la app agrega sobre la web:

| Función | Qué hace |
| --- | --- |
| Guardar archivos | Los PDF, Word e imágenes se guardan en **Descargas › X5 Cuyo** y ofrecen "Abrir" |
| Compartir | Abre la hoja de compartir de Android (WhatsApp, mail, Drive) |
| Cámara | El escáner, el DNI y el X5 Check abren la cámara o la galería |
| Enlaces externos | WhatsApp, llamadas, Telegram, mail y otras webs se abren en su app |
| Botón Atrás | Vuelve a la pantalla anterior del Hub |
| Sin conexión | Muestra el aviso "Sin conexión" con el botón Reintentar |

La web detecta la app por `window.X5Android` (lo usa `x5-core.js`) y por el agregado `X5CuyoApp/2.0` en el user agent.

## Datos del proyecto

| Dato | Valor |
| --- | --- |
| Nombre visible | X5 Cuyo |
| Paquete (applicationId) | `com.thedomstudioweb.x5cuyo` |
| Android mínimo | 7.0 (API 24) |
| Versión | `versionName` 2.0 · `versionCode` 1 |
| Herramientas | AGP 8.7.3 · Kotlin 2.0.21 · Gradle 8.9 · JDK 17 |

## Compilar la APK (primera vez)

1. Descargá el repo a la computadora: **Code → Download ZIP** en GitHub y descomprimilo, o `git clone`.
2. Abrí **Android Studio → Open** y elegí la carpeta **`android`** (no la raíz del repo).
3. Esperá a que termine el **Gradle Sync** (barra de abajo). La primera vez descarga varias cosas y tarda unos minutos.
   - Si Android Studio ofrece actualizar el plugin de Android Gradle o Gradle, aceptá.
   - Si pide instalar un SDK que falta (Android 15 / API 35), aceptá.
4. Menú **Build → Generate Signed App Bundle or APK…** → elegí **APK** → **Next**.
5. **Key store path → Create new…** (solo la primera vez):
   - Guardalo **fuera del repo**, por ejemplo `Documentos/Llaves/x5cuyo.jks`.
   - Poné una contraseña y completá **Alias** `x5cuyo` y **Validity** 25 años.
   - En **First and Last Name** poné "The DOM Studio Web" y en **Organization** "X5 Cuyo".
6. **Next** → elegí **release** → **Create**.
7. Cuando termine, tocá **locate** en el aviso. El archivo está en `android/app/release/app-release.apk`.
8. Renombralo a **`X5-Cuyo.apk`**, que es el nombre que figura en el manual de vendedores, y repartilo por WhatsApp o mail.

> **Importante: la llave (`.jks`) y sus contraseñas no se pueden perder.** Cada actualización tiene que firmarse con la misma llave. Si se pierde, los vendedores van a tener que desinstalar la app vieja para poder instalar la nueva. Guardá una copia en Drive. El `.gitignore` impide que se suba a GitHub.

## Publicar una actualización de la APK

Solo hace falta cuando cambia algo de la parte Android.

1. En `android/app/build.gradle.kts`, subí `versionCode` en 1 (por ejemplo, de 1 a 2). Si querés, cambiá también `versionName`.
2. Repetí **Build → Generate Signed App Bundle or APK…** con la **misma llave**.
3. Repartí la APK nueva. Se instala encima de la anterior y conserva la sesión y los datos.

## Probar antes de repartir

- [ ] Abre el Hub y muestra la pantalla de inicio con las 5 herramientas.
- [ ] Mini CRM: ingresa con usuario y clave, y las notas se guardan.
- [ ] El botón WhatsApp abre WhatsApp y Llamar abre el teléfono.
- [ ] La campanita abre Telegram.
- [ ] Gestor Documental: **Escanear** abre la cámara, **Agregar archivos** abre la galería y **Generar PDF → Guardar** muestra "Archivo guardado → Abrir".
- [ ] Validador DNI: frente y dorso con cámara, y después **Compartir** abre la hoja de compartir.
- [ ] X5 Check: fotos, firma y **Generar DOCX**.
- [ ] Auditoría: **Compartir imagen**.
- [ ] El botón Atrás vuelve al inicio del Hub. En modo avión, una página nueva muestra "Sin conexión".

## Problemas frecuentes al compilar

| Error | Solución |
| --- | --- |
| `Unsupported class file major version` o error de JDK | **Settings → Build Tools → Gradle → Gradle JDK**: elegí JDK 17 o el "jbr-17/21" que trae Android Studio |
| `SDK location not found` | Abrí la carpeta `android` desde Android Studio (crea `local.properties` solo) |
| Pide actualizar AGP | Aceptá el asistente de actualización |
| "App no instalada" en el teléfono | Hay una versión firmada con otra llave. Desinstalá la anterior e instalá de nuevo |

## Enlaces de Telegram que abren la app

La app declara los enlaces `https://thedomstudioweb.github.io/Agenda-Vendedores-X5/...`. En Android 12 o posterior, para que los botones de los avisos abran la app en vez de Chrome, cada usuario debe activarlo una vez:
**Ajustes → Aplicaciones → X5 Cuyo → Abrir de forma predeterminada → Agregar enlaces → marcar thedomstudioweb.github.io**.
Si no lo hace, el aviso abre el Hub en Chrome y todo funciona igual.
