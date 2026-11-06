package labs.odkaz.zuerst

import android.content.Intent
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import java.time.Instant
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

@Composable
internal fun SocialRecipes(
    catalog: Catalog,
    data: JSONObject,
    update: (JSONObject) -> Unit,
    journal: Journal,
    updateKitchen: (Journal) -> Unit,
) {
    val context = LocalContext.current
    val incoming = remember {
        (context as? ComponentActivity)?.intent?.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
    }
    var url by remember { mutableStateOf(Regex("https://\\S+").find(incoming)?.value.orEmpty()) }
    var title by remember { mutableStateOf("") }
    var ingredients by remember { mutableStateOf("") }
    var steps by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    val tones = LocalTones.current
    JournalCard(tones.kitchen, tones.onKitchen) {
        Text("Aus deinem Feed in deine Küche", style = MaterialTheme.typography.titleLarge)
        Text(
            "Link und von dir übernommenen Text einfügen. Kein automatischer Videoabruf. Alle Zuordnungen bleiben unbekannt, bis du sie prüfst."
        )
        OutlinedTextField(
            title,
            { title = it.take(100) },
            label = { Text("Rezeptname") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            url,
            { url = it.take(2000) },
            label = { Text("Instagram- oder TikTok-Link") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            ingredients,
            { ingredients = it.take(6400) },
            label = { Text("Zutaten · eine pro Zeile") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            steps,
            { steps = it.take(20000) },
            label = { Text("Schritte · einer pro Zeile") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )
        Button({
            val uri = Uri.parse(url)
            val host = uri.host.orEmpty().lowercase()
            if (
                uri.scheme != "https" ||
                    host !in
                        setOf(
                            "instagram.com",
                            "www.instagram.com",
                            "tiktok.com",
                            "www.tiktok.com",
                            "vm.tiktok.com",
                            "vt.tiktok.com",
                        )
            )
                message = "Bitte einen gültigen Social-Link einfügen."
            else {
                val names = ingredients.lines().filter { it.isNotBlank() }.take(40)
                val instructions = steps.lines().filter { it.isNotBlank() }.take(25)
                if (names.isNotEmpty() && instructions.isNotEmpty() && title.isNotBlank()) {
                    val next = JSONObject(data.toString())
                    next
                        .getJSONArray("imports")
                        .put(
                            JSONObject()
                                .put("id", UUID.randomUUID().toString())
                                .put("title", title)
                                .put("url", url)
                                .put("mode", "comfort")
                                .put(
                                    "ingredients",
                                    JSONArray(
                                        names.map {
                                            JSONObject()
                                                .put("name", it.take(160))
                                                .put("ingredientId", JSONObject.NULL)
                                        }
                                    ),
                                )
                                .put("steps", JSONArray(instructions))
                                .put("savedAt", Instant.now().toString())
                        )
                    update(next)
                    title = ""
                    ingredients = ""
                    steps = ""
                    message = "Rezept gespeichert. Zutaten prüfen."
                }
            }
        }) {
            Text("Geprüften Text speichern")
        }
    }
    data.optJSONArray("imports")?.objects().orEmpty().forEach { recipe ->
        val items = recipe.getJSONArray("ingredients").objects()
        JournalCard {
            Text(recipe.getString("title"), style = MaterialTheme.typography.titleLarge)
            Text(
                "${items.count{it.optString("ingredientId") in journal.stock}} von ${items.size} Zutaten vorhanden. Mengen selbst prüfen."
            )
            items.forEachIndexed { i, item ->
                Text(item.getString("name"))
                var expanded by remember { mutableStateOf(false) }
                Box {
                    OutlinedButton({ expanded = true }, Modifier.fillMaxWidth()) {
                        Text(
                            item
                                .optString("ingredientId")
                                .takeIf { id -> catalog.ingredients.any { it.id == id } }
                                ?.let { catalog.name(it) } ?: "Unbekannt · zuordnen"
                        )
                    }
                    DropdownMenu(expanded, { expanded = false }) {
                        DropdownMenuItem(
                            text = { Text("Unbekannt") },
                            onClick = {
                                val next = JSONObject(data.toString())
                                next
                                    .getJSONArray("imports")
                                    .objects()
                                    .find { it.getString("id") == recipe.getString("id") }!!
                                    .getJSONArray("ingredients")
                                    .getJSONObject(i)
                                    .put("ingredientId", JSONObject.NULL)
                                update(next)
                                expanded = false
                            },
                        )
                        catalog.ingredients.forEach { ingredient ->
                            DropdownMenuItem(
                                text = { Text(ingredient.name) },
                                onClick = {
                                    val next = JSONObject(data.toString())
                                    next
                                        .getJSONArray("imports")
                                        .objects()
                                        .find { it.getString("id") == recipe.getString("id") }!!
                                        .getJSONArray("ingredients")
                                        .getJSONObject(i)
                                        .put("ingredientId", ingredient.id)
                                    update(next)
                                    expanded = false
                                },
                            )
                        }
                    }
                }
            }
            val instructions = recipe.getJSONArray("steps")
            (0 until instructions.length()).forEach {
                Text("${it+1}. ${instructions.getString(it)}")
            }
            FilledTonalButton({
                val known =
                    items
                        .map { it.optString("ingredientId") }
                        .filter { id ->
                            catalog.ingredients.any { it.id == id } && id !in journal.stock
                        }
                updateKitchen(journal.copy(shopping = (journal.shopping + known).distinct()))
                val unknown =
                    items
                        .filter {
                            it.optString("ingredientId").isBlank() || it.isNull("ingredientId")
                        }
                        .map { it.getString("name") }
                val next = JSONObject(data.toString())
                val old = next.optJSONArray("shoppingText") ?: JSONArray()
                val all = (0 until old.length()).map { old.getString(it) } + unknown
                next.put("shoppingText", JSONArray(all.distinct()))
                update(next)
                message = "Fehlendes zum Einkauf ergänzt."
            }) {
                Text("Fehlendes zum Einkauf")
            }
            TextButton({
                val next = JSONObject(data.toString())
                next.put(
                    "imports",
                    JSONArray(
                        next.getJSONArray("imports").objects().filter {
                            it.getString("id") != recipe.getString("id")
                        }
                    ),
                )
                update(next)
            }) {
                Text("Rezept löschen")
            }
        }
    }
    if (message.isNotBlank()) Text(message)
}
