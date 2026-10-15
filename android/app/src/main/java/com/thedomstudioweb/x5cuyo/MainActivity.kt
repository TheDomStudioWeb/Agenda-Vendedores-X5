package com.thedomstudioweb.x5cuyo

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.provider.MediaStore
import android.util.Base64
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import java.io.File
import java.io.FileOutputStream

/**
 * X5 Cuyo · Hub Comercial — app Android.
 *
 * Abre el Hub publicado en GitHub Pages dentro de un WebView, así cada
 * cambio que se sube a GitHub llega a la app sin reinstalar nada.
 * Lo que agrega la app sobre la versión web:
 *  - Puente window.X5Android: guardar en Descargas y "Compartir" nativo
 *    (PDF de legajos, DNI, Word del X5 Check, imagen de la Auditoría).
 *  - Cámara y galería para el escáner, el DNI y las fotos del X5 Check.
 *  - WhatsApp, llamadas, Telegram y enlaces externos se abren en su app.
 *  - Botón Atrás del teléfono, pantalla de inicio y aviso sin conexión.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val HUB_URL = "https://thedomstudioweb.github.io/Agenda-Vendedores-X5/"
        private const val HUB_HOST = "thedomstudioweb.github.io"
        private const val HUB_PATH = "/agenda-vendedores-x5"
    }

    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var offline: View

    private var huboError = false
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null
    private var pendingSave: (() -> Unit)? = null

    // Resultado del selector de archivos / cámara
    private val pickFiles =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val cb = fileCallback ?: return@registerForActivityResult
            fileCallback = null
            var uris: Array<Uri>? = null
            if (result.resultCode == RESULT_OK) {
                val data = result.data
                val clip = data?.clipData
                val single = data?.data
                val foto = cameraUri
                uris = when {
                    clip != null && clip.itemCount > 0 -> Array(clip.itemCount) { clip.getItemAt(it).uri }
                    single != null -> arrayOf(single)
                    foto != null -> arrayOf(foto)
                    else -> null
                }
            }
            cameraUri = null
            cb.onReceiveValue(uris)
        }

    // Permiso de almacenamiento (solo Android 9 o anterior)
    private val askStorage =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
            val action = pendingSave
            pendingSave = null
            if (ok) action?.invoke() else toast("Sin permiso para guardar. Probá con Compartir.")
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        progress = findViewById(R.id.progress)
        offline = findViewById(R.id.offline)
        findViewById<Button>(R.id.retry).setOnClickListener {
            offline.visibility = View.GONE
            webView.loadUrl(webView.url ?: HUB_URL)
        }

        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
            userAgentString = "$userAgentString X5CuyoApp/${BuildConfig.VERSION_NAME}"
        }
        webView.addJavascriptInterface(X5Bridge(), "X5Android")
        webView.webViewClient = HubClient()
        webView.webChromeClient = HubChromeClient()
        webView.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            descargarHttp(url, contentDisposition, mimeType)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(urlInicial(intent))
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val data = intent.data
        if (data != null && esDelHub(data)) webView.loadUrl(data.toString())
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    // ── Navegación ──────────────────────────────────────────────────

    private fun urlInicial(intent: Intent?): String {
        val data = intent?.data
        return if (data != null && esDelHub(data)) data.toString() else HUB_URL
    }

    /** true = se abre dentro de la app; false = se abre en otra app. */
    private fun esDelHub(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme == "about" || scheme == "blob" || scheme == "data") return true
        if (scheme != "https" && scheme != "http") return false
        val host = uri.host?.lowercase() ?: return false
        val path = (uri.path ?: "").lowercase()
        return host == HUB_HOST && path.startsWith(HUB_PATH)
    }

    private fun abrirAfuera(uri: Uri) {
        try {
            val scheme = uri.scheme?.lowercase() ?: ""
            val intent = when (scheme) {
                "intent" -> Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME).apply {
                    addCategory(Intent.CATEGORY_BROWSABLE)
                    component = null
                    selector = null
                }
                "tel" -> Intent(Intent.ACTION_DIAL, uri)
                "mailto" -> Intent(Intent.ACTION_SENDTO, uri)
                "http", "https" -> Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
                else -> Intent(Intent.ACTION_VIEW, uri)
            }
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            toast("No hay una app para abrir este enlace")
        } catch (e: Exception) {
            toast("No se pudo abrir el enlace")
        }
    }

    private inner class HubClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            if (esDelHub(uri)) return false
            abrirAfuera(uri)
            return true
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            huboError = false
        }

        override fun onPageFinished(view: WebView, url: String?) {
            progress.visibility = View.GONE
            offline.visibility = if (huboError) View.VISIBLE else View.GONE
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) {
                huboError = true
                offline.visibility = View.VISIBLE
            }
        }
    }

    private inner class HubChromeClient : WebChromeClient() {
        override fun onProgressChanged(view: WebView, newProgress: Int) {
            progress.progress = newProgress
            progress.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
        }

        /** window.open / target="_blank": se decide si va dentro de la app o a otra app. */
        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
            val temporal = WebView(this@MainActivity)
            temporal.webViewClient = object : WebViewClient() {
                private var hecho = false

                private fun manejar(v: WebView, url: String?) {
                    if (hecho || url.isNullOrEmpty() || url == "about:blank") return
                    hecho = true
                    val uri = Uri.parse(url)
                    if (esDelHub(uri)) webView.loadUrl(uri.toString()) else abrirAfuera(uri)
                    v.post { v.destroy() }
                }

                override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                    manejar(v, request.url.toString())
                    return true
                }

                override fun onPageStarted(v: WebView, url: String?, favicon: Bitmap?) {
                    manejar(v, url)
                }
            }
            val transport = resultMsg.obj as WebView.WebViewTransport
            transport.webView = temporal
            resultMsg.sendToTarget()
            return true
        }

        /** <input type="file">: cámara (escáner, DNI, X5 Check) o archivos. */
        override fun onShowFileChooser(
            view: WebView,
            callback: ValueCallback<Array<Uri>>,
            params: WebChromeClient.FileChooserParams
        ): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = callback
            cameraUri = null

            val tipos = params.acceptTypes
                .flatMap { it.split(",") }
                .map { it.trim().lowercase() }
                .filter { it.isNotEmpty() }
            val aceptaImagenes = tipos.isEmpty() || tipos.any { it.startsWith("image") }

            return try {
                val camara = if (aceptaImagenes) intentCamara() else null
                if (params.isCaptureEnabled && camara != null) {
                    pickFiles.launch(camara)
                } else {
                    val mimes = tipos.map { t ->
                        if (t.startsWith(".")) {
                            MimeTypeMap.getSingleton().getMimeTypeFromExtension(t.removePrefix(".")) ?: "*/*"
                        } else t
                    }.distinct()
                    val elegir = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = if (mimes.size == 1) mimes[0] else "*/*"
                        if (mimes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimes.toTypedArray())
                        if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                        }
                    }
                    val chooser = Intent.createChooser(elegir, "Elegir archivo")
                    if (camara != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(camara))
                    pickFiles.launch(chooser)
                }
                true
            } catch (e: Exception) {
                fileCallback = null
                cameraUri = null
                toast("No se pudo abrir la cámara ni los archivos")
                false
            }
        }
    }

    private fun intentCamara(): Intent? {
        return try {
            val dir = File(cacheDir, "camara").apply { mkdirs() }
            val file = File.createTempFile("foto_", ".jpg", dir)
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
            cameraUri = uri
            Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, uri)
                clipData = ClipData.newRawUri("foto", uri)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        } catch (e: Exception) {
            null
        }
    }

    // ── Puente con la web: window.X5Android ─────────────────────────

    inner class X5Bridge {
        @JavascriptInterface
        fun saveFile(base64: String, nombre: String, mime: String) {
            val bytes = decodificar(base64) ?: return
            runOnUiThread { guardarEnDescargas(bytes, limpiarNombre(nombre), mimeSeguro(mime)) }
        }

        @JavascriptInterface
        fun shareFile(base64: String, nombre: String, mime: String) {
            val bytes = decodificar(base64) ?: return
            runOnUiThread { compartir(bytes, limpiarNombre(nombre), mimeSeguro(mime)) }
        }

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME
    }

    private fun decodificar(base64: String): ByteArray? = try {
        Base64.decode(base64, Base64.DEFAULT)
    } catch (e: Exception) {
        runOnUiThread { toast("No se pudo leer el archivo") }
        null
    }

    private fun limpiarNombre(nombre: String): String =
        nombre.replace(Regex("[\\\\/:*?\"<>|]"), "_").take(120).ifBlank { "archivo" }

    private fun mimeSeguro(mime: String): String = mime.ifBlank { "application/octet-stream" }

    private fun guardarEnDescargas(bytes: ByteArray, nombre: String, mime: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, nombre)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/X5 Cuyo")
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("sin uri")
                val out = contentResolver.openOutputStream(uri) ?: throw IllegalStateException("sin salida")
                out.use { it.write(bytes) }
                avisarGuardado(nombre, uri, mime)
            } catch (e: Exception) {
                toast("No se pudo guardar el archivo")
            }
        } else {
            val permiso = Manifest.permission.WRITE_EXTERNAL_STORAGE
            if (ContextCompat.checkSelfPermission(this, permiso) != PackageManager.PERMISSION_GRANTED) {
                pendingSave = { guardarEnDescargas(bytes, nombre, mime) }
                askStorage.launch(permiso)
                return
            }
            try {
                @Suppress("DEPRECATION")
                val base = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val dir = File(base, "X5 Cuyo").apply { mkdirs() }
                val file = File(dir, nombre)
                FileOutputStream(file).use { it.write(bytes) }
                val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
                avisarGuardado(nombre, uri, mime)
            } catch (e: Exception) {
                toast("No se pudo guardar el archivo")
            }
        }
    }

    private fun avisarGuardado(nombre: String, uri: Uri, mime: String) {
        AlertDialog.Builder(this)
            .setTitle("Archivo guardado")
            .setMessage("$nombre\n\nQuedó en Descargas › X5 Cuyo.")
            .setPositiveButton("Abrir") { _, _ -> abrirArchivo(uri, mime) }
            .setNegativeButton("Listo", null)
            .show()
    }

    private fun abrirArchivo(uri: Uri, mime: String) {
        try {
            val ver = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(ver)
        } catch (e: ActivityNotFoundException) {
            toast("No hay una app para abrir este tipo de archivo")
        }
    }

    private fun compartir(bytes: ByteArray, nombre: String, mime: String) {
        try {
            val dir = File(cacheDir, "compartir").apply { mkdirs() }
            val file = File(dir, nombre)
            FileOutputStream(file).use { it.write(bytes) }
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
            val enviar = Intent(Intent.ACTION_SEND).apply {
                type = mime
                putExtra(Intent.EXTRA_STREAM, uri)
                clipData = ClipData.newRawUri(nombre, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(enviar, "Compartir"))
        } catch (e: Exception) {
            toast("No se pudo compartir el archivo")
        }
    }

    /** Descargas comunes por enlace http (no las usa el Hub hoy, quedan cubiertas). */
    private fun descargarHttp(url: String, contentDisposition: String?, mimeType: String?) {
        if (!url.startsWith("http")) return
        try {
            val nombre = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                setTitle(nombre)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, nombre)
            }
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            toast("Descargando $nombre")
        } catch (e: Exception) {
            abrirAfuera(Uri.parse(url))
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
}
