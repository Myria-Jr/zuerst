package labs.odkaz.zuerst

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.haze
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private enum class JournalTab(val label: String) {
    Today("Heute"),
    Food("Essen"),
    Recipes("Rezepte"),
    Stock("Vorrat"),
    More("Mehr"),
    Plan("Plan"),
    History("Verlauf"),
}

private enum class JournalPage {
    Tabs,
    Receipt,
    Kitchen,
    Profile,
    Recipe,
    Social,
    Privacy,
    Plus,
    Health,
    Insights,
    Autoplan,
}

private val dateFormat = DateTimeFormatter.ofPattern("EEEE, d. MMMM", Locale.GERMAN)
private val weekdayFormat = DateTimeFormatter.ofPattern("EE", Locale.GERMAN)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun JournalScreen(catalog: Catalog) {
    val context = LocalContext.current
    val glass = remember { HazeState() }
    val expanded = LocalConfiguration.current.screenWidthDp >= 840
    val store = remember { JournalStore(context, catalog) }
    var journal by remember { mutableStateOf(store.load()) }
    val wellnessStore = remember { WellnessStore(context) }
    var wellnessError by remember { mutableStateOf(false) }
    var wellness by remember {
        mutableStateOf(
            try {
                wellnessStore.load()
            } catch (_: Exception) {
                wellnessError = true
                WellnessStore.empty()
            }
        )
    }
    fun updateWellness(value: org.json.JSONObject) {
        if (wellnessError) return
        try {
            wellnessStore.save(value)
            wellness = value
        } catch (_: Exception) {
            wellnessError = true
        }
    }
    var tab by rememberSaveable {
        mutableStateOf(
            if (
                (context as? androidx.activity.ComponentActivity)?.intent?.action ==
                    android.content.Intent.ACTION_SEND
            )
                JournalTab.More
            else JournalTab.Today
        )
    }
    var page by rememberSaveable {
        mutableStateOf(
            if (
                (context as? androidx.activity.ComponentActivity)?.intent?.action ==
                    android.content.Intent.ACTION_SEND
            )
                JournalPage.Social
            else if (
                (context as? androidx.activity.ComponentActivity)
                    ?.intent
                    ?.action
                    ?.contains("PERMISSION") == true
            )
                JournalPage.Privacy
            else JournalPage.Tabs
        )
    }
    var fromStock by rememberSaveable { mutableStateOf(false) }
    var recipeId by rememberSaveable { mutableStateOf<String?>(null) }
    var plannedDay by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var about by rememberSaveable { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    var notice by remember { mutableStateOf<String?>(null) }

    fun update(value: Journal) {
        journal = value
        store.save(value)
    }
    fun openKitchen(prefill: Boolean) {
        fromStock = prefill
        page = JournalPage.Kitchen
    }

    LaunchedEffect(notice, page) {
        if (page == JournalPage.Tabs)
            notice?.let {
                snackbar.showSnackbar(it)
                notice = null
            }
    }

    if (page == JournalPage.Kitchen) {
        val preset =
            if (fromStock)
                catalog
                    .ready(journal.stock)
                    .firstOrNull()
                    ?.items
                    .orEmpty()
                    .map(Amount::id)
                    .filterNot { it in catalog.pantry }
                    .take(3)
            else emptyList()
        Kitchen(
            catalog,
            preset,
            journal.stock,
            onClose = { page = JournalPage.Tabs },
            onCooked = { recipe ->
                if (page == JournalPage.Kitchen) {
                    update(journal.cooked(recipe))
                    tab = JournalTab.History
                    page = JournalPage.Tabs
                }
            },
        )
        return
    }

    BackHandler(enabled = page != JournalPage.Tabs || tab != JournalTab.Today) {
        if (page != JournalPage.Tabs) page = JournalPage.Tabs else tab = JournalTab.Today
    }
    Scaffold(
        modifier = Modifier.imePadding(),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (page) {
                            JournalPage.Receipt -> "Kassenbon"
                            JournalPage.Profile -> "Dein Zuerst"
                            JournalPage.Recipe -> "Rezept"
                            else -> "Zuerst."
                        },
                        fontWeight = FontWeight.Black,
                    )
                },
                navigationIcon = {
                    if (page != JournalPage.Tabs)
                        IconButton({ page = JournalPage.Tabs }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zurück")
                        }
                },
                actions = {
                    if (page == JournalPage.Tabs)
                        IconButton({ page = JournalPage.Profile }) {
                            Icon(Icons.Default.AccountCircle, "Profil und Sicherung")
                        }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            Box(
                Modifier.fillMaxSize()
                    .haze(glass)
                    .padding(start = if (expanded && page == JournalPage.Tabs) 112.dp else 0.dp),
                contentAlignment = Alignment.TopCenter,
            ) {
                key(page, tab) {
                    val entrance = remember { Animatable(0f) }
                    LaunchedEffect(Unit) { entrance.animateTo(1f, tween(200)) }
                    Column(
                        Modifier.graphicsLayer {
                                alpha = .85f + .15f * entrance.value
                                translationY = (1 - entrance.value) * 8.dp.toPx()
                            }
                            .widthIn(max = 640.dp)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 18.dp, vertical = 12.dp)
                            .padding(
                                bottom = if (page == JournalPage.Tabs && !expanded) 108.dp else 0.dp
                            ),
                        verticalArrangement = Arrangement.spacedBy(13.dp),
                    ) {
                        if (wellnessError)
                            Text(
                                "Gesundheitsjournal konnte nicht sicher gelesen oder gespeichert werden. Originaldaten bleiben erhalten."
                            )
                        if (page == JournalPage.Social)
                            SocialRecipes(catalog, wellness, ::updateWellness, journal, ::update)
                        else if (page == JournalPage.Insights || page == JournalPage.Autoplan)
                            ComfortScreen(
                                catalog,
                                wellness,
                                ::updateWellness,
                                journal,
                                ::update,
                                page == JournalPage.Autoplan,
                            )
                        else if (page == JournalPage.Privacy)
                            WellnessPrivacy(wellness, ::updateWellness)
                        else if (page == JournalPage.Health) {
                            if (wellness.journalEnabled()) HealthConnectCard()
                            else Text("Aktiviere zuerst freiwillig das Journal unter Essen.")
                        } else if (page == JournalPage.Plus) {
                            JournalTitle("Zuerst Plus")
                            JournalCard(LocalTones.current.trend, LocalTones.current.onTrend) {
                                Text(
                                    "Mehr Komfort. Gleiche Freiheit.",
                                    style = MaterialTheme.typography.titleLarge,
                                )
                                Text(
                                    "30/90-Tage-Vergleiche, automatische Planung bis zu vier Wochen, Vorlagen und gemeinsamer Einkauf. Grundlegende Gesundheits- und Küchenfunktionen bleiben gratis."
                                )
                                Text(
                                    "1 € / Monat · 5 € / Jahr · 10 € einmalig für die Produktlaufzeit. Alle Varianten bieten dieselben Plus-Funktionen. Keine kostenpflichtige Cloud-KI."
                                )
                                Text(
                                    "Plus-Vorschau · native Käufe noch nicht erhältlich. Unter 18 keine eigenen Käufe."
                                )
                            }
                        } else if (page == JournalPage.Profile) {
                            Profile(catalog, journal, ::update)
                        } else if (page == JournalPage.Recipe) {
                            catalog.recipes
                                .find { it.id == recipeId }
                                ?.let { recipe ->
                                    RecipePage(
                                        catalog,
                                        recipe,
                                        journal,
                                        LocalDate.parse(plannedDay),
                                        ::update,
                                        onCooked = {
                                            update(journal.cooked(recipe))
                                            tab = JournalTab.History
                                            page = JournalPage.Tabs
                                            notice = "Gericht eingetragen"
                                        },
                                    )
                                }
                        } else if (page == JournalPage.Receipt) {
                            ReceiptScreen(catalog) { ids ->
                                val count = ids.count { it !in journal.stock }
                                update(journal.addStock(ids))
                                tab = JournalTab.Stock
                                page = JournalPage.Tabs
                                notice =
                                    when (count) {
                                        0 -> "Schon im Vorrat"
                                        1 -> "Eine Zutat ergänzt"
                                        else -> "$count Zutaten ergänzt"
                                    }
                            }
                        } else
                            when (tab) {
                                JournalTab.Today -> {
                                    Today(
                                        catalog,
                                        journal,
                                        { openKitchen(it) },
                                        { page = JournalPage.Receipt },
                                        { tab = it },
                                        { recipeId=it.id;page=JournalPage.Recipe },
                                    ) {
                                        TodayHealth(wellnessStore,wellness,::updateWellness,{tab=JournalTab.Food},{page=JournalPage.Health})
                                    }
                                }
                                JournalTab.Food ->
                                    WellnessScreen(wellnessStore, wellness, ::updateWellness)
                                JournalTab.More -> {
                                    JournalTitle("Mehr")
                                    JournalCard(
                                        LocalTones.current.trend,
                                        LocalTones.current.onTrend,
                                    ) {
                                        FilledTonalButton({ tab = JournalTab.Plan }) {
                                            Text("Plan & Einkauf")
                                        }
                                        FilledTonalButton({ page = JournalPage.Autoplan }) {
                                            Text("Automatisch planen")
                                        }
                                        FilledTonalButton({ page = JournalPage.Insights }) {
                                            Text("Auswertungen")
                                        }
                                        FilledTonalButton({ tab = JournalTab.History }) {
                                            Text("Kochverlauf")
                                        }
                                        FilledTonalButton({ page = JournalPage.Health }) {
                                            Text("Gesundheitsdetails")
                                        }
                                        FilledTonalButton({ page = JournalPage.Social }) {
                                            Text("Rezept importieren")
                                        }
                                        FilledTonalButton({ page = JournalPage.Plus }) {
                                            Text("Zuerst Plus")
                                        }
                                        FilledTonalButton({ page = JournalPage.Privacy }) {
                                            Text("Darstellung & Datenschutz")
                                        }
                                    }
                                }
                                JournalTab.Recipes ->
                                    RecipeLibrary(
                                        catalog,
                                        journal,
                                        {
                                            recipeId = it.id
                                            page = JournalPage.Recipe
                                        },
                                        { update(journal.favorite(it)) },
                                        {page=JournalPage.Social},
                                    )
                                JournalTab.Stock ->
                                    Stock(
                                        catalog,
                                        journal,
                                        { page = JournalPage.Receipt },
                                        { update(journal.addStock(listOf(it))) },
                                        { update(journal.removeStock(it)) },
                                        ::update,
                                    )
                                JournalTab.Plan -> {
                                    Planner(
                                        catalog,
                                        journal,
                                        ::update,
                                        {
                                            recipeId = it.id
                                            page = JournalPage.Recipe
                                        },
                                        { day ->
                                            plannedDay = day.toString()
                                            tab = JournalTab.Recipes
                                        },
                                    )
                                    wellness.optJSONArray("shoppingText")?.let { list ->
                                        if (list.length() > 0)
                                            JournalCard {
                                                Text("Eigene Einkaufszutaten")
                                                (0 until list.length()).forEach { i ->
                                                    TextButton({
                                                        val next =
                                                            org.json.JSONObject(wellness.toString())
                                                        val remaining =
                                                            (0 until list.length())
                                                                .filter { it != i }
                                                                .map { list.getString(it) }
                                                        next.put(
                                                            "shoppingText",
                                                            org.json.JSONArray(remaining),
                                                        )
                                                        updateWellness(next)
                                                    }) {
                                                        Text("Erledigt: ${list.getString(i)}")
                                                    }
                                                }
                                            }
                                    }
                                }
                                JournalTab.History ->
                                    History(catalog, journal) { update(journal.removeMeal(it)) }
                            }
                        Spacer(Modifier.height(6.dp))
                    }
                }
            }
            if (page == JournalPage.Tabs) {
                val icons =
                    listOf(
                        Icons.Default.Home,
                        Icons.Default.Add,
                        Icons.AutoMirrored.Filled.List,
                        Icons.Default.ShoppingCart,
                        Icons.Default.Info,
                    )
                GlassNavigation(
                    JournalTab.entries.take(5).map {
                        NavigationDestination(it.label, icons[it.ordinal])
                    },
                    if (tab.ordinal > 4) 4 else tab.ordinal,
                    { tab = JournalTab.entries[it] },
                    glass,
                    expanded,
                    Modifier.align(if (expanded) Alignment.CenterStart else Alignment.BottomCenter)
                        .padding(horizontal = 12.dp, vertical = 12.dp)
                        .widthIn(max = 640.dp),
                )
            }
        }
    }
    if (about)
        AlertDialog(
            onDismissRequest = { about = false },
            title = { Text("Über Zuerst") },
            text = {
                Text(
                    "Dein Küchenjournal für Vorrat und selbst gekochte Gerichte. Bonfotos werden auf diesem Gerät gelesen. Gespeichert werden nur deine bestätigten Zutaten und Gerichte.\n\nEine Marke von Odkaz Labs."
                )
            },
            confirmButton = { TextButton({ about = false }) { Text("Schließen") } },
        )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Today(
    catalog: Catalog,
    journal: Journal,
    cook: (Boolean) -> Unit,
    receipt: () -> Unit,
    navigate: (JournalTab) -> Unit,
    openRecipe: (Recipe) -> Unit,
    health: @Composable () -> Unit = {},
) {
    val ready = remember(journal.stock) { catalog.ready(journal.stock) }
    val scheme = MaterialTheme.colorScheme
    Text(
        LocalDate.now().format(dateFormat),
        color = scheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelLarge,
    )
    JournalTitle(if (journal.name.isBlank()) "Heute" else "Hallo, ${journal.name}")
    val prefs=androidx.compose.ui.platform.LocalContext.current.getSharedPreferences("zuerst-taste",android.content.Context.MODE_PRIVATE)
    val taste=runCatching {org.json.JSONObject(prefs.getString("value","{}")?:"{}")}.getOrDefault(org.json.JSONObject())
    val avoids=taste.optJSONArray("avoids")?.let {a -> (0 until a.length()).map {a.optString(it)}}?:emptyList()
    val planned=journal.plans.firstOrNull {it.day==LocalDate.now()}?.let {p -> catalog.recipes.firstOrNull {it.id==p.recipeId}}
    val suggested=planned?:catalog.recipes.filter {r ->
        r.items.any {it.id in journal.stock && it.id !in catalog.pantry} && r.items.none {it.id in avoids} &&
        (taste.optString("diet")!="vegetarian" || r.items.none {it.id=="tuna"}) && (taste.optString("mode","all")=="all" || r.mode==taste.optString("mode"))
    }.sortedWith(compareBy<Recipe> {journal.missing(it).size}.thenBy {it.minutes}).firstOrNull()
    JournalCard(LocalTones.current.kitchen,LocalTones.current.onKitchen) {
        Text(suggested?.name?:"Was kochen wir heute?",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text(suggested?.let {"${it.minutes} Minuten · 2 Portionen${if(planned!=null)" · Heute eingeplant" else ""}"}?:"Eine Zutat reicht. Finde ein Gericht in höchstens 20 Minuten.")
        if(suggested!=null) {
            val missing=journal.missing(suggested)
            Text(if(missing.isEmpty())"Alle Zutaten im Vorrat erfasst. Mengen und Zustand prüfen." else "Noch nicht erfasst: "+missing.take(3).joinToString {catalog.name(it)}+if(missing.size>3)" und ${missing.size-3} weitere." else ".",style=MaterialTheme.typography.bodySmall)
        }
        Button({if(suggested!=null)openRecipe(suggested)else cook(false)},Modifier.fillMaxWidth().heightIn(min=48.dp)){Text(if(suggested!=null)"Rezept ansehen" else "Zutat auswählen")}
    }
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
        FilledTonalButton({navigate(JournalTab.Food)}){Text("Essen eintragen")}
        FilledTonalButton(receipt){Text("Bon erfassen")}
        FilledTonalButton({navigate(JournalTab.Recipes)}){Text("Rezepte finden")}
    }
    health()
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        Metric("Vorrat", journal.stock.size, "Zutaten", Modifier.weight(1f)) {
            navigate(JournalTab.Stock)
        }
        Metric(
            "Gekocht",
            journal.counts().sumOf { it.second },
            "letzte 7 Tage",
            Modifier.weight(1f),
        ) {
            navigate(JournalTab.History)
        }
    }
    val soon =
        journal.stock
            .filter {
                journal.expiry[it]?.let { day -> day <= LocalDate.now().plusDays(2) } == true
            }
            .sortedBy { journal.expiry[it] }
    if (soon.isNotEmpty())
        JournalCard(scheme.tertiaryContainer, scheme.onTertiaryContainer) {
            Text(
                "Zuerst aufbrauchen",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            soon.forEach { Text("${catalog.name(it)} · ${journal.expiry[it]?.format(dateFormat)}") }
            Text(
                "Nach deinen eingetragenen Daten. Prüfe Lebensmittel vor dem Verwenden.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    JournalCard {
        Text(
            "Heute auf dem Plan",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        val planned =
            catalog.recipes.find { recipe ->
                journal.plans.any { it.day == LocalDate.now() && it.recipeId == recipe.id }
            }
        Text(
            planned?.let { "${it.name} · ${it.minutes} Min." }
                ?: "Ein kleiner Plan macht den nächsten Einkauf leichter."
        )
        TextButton({ navigate(JournalTab.Plan) }, Modifier.heightIn(min = 48.dp)) {
            Text(if (planned == null) "Gericht einplanen" else "Plan ansehen")
        }
    }
    JournalCard(LocalTones.current.movement, LocalTones.current.onMovement) {
        Text(
            "Vom Einkauf in den Vorrat",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        Text("Fotografiere einen Kassenbon und prüfe die erkannten Zutaten.")
        FilledTonalButton(receipt, modifier = Modifier.heightIn(min = 48.dp)) {
            Icon(Icons.Default.Add, null)
            Spacer(Modifier.width(6.dp))
            Text("Bon erfassen")
        }
    }
}

@Composable
private fun Metric(
    title: String,
    number: Int,
    detail: String,
    modifier: Modifier,
    action: () -> Unit,
) {
    Card(
        onClick = action,
        modifier = modifier,
        shape = RoundedCornerShape(24.dp),
        colors =
            CardDefaults.cardColors(
                containerColor =
                    if (title == "Vorrat") LocalTones.current.kitchen else LocalTones.current.trend,
                contentColor =
                    if (title == "Vorrat") LocalTones.current.onKitchen
                    else LocalTones.current.onTrend,
            ),
    ) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.labelLarge)
            Text(
                "${animatedCount(number)}",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(detail, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun Stock(
    catalog: Catalog,
    journal: Journal,
    receipt: () -> Unit,
    add: (String) -> Unit,
    remove: (String) -> Unit,
    update: (Journal) -> Unit,
) {
    JournalTitle("Vorrat")
    Text("Hier steht, was du zu Hause hast.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    Button(receipt, Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
        Icon(Icons.Default.Add, null)
        Spacer(Modifier.width(6.dp))
        Text("Bon erfassen")
    }
    JournalCard {
        Text(
            "Zutat hinzufügen",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        IngredientLookup(catalog, journal.stock, add)
    }
    JournalCard {
        Text(
            "Im Vorrat · ${journal.stock.size}",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        if (journal.stock.isEmpty()) Text("Füge Zutaten einzeln oder über einen Bon hinzu.")
        journal.stock.sortedBy(catalog::name).forEach { id ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(catalog.name(id))
                    ExpiryDate(id, journal) { day ->
                        update(
                            journal.copy(
                                expiry =
                                    if (day == null) journal.expiry - id
                                    else journal.expiry + (id to day)
                            )
                        )
                    }
                }
                IconButton({ remove(id) }) {
                    Icon(Icons.Default.Close, "${catalog.name(id)} aus Vorrat entfernen")
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun IngredientLookup(
    catalog: Catalog,
    excluded: Collection<String>,
    add: (String) -> Unit,
) {
    var search by rememberSaveable { mutableStateOf("") }
    OutlinedTextField(
        search,
        { search = it },
        Modifier.fillMaxWidth(),
        label = { Text("Zutat suchen") },
        leadingIcon = { Icon(Icons.Default.Search, null) },
        singleLine = true,
        shape = RoundedCornerShape(18.dp),
    )
    if (search.isBlank()) return
    val matches = catalog.search(search).filterNot { it in excluded }.take(8)
    if (matches.isEmpty())
        Text("Keine weitere passende Zutat gefunden.", style = MaterialTheme.typography.bodySmall)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        matches.forEach { id ->
            AssistChip(
                {
                    add(id)
                    search = ""
                },
                label = { Text(catalog.name(id)) },
                leadingIcon = { Icon(Icons.Default.Add, null, Modifier.size(16.dp)) },
                modifier = Modifier.heightIn(min = 48.dp),
            )
        }
    }
}

@Composable
private fun History(catalog: Catalog, journal: Journal, remove: (String) -> Unit) {
    val days = journal.counts()
    val total = days.sumOf { it.second }
    val peak = days.maxOf { it.second }.coerceAtLeast(1)
    var removing by remember { mutableStateOf<Meal?>(null) }
    JournalTitle("Verlauf")
    JournalCard {
        Text(
            "Gerichte · letzte 7 Tage",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        Text("$total", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
        if (total > 0)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                days.forEach { (day, count) ->
                    Column(
                        Modifier.weight(1f).semantics {
                            contentDescription = "${day.format(dateFormat)}, $count Gerichte"
                        },
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            Modifier.height(58.dp).fillMaxWidth(),
                            contentAlignment = Alignment.BottomCenter,
                        ) {
                            Box(
                                Modifier.width(12.dp)
                                    .height(if (count == 0) 2.dp else (count * 58f / peak).dp)
                                    .background(
                                        if (count == 0) MaterialTheme.colorScheme.outlineVariant
                                        else MaterialTheme.colorScheme.primary,
                                        CircleShape,
                                    )
                            )
                        }
                        Text(day.format(weekdayFormat), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        else Text("Nach dem Kochen kannst du dein Gericht hier eintragen.")
    }
    if (total > 0)
        JournalCard(
            MaterialTheme.colorScheme.tertiaryContainer,
            MaterialTheme.colorScheme.onTertiaryContainer,
        ) {
            Text(
                "Zutatenvielfalt · letzte 7 Tage",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "${journal.variety(catalog.pantry)}",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
            Text("Verschiedene Zutaten in deinen eingetragenen Rezepten, ohne Grundzutaten.")
        }
    if (journal.meals.isNotEmpty())
        JournalCard {
            Text(
                "Deine Gerichte",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            journal.meals.forEach { meal ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(meal.name, fontWeight = FontWeight.SemiBold)
                        Text(
                            meal.day.format(dateFormat),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    IconButton({ removing = meal }) {
                        Icon(Icons.Default.Close, "${meal.name} aus Verlauf entfernen")
                    }
                }
            }
        }
    removing?.let { meal ->
        AlertDialog(
            onDismissRequest = { removing = null },
            title = { Text("Eintrag entfernen?") },
            text = { Text(meal.name) },
            confirmButton = {
                TextButton({
                    remove(meal.id)
                    removing = null
                }) {
                    Text("Entfernen")
                }
            },
            dismissButton = { TextButton({ removing = null }) { Text("Abbrechen") } },
        )
    }
}

@Composable
internal fun JournalTitle(title: String) {
    Text(
        title,
        Modifier.semantics { heading() },
        style = MaterialTheme.typography.headlineLarge,
        fontWeight = FontWeight.Bold,
    )
}

@Composable
internal fun JournalCard(
    color: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.surfaceContainerLow,
    foreground: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(26.dp),
        color = color,
        contentColor = foreground,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(
            Modifier.padding(17.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
            content = content,
        )
    }
}
