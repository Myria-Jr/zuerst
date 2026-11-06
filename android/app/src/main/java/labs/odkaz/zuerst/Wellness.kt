package labs.odkaz.zuerst

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import java.security.KeyStore
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONArray
import org.json.JSONObject

internal fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }

internal data class FoodValue(
    val id: String,
    val name: String,
    val kcal: Double,
    val protein: Double,
    val carbs: Double,
    val fat: Double,
    val source: Int,
    val aliases: String,
    val vision: List<String>,
)

internal class WellnessStore(context: Context) {
    private val prefs = context.getSharedPreferences("wellness_private", Context.MODE_PRIVATE)
    val foods =
        context.assets.open("foods.json").bufferedReader().use {
            JSONObject(it.readText()).getJSONArray("foods").objects().map { f ->
                val n = f.getJSONObject("per100g")
                FoodValue(
                    f.getString("id"),
                    f.getString("name"),
                    n.optDouble("energyKcal", 0.0),
                    n.optDouble("proteinG", 0.0),
                    n.optDouble("carbohydrateG", 0.0),
                    n.optDouble("fatG", 0.0),
                    f.getInt("fdcId"),
                    f.getJSONArray("aliases").toString(),
                    (0 until f.getJSONArray("vision").length()).map { i ->
                        f.getJSONArray("vision").getString(i)
                    },
                )
            }
        }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return (store.getKey("zuerst-wellness", null) as? SecretKey)
            ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
                .apply {
                    init(
                        KeyGenParameterSpec.Builder(
                                "zuerst-wellness",
                                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                            )
                            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                            .build()
                    )
                }
                .generateKey()
    }

    fun load(): JSONObject {
        val encoded = prefs.getString("data", null) ?: return empty()
        val parts = encoded.split(":")
        val cipher =
            Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(
                    Cipher.DECRYPT_MODE,
                    key(),
                    GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)),
                )
            }
        return JSONObject(
            String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8)
        )
    }

    fun save(data: JSONObject) {
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val encrypted = c.doFinal(data.toString().toByteArray())
        check(
            prefs
                .edit()
                .putString(
                    "data",
                    Base64.encodeToString(c.iv, Base64.NO_WRAP) +
                        ":" +
                        Base64.encodeToString(encrypted, Base64.NO_WRAP),
                )
                .commit()
        ) {
            "Speicher nicht verfügbar"
        }
    }

    companion object {
        fun empty() =
            JSONObject()
                .put("version", 1)
                .put("food", JSONArray())
                .put("drinks", JSONArray())
                .put("imports", JSONArray())
                .put("favoriteFoods", JSONArray())
                .put("shoppingText", JSONArray())
    }
}

internal fun JSONObject.journalEnabled() =
    optJSONObject("profile")?.let {
        it.optInt("age") >= 16 && it.optString("policyVersion") == "2026-11-05.1"
    } == true

internal fun JSONObject.adult() = journalEnabled() && getJSONObject("profile").optInt("age") >= 18

private fun decimals(value: Double) = String.format(java.util.Locale.GERMAN, "%.1f", value)

