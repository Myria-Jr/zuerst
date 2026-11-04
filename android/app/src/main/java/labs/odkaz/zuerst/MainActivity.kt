package labs.odkaz.zuerst

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.tooling.preview.Preview

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val catalog = assets.open("catalog.json").bufferedReader().use { Catalog(it.readText()) }
        setContent { ZuerstTheme { Kitchen(catalog) } }
    }
}

private val Light = lightColorScheme(
    primary = Color(0xFF536630), onPrimary = Color.White, primaryContainer = Color(0xFFDCE99D), onPrimaryContainer = Color(0xFF232D0A),
    secondaryContainer = Color(0xFFEBDDEB), onSecondaryContainer = Color(0xFF33223A), surface = Color(0xFFF7F3E9),
    onSurface = Color(0xFF302338), onSurfaceVariant = Color(0xFF544A56), surfaceContainer = Color(0xFFF1EAE2),
    surfaceContainerLow = Color(0xFFFFFBF2), surfaceContainerHigh = Color(0xFFEDE4DD), outline = Color(0xFF7E707C),
)
private val Dark = darkColorScheme(
    primary = Color(0xFFC6D982), onPrimary = Color(0xFF283514), primaryContainer = Color(0xFF39491F), onPrimaryContainer = Color(0xFFEEF9C8),
    secondaryContainer = Color(0xFF49364C), onSecondaryContainer = Color(0xFFF2DFF1), surface = Color(0xFF1A151C),
    onSurface = Color(0xFFF3E8EF), onSurfaceVariant = Color(0xFFD5C7D4), surfaceContainer = Color(0xFF2A222B),
    surfaceContainerLow = Color(0xFF241D26), surfaceContainerHigh = Color(0xFF352B35), outline = Color(0xFFA998A8),
)

@Composable
private fun ZuerstTheme(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val dark = isSystemInDarkTheme()
    val colors = when {
        Build.VERSION.SDK_INT >= 31 && dark -> dynamicDarkColorScheme(context)
        Build.VERSION.SDK_INT >= 31 -> dynamicLightColorScheme(context)
        dark -> Dark
        else -> Light
    }
    MaterialTheme(colorScheme = colors, content = content)
}

private enum class Stage { Pick, Confirm, Result, Cook }
private data class Action(val title: String, val icon: ImageVector, val perform: () -> Unit)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Kitchen(catalog: Catalog) {
    var step by rememberSaveable { mutableIntStateOf(0) }
    var picked by rememberSaveable { mutableStateOf(arrayListOf<String>()) }
    var confirmed by rememberSaveable { mutableStateOf(arrayListOf<String>()) }
    var idea by rememberSaveable { mutableIntStateOf(0) }
    var query by rememberSaveable { mutableStateOf("") }
    var about by rememberSaveable { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val stage = Stage.entries[step]
    val matches = catalog.matches(picked, confirmed)
    val suggestion = matches.complete.takeIf { it.isNotEmpty() }?.let { it[idea % it.size] }
    val almost = matches.almost
    fun go(stage: Stage) { focus.clearFocus(); query = ""; step = stage.ordinal }
    fun back() { if (step > 0) go(Stage.entries[step - 1]) }
    fun togglePick(id: String) {
        if (id in picked) {
            picked = ArrayList(picked - id)
            confirmed = ArrayList(confirmed - id)
        } else if (picked.size < 3) {
            picked = ArrayList(picked + id)
            if (query.isNotBlank()) { query = ""; focus.clearFocus() }
        }
        idea = 0
    }
    fun toggleConfirm(id: String) {
        confirmed = ArrayList(if (id in confirmed) confirmed - id else confirmed + id)
        idea = 0
    }
    BackHandler(enabled = step > 0) { back() }
    val action = when (stage) {
        Stage.Pick -> if (picked.isEmpty()) null else Action("Zutaten prüfen", Icons.AutoMirrored.Filled.ArrowForward) { go(Stage.Confirm) }
        Stage.Confirm -> Action("Gericht finden", Icons.AutoMirrored.Filled.ArrowForward) { go(Stage.Result) }
        Stage.Result -> when {
            suggestion != null -> Action("Jetzt kochen", Icons.AutoMirrored.Filled.ArrowForward) { go(Stage.Cook) }
            almost != null -> Action("Zutat bestätigen", Icons.Default.Check) { toggleConfirm(almost.missing.single()) }
            else -> Action("Auswahl ändern", Icons.AutoMirrored.Filled.ArrowForward) { go(Stage.Pick) }
        }
        Stage.Cook -> null
    }

    Scaffold(
        modifier = Modifier.imePadding(),
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        Image(painterResource(R.drawable.zuerst_mark), null, Modifier.size(33.dp))
                        Text("Zuerst.", fontWeight = FontWeight.Black)
                    }
                },
                navigationIcon = { if (step > 0) IconButton(::back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zurück") } },
                actions = { IconButton({ about = true }) { Icon(Icons.Default.Info, "Über Zuerst") } },
            )
        },
        floatingActionButton = {
            action?.let { ExtendedFloatingActionButton(text = { Text(it.title) }, icon = { Icon(it.icon, null) }, onClick = it.perform) }
        },
    ) { insets ->
        Box(Modifier.fillMaxSize().padding(insets), contentAlignment = Alignment.TopCenter) {
            key(stage) {
                Column(
                    Modifier.widthIn(max = 680.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    if (stage != Stage.Pick) Progress(stage)
                    when (stage) {
                        Stage.Pick -> Pick(catalog, picked, query, { query = it }, ::togglePick)
                        Stage.Confirm -> Confirm(catalog, picked, confirmed, ::toggleConfirm)
                        Stage.Result -> when {
                            suggestion != null -> Recommendation(catalog, suggestion, if (matches.complete.size > 1) ({ idea = (idea + 1) % matches.complete.size }) else null)
                            almost != null -> Feedback("Eine Zutat fehlt noch.", "Hast du ${catalog.name(almost.missing.single())} da? Dann kannst du ${almost.recipe.name} in ${almost.recipe.minutes} Min. machen.") { go(Stage.Pick) }
                            else -> Feedback("Noch kein passendes Gericht.", "Zuerst findet mit ${catalog.name(picked.first())} und den bestätigten Zutaten kein Rezept. Ändere deine Auswahl oder ergänze, was noch da ist.")
                        }
                        Stage.Cook -> suggestion?.let { Cooking(catalog, it.recipe) }
                    }
                    Spacer(Modifier.height(if (action != null) 96.dp else 20.dp))
                }
            }
        }
    }
    if (about) AlertDialog(
        onDismissRequest = { about = false },
        title = { Text("Über Zuerst") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("${catalog.recipes.size} schnelle Rezepte für Zutaten, die du aufbrauchen möchtest. Deine Auswahl und alle Rezepte bleiben auf diesem Gerät.")
            Text("Eine Marke von Odkaz Labs.", style = MaterialTheme.typography.bodySmall)
        } },
        confirmButton = { TextButton({ about = false }) { Text("Schließen") } },
    )
}

