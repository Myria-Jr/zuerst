package labs.odkaz.zuerst

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

private val shortDate = DateTimeFormatter.ofPattern("EEE, d. MMM", Locale.GERMAN)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun RecipeLibrary(catalog: Catalog, journal: Journal, open: (Recipe) -> Unit, favorite: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableIntStateOf(0) }
    JournalTitle("Rezepte")
    Text("24 Ideen. Zwei Portionen. Höchstens 20 Minuten.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), label = { Text("Gericht oder Zutat suchen") }, leadingIcon = { Icon(Icons.Default.Search, null) }, singleLine = true)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        listOf("Alle", "Gemerkt", "Aus Vorrat", "Vegetarisch", "Bis 10 Min.").forEachIndexed { index, title -> ZuerstFilter(title,filter == index) { filter = index } }
    }
    val found = catalog.recipes.filter { recipe ->
        (query.isBlank() || recipe.name.contains(query.trim(), true) || recipe.items.any { catalog.name(it.id).contains(query.trim(), true) }) &&
            when (filter) { 1 -> recipe.id in journal.favorites; 2 -> journal.missing(recipe).isEmpty(); 3 -> recipe.items.none { it.id == "tuna" }; 4 -> recipe.minutes <= 10; else -> true }
    }
    JournalCard {
        Text("${found.size} Rezepte", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        found.forEach { recipe -> RecipeRow(recipe, journal, { open(recipe) }, { favorite(recipe.id) }) }
        if (found.isEmpty()) Text(if (filter == 1) "Tippe bei einem Rezept auf das Herz, um es hier zu merken." else "Kein passendes Rezept. Ändere die Suche oder den Filter.")
    }
}

