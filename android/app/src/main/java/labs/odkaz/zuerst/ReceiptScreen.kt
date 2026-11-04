package labs.odkaz.zuerst

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.TimeUnit

@Composable
internal fun ReceiptScreen(catalog: Catalog, save: (List<String>) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current
    var selected by rememberSaveable { mutableStateOf(arrayListOf<String>()) }
    var draft by remember { mutableStateOf("") }
    var cameraPath by rememberSaveable { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var message by rememberSaveable { mutableStateOf<String?>(null) }

    fun analyze(text: String) {
        val ids = catalog.receipt(text)
        selected = ArrayList((selected + ids).distinct())
        message = if (ids.isEmpty()) "Keine Katalog-Zutaten erkannt. Du kannst sie unten einzeln ergänzen." else null
    }

    fun scan(uri: Uri, temporary: File? = null) {
        busy = true
        message = null
        scope.launch {
            try {
                val text = withContext(Dispatchers.IO) {
                    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).use { recognizer ->
                        val image = InputImage.fromFilePath(context, uri)
                        Tasks.await(recognizer.process(image), 30, TimeUnit.SECONDS).text
                    }
                }
                analyze(text)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                message = "Das Foto konnte nicht gelesen werden. Versuche ein schärferes Foto oder füge Bontext ein."
            } finally {
                temporary?.delete()
                busy = false
            }
        }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> uri?.let { scan(it) } }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { captured ->
        val file = cameraPath?.let(::File)
        cameraPath = null
        if (file != null && captured) scan(Uri.fromFile(file), file) else file?.delete()
    }

    JournalTitle("Bon erfassen")
    Text("Zuerst liest das Foto lokal. Prüfe vor dem Speichern, welche Zutaten wirklich in deinen Vorrat gehören.")
    JournalCard {
        Button(enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp), onClick = {
            try {
                val folder = File(context.cacheDir, "receipts").apply { mkdirs() }
                folder.listFiles()?.filter { it.lastModified() < System.currentTimeMillis() - 86_400_000 }?.forEach { it.delete() }
                val file = File.createTempFile("receipt-", ".jpg", folder)
                cameraPath = file.absolutePath
                camera.launch(FileProvider.getUriForFile(context, "${context.packageName}.receipt", file))
            } catch (_: Exception) {
                cameraPath?.let { File(it).delete() }
                cameraPath = null
                message = "Die Kamera ist gerade nicht verfügbar. Wähle ein Foto aus der Galerie."
            }
        }) { Text("Bon fotografieren") }
        FilledTonalButton({ picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Foto auswählen") }
        if (busy) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            Text("Bon wird gelesen …")
        }
        message?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
    JournalCard {
        Text("Bontext einfügen", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        OutlinedTextField(draft, { draft = it.take(20_000) }, Modifier.fillMaxWidth(), label = { Text("Text vom Kassenbon") }, minLines = 2, maxLines = 4)
        TextButton({ focus.clearFocus(); analyze(draft); draft = "" }, enabled = !busy && draft.isNotBlank()) { Text("Text prüfen") }
    }
    JournalCard {
        Text("Zutaten prüfen · ${selected.size}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        if (selected.isEmpty()) Text("Erkannte Zutaten erscheinen hier. Fehlende Produkte kannst du ergänzen.")
        selected.forEach { id ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(catalog.name(id), Modifier.weight(1f))
                IconButton({ selected = ArrayList(selected - id) }) { Icon(Icons.Default.Close, "${catalog.name(id)} aus Entwurf entfernen") }
            }
        }
        IngredientLookup(catalog, selected) { selected = ArrayList(selected + it) }
        Button({ save(selected) }, enabled = selected.isNotEmpty() && !busy,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("In Vorrat übernehmen") }
    }
}