@Composable
private fun Progress(stage: Stage) {
    val step = stage.ordinal.coerceAtMost(2)
    val labels = listOf("Auswählen", "Bestätigen", "Kochen")
    Text("${step + 1} / 3  ·  ${labels[step]}", Modifier.padding(horizontal = 4.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
}

@Composable
private fun Panel(tinted: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val scheme = MaterialTheme.colorScheme
    Card(
        modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (tinted) scheme.primaryContainer else scheme.surfaceContainerLow,
            contentColor = if (tinted) scheme.onPrimaryContainer else scheme.onSurface,
        ),
    ) {
        Column(Modifier.padding(19.dp), verticalArrangement = Arrangement.spacedBy(11.dp), content = content)
    }
}

@Composable
private fun Heading(title: String, large: Boolean = false) {
    Text(title, Modifier.semantics { heading() }, style = if (large) MaterialTheme.typography.headlineLarge else MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Pick(catalog: Catalog, picked: List<String>, query: String, setQuery: (String) -> Unit, toggle: (String) -> Unit) {
    val searching = query.isNotBlank()
    val options = if (searching) catalog.search(query) else catalog.quick
    Hero()
    Panel {
        Heading("Deine Zutaten")
        OutlinedTextField(
            value = query, onValueChange = setQuery, modifier = Modifier.fillMaxWidth(), singleLine = true,
            shape = RoundedCornerShape(21.dp), label = { Text("Zutat suchen") },
            leadingIcon = { Icon(Icons.Default.Search, null) },
            trailingIcon = { if (searching) IconButton({ setQuery("") }) { Icon(Icons.Default.Close, "Suche leeren") } },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { if (searching && picked.size < 3) options.firstOrNull { it !in picked }?.let(toggle) }),
        )
        Text(if (searching) "${options.size} Treffer" else "Schnellwahl", style = MaterialTheme.typography.labelLarge)
        if (options.isEmpty()) Text("Diese Zutat ist noch nicht im Katalog. Versuch es mit einem anderen Begriff.")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            options.forEach { id ->
                FilterChip(selected = id in picked, onClick = { toggle(id) }, label = { Text(catalog.name(id)) },
                    modifier = Modifier.heightIn(min = 48.dp), enabled = picked.size < 3 || id in picked,
                    shape = RoundedCornerShape(24.dp), leadingIcon = if (id in picked) ({ Icon(Icons.Default.Check, null, Modifier.size(18.dp)) }) else null)
            }
        }
    }
    Panel {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Ausgewählt", fontWeight = FontWeight.SemiBold)
            Badge("${picked.size} / 3")
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            picked.forEachIndexed { index, id ->
                FilterChip(true, { toggle(id) }, label = { Text(if (index == 0) "1 · ${catalog.name(id)}" else catalog.name(id)) },
                    modifier = Modifier.heightIn(min = 48.dp), shape = RoundedCornerShape(24.dp),
                    trailingIcon = { Icon(Icons.Default.Close, "Entfernen", Modifier.size(17.dp)) })
            }
        }
        Text(if (picked.size == 3) "Drei Zutaten ausgewählt." else "Eine reicht. Zwei weitere sind optional.", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun Hero() {
    Panel(tinted = true) {
        Heading("Was möchtest du aufbrauchen?", large = true)
        Text("Ein Gericht aus deinen Zutaten. In höchstens 20 Minuten.", style = MaterialTheme.typography.bodyLarge)
        Image(painterResource(R.drawable.kitchen), null, Modifier.fillMaxWidth().height(132.dp), contentScale = ContentScale.Fit)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Summary(catalog: Catalog, title: String, ids: List<String>) {
    Text(title, style = MaterialTheme.typography.labelLarge)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        ids.forEach { Badge(catalog.name(it)) }
    }
}

@Composable
private fun Badge(text: String) {
    Surface(shape = RoundedCornerShape(40.dp), color = MaterialTheme.colorScheme.secondaryContainer, contentColor = MaterialTheme.colorScheme.onSecondaryContainer) {
        Text(text, Modifier.padding(horizontal = 11.dp, vertical = 5.dp), style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
private fun Confirm(catalog: Catalog, picked: List<String>, confirmed: List<String>, toggle: (String) -> Unit) {
    Panel(tinted = true) {
        Heading("Was hast du noch da?", large = true)
        Text("Bestätige nur, was du wirklich zur Hand hast.")
        Summary(catalog, "Aufbrauchen", picked)
    }
    val choices = catalog.choices(picked)
    if (choices.isEmpty()) Panel { Text("Für deine Auswahl gibt es keine weiteren Zutaten zu prüfen.") }
    choices.forEach { id ->
        val checked = id in confirmed
        Surface(shape = RoundedCornerShape(21.dp), color = if (checked) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainer,
            contentColor = if (checked) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface) {
            Row(Modifier.fillMaxWidth().heightIn(min = 61.dp).toggleable(checked, role = Role.Checkbox, onValueChange = { toggle(id) }).padding(horizontal = 16.dp, vertical = 9.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(catalog.name(id), style = MaterialTheme.typography.titleMedium)
                    if (id in catalog.pantry) Text("Grundzutat", style = MaterialTheme.typography.bodySmall)
                }
                Checkbox(checked, onCheckedChange = null)
            }
        }
    }
}

@Composable
private fun Recommendation(catalog: Catalog, candidate: Candidate, next: (() -> Unit)?) {
    Panel(tinted = true) {
        Text("Deine Empfehlung", style = MaterialTheme.typography.labelLarge)
        Heading(candidate.recipe.name, large = true)
        Text(candidate.recipe.note)
        Badge("${candidate.recipe.minutes} Min.")
        Summary(catalog, "Du verbrauchst", candidate.used)
    }
    next?.let { TextButton(onClick = it) { Icon(Icons.Default.Refresh, null, Modifier.size(18.dp)); Text("Andere Idee", Modifier.padding(start = 8.dp)) } }
}

@Composable
private fun Feedback(title: String, text: String, change: (() -> Unit)? = null) {
    Panel {
        Heading(title, large = true)
        Text(text, style = MaterialTheme.typography.bodyLarge)
        change?.let { TextButton(onClick = it) { Text("Auswahl ändern") } }
    }
}

@Composable
private fun Cooking(catalog: Catalog, recipe: Recipe) {
    Panel(tinted = true) {
        Heading(recipe.name, large = true)
        Badge("${recipe.minutes} Min.  ·  2 Portionen")
    }
    Panel {
        Heading("Zutaten")
        Text("Mengen für 2 Portionen", style = MaterialTheme.typography.bodyMedium)
        recipe.items.forEachIndexed { index, item ->
            if (index > 0) HorizontalDivider()
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(13.dp)) {
                Text(catalog.name(item.id), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                Text(item.amount, Modifier.weight(1f), textAlign = TextAlign.End)
            }
        }
    }
    Panel {
        Heading("So geht’s")
        recipe.steps.forEachIndexed { index, step ->
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.Top) {
                Badge("${index + 1}")
                Text(step, Modifier.weight(1f).padding(top = 3.dp), style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun HeroPreview() { ZuerstTheme { Hero() } }
