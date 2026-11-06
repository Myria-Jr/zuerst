package labs.odkaz.zuerst

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.util.UUID
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

internal fun mealSuggestions(
    catalog: Catalog,
    stock: List<String>,
    days: Int,
    vegetarian: Boolean,
    fast: Boolean,
): List<Recipe> {
    require(days in 1..28)
    val candidates =
        catalog.recipes.filter {
            (!vegetarian || it.items.none { it.id == "tuna" }) && (!fast || it.minutes <= 10)
        }
    val used = mutableMapOf<String, Int>()
    return (0 until days).map {
        val next =
            candidates
                .sortedWith(
                    compareBy<Recipe> { used[it.id] ?: 0 }
                        .thenByDescending { it.items.count { it.id in stock } }
                        .thenBy { it.minutes }
                        .thenBy { it.id }
                )
                .first()
        used[next.id] = (used[next.id] ?: 0) + 1
        next
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ComfortScreen(
    catalog: Catalog,
    data: JSONObject,
    update: (JSONObject) -> Unit,
    journal: Journal,
    updateKitchen: (Journal) -> Unit,
    planning: Boolean,
) {
    val context = LocalContext.current
    val cloud = remember { Cloud(context) }
    val foods = remember { WellnessStore(context).foods }
    val scope = rememberCoroutineScope()
    val tones = LocalTones.current
    var plus by remember { mutableStateOf(false) }
    var checked by remember { mutableStateOf(false) }
    var period by remember { mutableIntStateOf(7) }
    var weeks by remember { mutableIntStateOf(1) }
    var veggie by remember { mutableStateOf(false) }
    var fast by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf<List<Recipe>>(emptyList()) }
    var name by remember { mutableStateOf("Mein Wochenplan") }
    var message by remember { mutableStateOf("") }
    fun refresh() {
        scope.launch {
            plus = runCatching { cloud.plus() }.getOrDefault(false)
            checked = true
        }
    }
    LaunchedEffect(Unit) { refresh() }
    JournalTitle(if (planning) "Automatisch planen" else "Dein Rhythmus")
    if (plus) Text("Plus-Zugang serverseitig bestätigt. Sandbox-Zugänge gelten nur im Testmodus.")
    if (!plus)
        JournalCard(tones.trend, tones.onTrend) {
            Text(
                if (checked) "Plus-Vorschau" else "Zugang wird geprüft",
                style = MaterialTheme.typography.titleLarge,
            )
            Text(
                "1 € monatlich · 5 € jährlich · 10 € einmalig. Alle Varianten bieten 30/90-Tage-Vergleiche, automatische Pläne, Vorlagen und gemeinsamen Einkauf. Grundfunktionen bleiben gratis."
            )
            Text(
                "Native Käufe sind noch nicht erhältlich. Ein vorhandener Zugang wird über dein im Profil angemeldetes Konto geprüft."
            )
            TextButton({ refresh() }) { Text("Zugang erneut prüfen") }
        }
    if (!planning) {
        JournalCard(tones.trend, tones.onTrend) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                listOf(7, 30, 90).forEach { days ->
                    ZuerstFilter("$days Tage${if(days>7)" · Plus" else ""}", period == days) {
                        if (days == 7 || plus) period = days
                        else message = "Dafür ist ein bestätigter Plus-Zugang erforderlich."
                    }
                }
            }
            val all = data.getJSONArray("food").objects()
            val current = all.count {
                it.optString("day") >= LocalDate.now().minusDays(period.toLong() - 1).toString()
            }
            Text(
                "$current Essenseinträge in $period Tagen",
                style = MaterialTheme.typography.titleLarge,
            )
            if (period > 7) {
                val end = LocalDate.now().minusDays(period.toLong()).toString()
                val start = LocalDate.now().minusDays(period * 2L - 1).toString()
                Text(
                    "Vorheriger Zeitraum: ${all.count{it.optString("day") in start..end}} Einträge"
                )
            }
            Text("Fehlende Einträge sind unbekannt, keine Aussage darüber, was du gegessen hast.")
        }
        JournalCard {
            Text("Alle Einträge bleiben lesbar", style = MaterialTheme.typography.titleLarge)
            data.getJSONArray("food").objects().reversed().forEach { e ->
                Text(
                    "${e.optString("day")} · ${foods.find{it.id==e.optString("foodId")}?.name?:e.optString("foodId")} · ${e.optDouble("grams")} g"
                )
            }
        }
    } else {
        JournalCard(tones.kitchen, tones.onKitchen) {
            Text("Ein Plan aus deinem Vorrat", style = MaterialTheme.typography.titleLarge)
            Text("Ein Gericht für zwei Portionen pro Tag. Prüfe den Vorschlag vor dem Übernehmen.")
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                (1..4).forEach { w -> ZuerstFilter("$w Wochen", weeks == w) { weeks = w } }
            }
            Row {
                Checkbox(veggie, { veggie = it })
                Text("Vegetarisch")
            }
            Row {
                Checkbox(fast, { fast = it })
                Text("Höchstens 10 Minuten")
            }
            Button({
                if (plus) draft = mealSuggestions(catalog, journal.stock, weeks * 7, veggie, fast)
                else message = "Dafür ist ein bestätigter Plus-Zugang erforderlich."
            }) {
                Text("Plan vorschlagen${if(plus)"" else " · Plus"}")
            }
        }
        if (draft.isNotEmpty())
            JournalCard {
                Text("Dein Vorschlag", style = MaterialTheme.typography.titleLarge)
                draft.forEachIndexed { i, r ->
                    Text("${LocalDate.now().plusDays(i.toLong())} · ${r.name}")
                }
                Text("Vorhandene Planungen für diese Tage werden ersetzt.")
                Button(
                    {
                        if (plus) {
                            val dates = draft.indices.map { LocalDate.now().plusDays(it.toLong()) }
                            updateKitchen(
                                journal.copy(
                                    plans =
                                        journal.plans.filter { it.day !in dates } +
                                            draft.mapIndexed { i, r -> MealPlan(dates[i], r.id) },
                                    shopping =
                                        (journal.shopping +
                                                draft.flatMap { r ->
                                                    r.items
                                                        .map { it.id }
                                                        .filter { it !in journal.stock }
                                                })
                                            .distinct(),
                                )
                            )
                            draft = emptyList()
                            message = "Plan & Einkauf übernommen."
                        }
                    },
                    enabled = plus,
                ) {
                    Text("Plan & Einkauf übernehmen")
                }
                OutlinedTextField(
                    name,
                    { name = it.take(60) },
                    label = { Text("Name der Vorlage") },
                    modifier = Modifier.fillMaxWidth(),
                )
                TextButton(
                    {
                        val next = JSONObject(data.toString())
                        val templates = next.optJSONArray("templates") ?: JSONArray()
                        templates.put(
                            JSONObject()
                                .put("id", UUID.randomUUID().toString())
                                .put("name", name)
                                .put("recipeIds", JSONArray(draft.map { it.id }))
                        )
                        next.put("templates", templates)
                        update(next)
                        message = "Vorlage gespeichert."
                    },
                    enabled = plus && name.isNotBlank(),
                ) {
                    Text("Als Vorlage merken")
                }
            }
        data.optJSONArray("templates")?.objects().orEmpty().forEach { template ->
            JournalCard {
                Text(template.optString("name"))
                TextButton({
                    if (plus) {
                        val ids = template.getJSONArray("recipeIds")
                        draft =
                            (0 until ids.length()).mapNotNull { i ->
                                catalog.recipes.find { it.id == ids.getString(i) }
                            }
                    } else message = "Plus-Zugang erforderlich."
                }) {
                    Text("Vorlage verwenden")
                }
            }
        }
    }
    if (message.isNotBlank()) Text(message)
}