@Composable
internal fun WellnessToday(store:WellnessStore,data:JSONObject,update:(JSONObject)->Unit,open:()->Unit) {
    val day=LocalDate.now().toString()
    val drinks=data.optJSONArray("drinks")?.objects()?.filter { it.optString("day")==day && it.optString("kind")=="water" } ?: emptyList()
    val entries=data.optJSONArray("food")?.objects()?.filter { it.optString("day")==day } ?: emptyList()
    JournalCard(LocalTones.current.water,LocalTones.current.onWater) {
        Text("Wasser heute",style=MaterialTheme.typography.titleLarge)
        Text("${drinks.sumOf { it.optInt("ml") }} ml",style=MaterialTheme.typography.headlineMedium)
        Button({val next=JSONObject(data.toString());next.getJSONArray("drinks").put(JSONObject().put("id",UUID.randomUUID().toString()).put("kind","water").put("ml",250).put("caffeineMg",0).put("day",day).put("at",Instant.now().toString()).put("name","Wasser"));update(next)}) { Text("+ 250 ml") }
        TextButton(open) { Text("Getränke ansehen & bearbeiten") }
    }
    JournalCard(LocalTones.current.nutrition,LocalTones.current.onNutrition) {
        Text("Ernährung heute",style=MaterialTheme.typography.titleLarge)
        if(data.adult() && entries.isNotEmpty()) Text("${decimals(entries.sumOf { entry -> (store.foods.firstOrNull { it.id==entry.optString("foodId") }?.kcal ?: 0.0)*entry.optDouble("grams")/100 })} kcal",style=MaterialTheme.typography.headlineMedium)
        Text("${entries.size} bestätigte Essenseinträge. Kein geschätzter Tagesbedarf.")
        TextButton(open) { Text("Essen eintragen") }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun WellnessScreen(store: WellnessStore, data: JSONObject, update: (JSONObject) -> Unit) {
    val context = LocalContext.current
    val tones = LocalTones.current
    var age by remember { mutableStateOf("") }
    var consent by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    var chosen by remember { mutableStateOf<FoodValue?>(null) }
    var grams by remember { mutableStateOf("100") }
    var message by remember { mutableStateOf("") }
    var scanning by remember { mutableStateOf(false) }
    var suggestions by remember { mutableStateOf<List<FoodValue>>(emptyList()) }
    var fromPhoto by remember { mutableStateOf(false) }
    var undo by remember { mutableStateOf<JSONObject?>(null) }
    val day = LocalDate.now().toString()
    val enabled = data.journalEnabled()
    val adult = data.adult()
    val entries =
        data.optJSONArray("food")?.objects().orEmpty().filter { it.optString("day") == day }
    val drinks =
        data.optJSONArray("drinks")?.objects().orEmpty().filter { it.optString("day") == day }
    fun change(next: JSONObject, text: String) {
        undo = JSONObject(data.toString())
        update(next)
        message = text
    }
    val picker =
        rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            if (uri != null) {
                scanning = true
                val labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
                try {
                    labeler
                        .process(InputImage.fromFilePath(context, uri))
                        .addOnSuccessListener { labels ->
                            suggestions =
                                store.foods
                                    .filter { f ->
                                        f.vision.any { term ->
                                            labels.any {
                                                it.confidence >= .45f &&
                                                    Regex(
                                                            "\\b" + Regex.escape(term) + "\\b",
                                                            RegexOption.IGNORE_CASE,
                                                        )
                                                        .containsMatchIn(it.text)
                                            }
                                        }
                                    }
                                    .take(6)
                            message =
                                if (suggestions.isEmpty())
                                    "Kein passender Vorschlag. Bitte manuell suchen."
                                else "Lebensmittel und gewogene Gramm selbst bestätigen."
                        }
                        .addOnFailureListener {
                            message =
                                "Bildanalyse nicht bereit. Bitte manuell suchen; das Modell wird bei erster Nutzung geladen."
                        }
                        .addOnCompleteListener {
                            scanning = false
                            labeler.close()
                        }
                } catch (_: Exception) {
                    scanning = false
                    labeler.close()
                    message = "Bild nicht lesbar. Bitte manuell suchen."
                }
            }
        }
    JournalTitle("Essen")
    if (!enabled)
        JournalCard(tones.trend, tones.onTrend) {
            Text(
                "Dein Journal bleibt bei dir",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Ab 16 freiwillig. Unter 18 ohne Kalorienübersicht und Koffeinjournal. Kochen bleibt offen."
            )
            OutlinedTextField(
                age,
                { age = it },
                label = { Text("Alter in Jahren") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row {
                Checkbox(consent, { consent = it })
                Text(
                    "Alter und Journal lokal speichern. Jederzeit unter Mehr widerrufbar.",
                    Modifier.weight(1f),
                )
            }
            Button(
                {
                    val years = age.toIntOrNull()
                    if (years == null || years !in 6..120) message = "Gib ein gültiges Alter an."
                    else if (years < 16) message = "Das Journal ist ab 16. Kochen bleibt verfügbar."
                    else if (consent)
                        update(
                            JSONObject(data.toString())
                                .put(
                                    "profile",
                                    JSONObject()
                                        .put("age", years)
                                        .put("consentAt", Instant.now().toString())
                                        .put("policyVersion", "2026-11-05.1"),
                                )
                        )
                },
                enabled = consent,
            ) {
                Text("Journal aktivieren")
            }
        }
    JournalCard(tones.nutrition, tones.onNutrition) {
        Text(
            "Was hast du gegessen?",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )
        Text("Roh und gekocht sind getrennte Lebensmittel.")
        FilledTonalButton(
            { picker.launch("image/*") },
            enabled = !scanning,
            modifier = Modifier.heightIn(min = 48.dp),
        ) {
            Text(if (scanning) "Foto wird lokal geprüft …" else "Foto als Suchhilfe")
        }
        Text(
            "Fotos bleiben auf dem Gerät. Das Google-Modell wird bei erster Nutzung geladen. Öl, Sauce und Gramm selbst ergänzen.",
            style = MaterialTheme.typography.bodySmall,
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            suggestions.forEach { f ->
                ZuerstFilter(f.name, false) {
                    chosen = f
                    fromPhoto = true
                    suggestions = emptyList()
                }
            }
        }
        OutlinedTextField(
            query,
            {
                query = it
                chosen = null
                fromPhoto = false
            },
            label = { Text("Lebensmittel suchen · z. B. Nudeln") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        if (chosen == null && query.isBlank()) {
            val favorites = data.optJSONArray("favoriteFoods") ?: JSONArray()
            val ids = (0 until favorites.length()).map { favorites.getString(it) }
            if (ids.isNotEmpty())
                Text("Häufig gegessen", style = MaterialTheme.typography.titleMedium)
            store.foods
                .filter { it.id in ids }
                .forEach { food ->
                    TextButton(
                        {
                            chosen = food
                            fromPhoto = false
                        },
                        Modifier.fillMaxWidth().heightIn(min = 48.dp),
                    ) {
                        Text(food.name)
                    }
                }
        }
        if (chosen == null && query.isNotBlank()) {
            val results =
                store.foods.filter { (it.name + it.aliases).contains(query, true) }.take(10)
            if (results.isEmpty()) Text("Keine Treffer. Suche eine einzelne Grundzutat.")
            results.forEach { f ->
                TextButton(
                    {
                        chosen = f
                        fromPhoto = false
                    },
                    Modifier.fillMaxWidth().heightIn(min = 48.dp),
                ) {
                    Text(f.name, Modifier.weight(1f))
                    if (adult || !enabled) Text("${decimals(f.kcal)} kcal/100 g")
                }
            }
        }
        chosen?.let { f ->
            Text(f.name, fontWeight = FontWeight.Bold)
            val favorites = data.optJSONArray("favoriteFoods") ?: JSONArray()
            val remembered = (0 until favorites.length()).any { favorites.getString(it) == f.id }
            TextButton({
                val next = JSONObject(data.toString())
                val ids = (0 until favorites.length()).map { favorites.getString(it) }
                next.put(
                    "favoriteFoods",
                    JSONArray(if (remembered) ids.filter { it != f.id } else ids + f.id),
                )
                update(next)
            }) {
                Text(
                    if (remembered) "Nicht mehr häufig gegessen"
                    else "Als häufiges Lebensmittel merken"
                )
            }
            OutlinedTextField(
                grams,
                { grams = it },
                label = { Text("Bestätigte Menge (g)") },
                modifier = Modifier.fillMaxWidth(),
            )
            val amount = grams.replace(',', '.').toDoubleOrNull()
            if (amount != null && amount > 0 && amount <= 5000) {
                if (adult || !enabled) Text("${decimals(f.kcal*amount/100)} kcal")
                Text(
                    "${decimals(f.protein*amount/100)} g Eiweiß · ${decimals(f.carbs*amount/100)} g Kohlenhydrate · ${decimals(f.fat*amount/100)} g Fett"
                )
                Button(
                    {
                        val next = JSONObject(data.toString())
                        next
                            .getJSONArray("food")
                            .put(
                                JSONObject()
                                    .put("id", UUID.randomUUID().toString())
                                    .put("foodId", f.id)
                                    .put("grams", amount)
                                    .put("day", day)
                                    .put("at", Instant.now().toString())
                                    .put("source", if (fromPhoto) "photo" else "manual")
                            )
                        change(next, "Essen eingetragen.")
                        chosen = null
                        query = ""
                    },
                    enabled = enabled,
                    modifier = Modifier.heightIn(min = 48.dp),
                ) {
                    Text(
                        if (enabled) "Menge bestätigen & eintragen" else "Journal zuerst aktivieren"
                    )
                }
            }
            TextButton({
                context.startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("https://fdc.nal.usda.gov/food-details/${f.source}/nutrients"),
                    )
                )
            }) {
                Text("USDA-Quelle ansehen")
            }
        }
    }
    if (enabled) {
        JournalCard {
            Text(
                "Heute eingetragen",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            if (adult)
                Text(
                    "${decimals(entries.sumOf{e->(store.foods.find{it.id==e.optString("foodId")}?.kcal?:0.0)*e.optDouble("grams")/100})} kcal",
                    style = MaterialTheme.typography.headlineMedium,
                )
            Text("Nur deine Einträge, keine vollständige Messung.")
            entries.forEach { e ->
                Row {
                    Text(
                        "${store.foods.find{it.id==e.optString("foodId")}?.name} · ${decimals(e.optDouble("grams"))} g",
                        Modifier.weight(1f),
                    )
                    TextButton({
                        val next =
                            JSONObject(data.toString())
                                .put(
                                    "food",
                                    JSONArray(
                                        data.getJSONArray("food").objects().filter {
                                            it.optString("id") != e.optString("id")
                                        }
                                    ),
                                )
                        change(next, "Eintrag gelöscht.")
                    }) {
                        Text("Löschen")
                    }
                }
            }
        }
        JournalCard(tones.water, tones.onWater) {
            Text(
                "Wasser",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "${drinks.filter{it.optString("kind")=="water"}.sumOf{it.optInt("ml")}} ml",
                style = MaterialTheme.typography.headlineLarge,
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(250, 500).forEach { ml ->
                    FilledTonalButton({
                        val next = JSONObject(data.toString())
                        next
                            .getJSONArray("drinks")
                            .put(
                                JSONObject()
                                    .put("id", UUID.randomUUID().toString())
                                    .put("kind", "water")
                                    .put("ml", ml)
                                    .put("caffeineMg", 0)
                                    .put("day", day)
                                    .put("at", Instant.now().toString())
                                    .put("name", "Wasser")
                            )
                        change(next, "Wasser eingetragen.")
                    }) {
                        Text("+ $ml ml")
                    }
                }
            }
        }
        if (adult) CaffeineCard(data, ::change)
        HealthConnectCard()
        if (drinks.isNotEmpty())
            JournalCard {
                Text("Deine Getränke heute", style = MaterialTheme.typography.titleLarge)
                drinks.forEach { drink ->
                    Row {
                        Text(
                            "${drink.optString("name")} · ${drink.optInt("ml")} ml" +
                                if (adult && drink.optString("kind") == "caffeine")
                                    " · ${drink.optDouble("caffeineMg")} mg Koffein"
                                else "",
                            Modifier.weight(1f),
                        )
                        TextButton({
                            val next =
                                JSONObject(data.toString())
                                    .put(
                                        "drinks",
                                        JSONArray(
                                            data.getJSONArray("drinks").objects().filter {
                                                it.optString("id") != drink.optString("id")
                                            }
                                        ),
                                    )
                            change(next, "Getränk gelöscht.")
                        }) {
                            Text("Löschen")
                        }
                    }
                }
            }
    }
    if (message.isNotBlank())
        JournalCard(tones.movement, tones.onMovement) {
            Text(message)
            if (undo != null)
                TextButton({
                    update(undo!!)
                    undo = null
                    message = "Rückgängig gemacht."
                }) {
                    Text("Rückgängig")
                }
        }
}

@Composable
private fun CaffeineCard(data: JSONObject, change: (JSONObject, String) -> Unit) {
    val tones = LocalTones.current
    var name by remember { mutableStateOf("Kaffee") }
    var amount by remember { mutableStateOf("200") }
    var caffeine by remember { mutableStateOf("80") }
    JournalCard(tones.trend, tones.onTrend) {
        Text("Koffein bewusst eintragen", style = MaterialTheme.typography.titleLarge)
        Text(
            "Kein Trinkziel und kein persönliches Restbudget. Schon 100 mg können den Schlaf beeinflussen. Unruhe und Herzklopfen sind mögliche Wirkungen."
        )
        OutlinedTextField(
            name,
            { name = it },
            label = { Text("Getränk") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            amount,
            { amount = it },
            label = { Text("Milliliter") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            caffeine,
            { caffeine = it },
            label = { Text("Koffein gesamt in mg · laut Etikett") },
            modifier = Modifier.fillMaxWidth(),
        )
        val ml = amount.toIntOrNull()
        val mg = caffeine.toDoubleOrNull()
        Button(
            {
                val next = JSONObject(data.toString())
                next
                    .getJSONArray("drinks")
                    .put(
                        JSONObject()
                            .put("id", UUID.randomUUID().toString())
                            .put("kind", "caffeine")
                            .put("ml", ml)
                            .put("caffeineMg", mg)
                            .put("day", LocalDate.now().toString())
                            .put("at", Instant.now().toString())
                            .put("name", name.take(100))
                    )
                change(next, "Getränk eingetragen.")
            },
            enabled = ml != null && ml in 1..5000 && mg != null && mg in 0.0..1000.0,
        ) {
            Text("Getränk bestätigen")
        }
        Text(
            "EFSA: allgemeine Orientierung für gesunde Erwachsene 200 mg einzeln / 400 mg pro Tag. Schwangerschaft und Stillzeit: 200 mg pro Tag. Keine individuelle Freigabe.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
internal fun WellnessPrivacy(data: JSONObject, update: (JSONObject) -> Unit) {
    val context = LocalContext.current
    val export =
        rememberLauncherForActivityResult(
            ActivityResultContracts.CreateDocument("application/json")
        ) { uri ->
            if (uri != null)
                context.contentResolver.openOutputStream(uri)?.use {
                    it.write(data.toString(2).toByteArray())
                }
        }
    var confirm by remember { mutableStateOf(false) }
    AppearancePicker()
    JournalCard {
        Text("Speicher & Datenschutz", style = MaterialTheme.typography.titleLarge)
        Text(
            "Gesundheitsdaten sind mit einem Geräteschlüssel verschlüsselt und nicht Teil der Küchensicherung. Keine Werbung oder Tracking-Cookies. Health Connect liest nur ausdrücklich freigegebene Daten."
        )
        Button({ export.launch("zuerst-journal.json") }) { Text("Journal exportieren") }
        TextButton({
            update(
                JSONObject(data.toString())
                    .put("profile", JSONObject.NULL)
                    .put("food", JSONArray())
                    .put("drinks", JSONArray())
            )
        }) {
            Text("Gesundheitsfreigabe widerrufen & löschen")
        }
        Row {
            Checkbox(confirm, { confirm = it })
            Text("Auch Rezeptimporte und das gesamte Journal löschen", Modifier.weight(1f))
        }
        TextButton(
            {
                update(WellnessStore.empty())
                confirm = false
            },
            enabled = confirm,
        ) {
            Text("Journal vollständig löschen")
        }
        Text(
            "Zuerst · von Vora, Studio-Arbeitsname im Projekt Odkaz Labs. Kontakt: myriajr@gmx.net. Anbieterfreigabe für Live-Käufe ausstehend."
        )
        TextButton({
            context.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("https://zuerst.vercel.app/datenschutz/"))
            )
        }) {
            Text("Datenschutz & Nutzung")
        }
    }
}
