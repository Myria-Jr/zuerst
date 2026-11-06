package labs.odkaz.zuerst

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun Profile(catalog: Catalog, journal: Journal, update: (Journal) -> Unit) {
    val context = LocalContext.current
    val cloud = remember { Cloud(context) }
    val scope = rememberCoroutineScope()
    var account by remember { mutableStateOf<Account?>(null) }
    var checking by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var register by rememberSaveable { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var restore by remember { mutableStateOf<Journal?>(null) }
    var removeBackup by remember { mutableStateOf(false) }

    fun action(work: suspend () -> Unit) {
        if (busy) return
        busy = true; message = ""
        scope.launch { try { work() } catch (error: Exception) { message = error.message?.takeIf { it.length < 180 } ?: "Bitte prüfe deine Verbindung und versuche es erneut." } finally { busy = false } }
    }
    LaunchedEffect(Unit) { runCatching { cloud.session() }.onSuccess { account = it }; checking = false }
    val export = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) runCatching { context.contentResolver.openOutputStream(uri)?.use { it.write(journal.json().toString(2).toByteArray()) } ?: error("Datei konnte nicht geöffnet werden.") }
            .onSuccess { message = "Sicherung exportiert." }.onFailure { message = "Die Datei konnte nicht gespeichert werden." }
    }
    val import = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) runCatching {
            val source = context.contentResolver.openInputStream(uri)?.use { input ->
                val output = ByteArrayOutputStream(); val buffer = ByteArray(8192)
                while (true) { val count = input.read(buffer); if(count < 0) break; require(output.size() + count <= 1_000_000) { "Die Datei ist zu groß (maximal 1 MB)." }; output.write(buffer, 0, count) }
                output.toString("UTF-8")
            } ?: error("Die Datei konnte nicht geöffnet werden.")
            Journal.parse(source, catalog)
        }.onSuccess { restore = it }.onFailure { message = it.message?.takeIf { text -> text.length < 140 } ?: "Das ist keine gültige Zuerst-Sicherung." }
    }
    AppearancePicker()
    JournalCard {
        Text("Ganz du", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        OutlinedTextField(journal.name, { update(journal.copy(name = it.take(40))) }, Modifier.fillMaxWidth(), label = { Text("Dein Name") }, singleLine = true)
        Text("Der Name wird auf diesem Gerät gespeichert.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    JournalCard {
        Text("Konto & Sicherung", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        if (checking) LinearProgressIndicator(Modifier.fillMaxWidth())
        else if (account != null) {
            Text("Angemeldet als ${account!!.email}")
            Text("Sichere Vorrat, Sammlung, Plan und Verlauf. Es wird nur übertragen, wenn du auf „Jetzt sichern“ tippst.")
            Button({ action { cloud.save(journal); message = "Deine Sicherung wurde gespeichert." } }, Modifier.fillMaxWidth().heightIn(min = 50.dp), enabled = !busy) { Text("Jetzt sichern") }
            FilledTonalButton({ action { restore = cloud.restore(catalog) } }, Modifier.fillMaxWidth().heightIn(min = 48.dp), enabled = !busy) { Text("Sicherung wiederherstellen") }
            TextButton({ action { cloud.signOut(); account = null; message = "Abgemeldet. Deine lokalen Daten bleiben erhalten." } }, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) { Text("Abmelden") }
            TextButton({ removeBackup = true }, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) { Text("Cloud-Sicherung löschen") }
        } else {
            Text("Freiwillig. Dein Journal funktioniert auch ohne Anmeldung. Mit einem Konto kannst du es sichern und auf einem anderen Gerät wiederherstellen.")
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("Anmelden", "Konto erstellen").forEachIndexed { index, title -> SegmentedButton(register == (index == 1), { register = index == 1 }, SegmentedButtonDefaults.itemShape(index, 2)) { Text(title) } }
            }
            OutlinedTextField(email, { email = it.take(254) }, Modifier.fillMaxWidth(), label = { Text("E-Mail") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
            OutlinedTextField(password, { password = it.take(128) }, Modifier.fillMaxWidth(), label = { Text("Passwort · mindestens 8 Zeichen") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
            Button({ action { account = cloud.signIn(email, password, register, journal.name); password = ""; message = "Du bist angemeldet. Deine Daten bleiben lokal, bis du sie sicherst." } }, Modifier.fillMaxWidth().heightIn(min = 50.dp), enabled = !busy && email.contains('@') && password.length >= 8) { Text(if(busy) "Einen Moment …" else if(register) "Konto erstellen" else "Anmelden") }
            TextButton({ action { cloud.reset(email); message = "Falls ein Konto besteht, erhältst du eine E-Mail zum Zurücksetzen." } }, enabled = !busy && email.contains('@'), modifier = Modifier.heightIn(min = 48.dp)) { Text("Passwort vergessen?") }
        }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (message.isNotBlank()) Text(message, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = MaterialTheme.colorScheme.primary)
    }
    JournalCard {
        Text("Deine Daten gehören dir", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text("Sichere dein Journal als Datei. Beim Import entscheidest du, ob die lokalen Daten ersetzt werden.")
        FilledTonalButton({ export.launch("zuerst-${LocalDate.now()}.json") }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Exportieren") }
        OutlinedButton({ import.launch(arrayOf("application/json", "text/plain")) }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Importieren") }
    }
    JournalCard {
        Text("Über Zuerst", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text("Dein Begleiter für Einkauf, Vorrat und selbst gekochte Gerichte. Bonfotos werden auf diesem Gerät gelesen und anschließend verworfen. Die Cloud-Sicherung ist freiwillig. Deine Anmeldung wird mit dem Android Keystore verschlüsselt gespeichert.")
        Text("Von Vora · ein Projekt von Odkaz Labs. Version 1.3.0.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    restore?.let { backup -> AlertDialog(onDismissRequest = { restore = null }, title = { Text("Sicherung wiederherstellen?") }, text = { Text("Du übernimmst ${backup.stock.size} Vorratszutaten, ${backup.meals.size} Kocheinträge und ${backup.plans.size} geplante Gerichte. Deine lokalen Daten werden ersetzt. Exportiere sie vorher, wenn du sie behalten möchtest.") },
        confirmButton = { TextButton({ update(backup); restore = null; message = "Sicherung wiederhergestellt." }) { Text("Lokale Daten ersetzen") } }, dismissButton = { TextButton({ restore = null }) { Text("Abbrechen") } }) }
    if (removeBackup) AlertDialog(onDismissRequest = { removeBackup = false }, title = { Text("Cloud-Sicherung löschen?") }, text = { Text("Die Sicherung wird endgültig gelöscht. Deine lokalen Daten bleiben erhalten.") },
        confirmButton = { TextButton({ removeBackup = false; action { cloud.removeBackup(); message = "Cloud-Sicherung gelöscht." } }) { Text("Löschen") } }, dismissButton = { TextButton({ removeBackup = false }) { Text("Abbrechen") } })
}