@Composable
internal fun RecipeRow(recipe: Recipe, journal: Journal, open: () -> Unit, favorite: () -> Unit) {
    val missing = journal.missing(recipe).size
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        TextButton(open, Modifier.weight(1f).heightIn(min = 68.dp), shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)) {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(recipe.name, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurface)
                Text("${recipe.minutes} Min. · ${if (missing == 0) "Alles im Vorrat" else "$missing Zutaten fehlen"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        IconToggleButton(recipe.id in journal.favorites, { favorite() }) { Icon(if (recipe.id in journal.favorites) Icons.Default.Favorite else Icons.Default.FavoriteBorder, "${recipe.name} merken") }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun Planner(catalog: Catalog, journal: Journal, update: (Journal) -> Unit, open: (Recipe) -> Unit, select: (LocalDate) -> Unit) {
    var shopping by rememberSaveable { mutableStateOf(false) }
    var checked by remember { mutableStateOf(emptyList<String>()) }
    JournalTitle("Plan")
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
        listOf("Wochenplan", "Einkauf · ${journal.shopping.size}").forEachIndexed { index, title ->
            SegmentedButton(selected = shopping == (index == 1), onClick = { shopping = index == 1 }, shape = SegmentedButtonDefaults.itemShape(index, 2)) { Text(title) }
        }
    }
    if (shopping) {
        Text("Abhaken. Einkaufen. In den Vorrat übernehmen.")
        JournalCard {
            Text("Auf der Liste", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            IngredientLookup(catalog, journal.shopping) { update(journal.copy(shopping = journal.shopping + it)) }
            journal.shopping.forEach { id ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.weight(1f).heightIn(min = 54.dp).toggleable(id in checked, role = Role.Checkbox, onValueChange = { checked = if(it) checked + id else checked - id }), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(id in checked, null); Spacer(Modifier.width(8.dp)); Text(catalog.name(id))
                    }
                    IconButton({ update(journal.copy(shopping = journal.shopping - id)); checked = checked - id }) { Icon(Icons.Default.Close, "${catalog.name(id)} von Einkaufsliste entfernen") }
                }
            }
            if (journal.shopping.isEmpty()) Text("Deine Liste ist frei. Füge Zutaten hinzu oder übernimm fehlende Zutaten aus einem Rezept.")
        }
        if (checked.isNotEmpty()) Button({ update(journal.bought(checked)); checked = emptyList() }, Modifier.fillMaxWidth().heightIn(min = 50.dp)) { Text("Gekauftes übernehmen · ${checked.size}") }
    } else {
        Text("Deine nächsten sieben Tage, ganz entspannt.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        val days = (0..6).map { LocalDate.now().plusDays(it.toLong()) }
        days.forEach { day ->
            val recipe = catalog.recipes.find { r -> journal.plans.any { it.day == day && it.recipeId == r.id } }
            JournalCard {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(if(day == LocalDate.now()) "Heute" else day.format(shortDate), Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    if (recipe != null) IconButton({ update(journal.copy(plans = journal.plans.filterNot { it.day == day })) }) { Icon(Icons.Default.Close, "Plan für ${day.format(shortDate)} entfernen") }
                }
                if (recipe == null) TextButton({ select(day) }, Modifier.heightIn(min = 48.dp)) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(7.dp)); Text("Gericht auswählen") }
                else {
                    RecipeRow(recipe, journal, { open(recipe) }, { update(journal.favorite(recipe.id)) })
                    TextButton({ update(journal.buyMissing(recipe)); shopping = true }, Modifier.heightIn(min = 48.dp)) { Text("Fehlendes einkaufen") }
                }
            }
        }
        Button({ update(journal.plans.filter { it.day in days }.fold(journal) { state, plan -> catalog.recipes.find { it.id == plan.recipeId }?.let(state::buyMissing) ?: state }); shopping = true },
            Modifier.fillMaxWidth().heightIn(min = 50.dp), enabled = journal.plans.any { it.day in days }) { Text("Wocheneinkauf erstellen") }
        Text("Die Liste bündelt Zutaten. Die benötigten Mengen findest du in den Rezepten.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ExpiryDate(id: String, journal: Journal, change: (LocalDate?) -> Unit) {
    var show by remember { mutableStateOf(false) }
    TextButton({ show = true }, contentPadding = PaddingValues(0.dp), modifier = Modifier.heightIn(min = 44.dp)) { Text(journal.expiry[id]?.let { "Aufbrauchen bis ${it.format(shortDate)}" } ?: "Aufbrauchdatum ergänzen", style = MaterialTheme.typography.bodySmall) }
    if (show) {
        val state = rememberDatePickerState(journal.expiry[id]?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli())
        DatePickerDialog(onDismissRequest = { show = false }, confirmButton = { TextButton({ change(state.selectedDateMillis?.let { Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }); show = false }) { Text("Übernehmen") } },
            dismissButton = { TextButton({ change(null); show = false }) { Text("Datum entfernen") } }) { DatePicker(state) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun RecipePage(catalog: Catalog, recipe: Recipe, journal: Journal, initialDay: LocalDate, update: (Journal) -> Unit, onCooked: () -> Unit) {
    var cooking by rememberSaveable(recipe.id) { mutableStateOf(false) }
    var day by rememberSaveable(recipe.id) { mutableStateOf(initialDay.toString()) }
    var chooseDate by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf("") }
    JournalTitle(recipe.name)
    Text("${recipe.minutes} Min. · 2 Portionen", color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text(recipe.note)
    JournalCard {
        Text("Das brauchst du", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        recipe.items.forEach { amount -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(catalog.name(amount.id), Modifier.weight(1f)); if(amount.id in journal.stock) Icon(Icons.Default.Check, "Im Vorrat", Modifier.size(17.dp)); Text(amount.amount)
        } }
    }
    if (cooking) {
        JournalCard {
            Text("So geht’s", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            recipe.steps.forEachIndexed { index, step -> Row(horizontalArrangement = Arrangement.spacedBy(13.dp)) { Text("${index + 1}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold); Text(step, Modifier.weight(1f)) } }
        }
        Button(onCooked, Modifier.fillMaxWidth().heightIn(min = 50.dp)) { Text("Gekocht eintragen") }
    } else {
        val missing = journal.missing(recipe)
        if (missing.isEmpty()) Button({ cooking = true }, Modifier.fillMaxWidth().heightIn(min = 50.dp)) { Text("Jetzt kochen") }
        else {
            Text("Noch nicht im Vorrat: ${missing.joinToString { catalog.name(it) }}.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button({ update(journal.buyMissing(recipe)); notice = "Fehlende Zutaten ergänzt. Du findest sie unter Plan → Einkauf." }, Modifier.fillMaxWidth().heightIn(min = 50.dp)) { Text("Fehlendes auf die Liste") }
        }
        FilledTonalButton({ chooseDate = true }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Für ${LocalDate.parse(day).format(shortDate)} einplanen") }
        TextButton({ update(journal.favorite(recipe.id)) }, Modifier.heightIn(min = 48.dp)) { Icon(if(recipe.id in journal.favorites) Icons.Default.Favorite else Icons.Default.FavoriteBorder, null); Spacer(Modifier.width(7.dp)); Text(if(recipe.id in journal.favorites) "Gemerkt" else "Rezept merken") }
    }
    if (notice.isNotBlank()) Text(notice, color = MaterialTheme.colorScheme.primary)
    if (chooseDate) {
        val state = rememberDatePickerState(LocalDate.parse(day).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(), selectableDates = object : SelectableDates { override fun isSelectableDate(utcTimeMillis: Long) = Instant.ofEpochMilli(utcTimeMillis).atZone(ZoneOffset.UTC).toLocalDate() >= LocalDate.now() })
        DatePickerDialog(onDismissRequest = { chooseDate = false }, confirmButton = { TextButton({ state.selectedDateMillis?.let { selected -> val date = Instant.ofEpochMilli(selected).atZone(ZoneOffset.UTC).toLocalDate(); day = date.toString(); update(journal.plan(date, recipe)); notice = "Gericht eingeplant." }; chooseDate = false }) { Text("Einplanen") } },
            dismissButton = { TextButton({ chooseDate = false }) { Text("Abbrechen") } }) { DatePicker(state) }
    }
}
