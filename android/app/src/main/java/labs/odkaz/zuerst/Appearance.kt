package labs.odkaz.zuerst

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

internal enum class ThemeMode(val label: String) {
    System("System"),
    Light("Hell"),
    Dark("Dunkel"),
}

internal data class Appearance(
    val mode: ThemeMode,
    val dark: Boolean,
    val opaque: Boolean = false,
    val changeOpaque: (Boolean) -> Unit = {},
    val change: (ThemeMode) -> Unit,
)

internal data class Tones(
    val movement: Color,
    val onMovement: Color,
    val nutrition: Color,
    val onNutrition: Color,
    val kitchen: Color,
    val onKitchen: Color,
    val water: Color,
    val onWater: Color,
    val trend: Color,
    val onTrend: Color,
)

internal val LocalAppearance = staticCompositionLocalOf { Appearance(ThemeMode.System, false) {} }
internal val LocalTones = staticCompositionLocalOf { lightTones }
private val lightTones =
    Tones(
        Color(0xFFB7E5CF),
        Color(0xFF143F33),
        Color(0xFFFFDBBF),
        Color(0xFF4F2E1C),
        Color(0xFFD0EBA3),
        Color(0xFF24370D),
        Color(0xFFC8E5FF),
        Color(0xFF163C5B),
        Color(0xFFDDD0FF),
        Color(0xFF3D225D),
    )
private val darkTones =
    Tones(
        Color(0xFF124F42),
        Color(0xFFBAF3DC),
        Color(0xFF633A28),
        Color(0xFFFFE2C7),
        Color(0xFF354A1C),
        Color(0xFFDDF5B7),
        Color(0xFF174F72),
        Color(0xFFD8F0FF),
        Color(0xFF4D3071),
        Color(0xFFEDDDFF),
    )

@Composable
internal fun ZuerstTheme(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("appearance", Context.MODE_PRIVATE) }
    var opaque by remember { mutableStateOf(prefs.getBoolean("opaque", false)) }
    var mode by remember {
        mutableStateOf(
            runCatching { ThemeMode.valueOf(prefs.getString("mode", "System")!!) }
                .getOrDefault(ThemeMode.System)
        )
    }
    val dark =
        when (mode) {
            ThemeMode.System -> isSystemInDarkTheme()
            ThemeMode.Dark -> true
            ThemeMode.Light -> false
        }
    val tones = if (dark) darkTones else lightTones
    val colors =
        if (dark)
            darkColorScheme(
                primary = Color(0xFFD9B7FF),
                onPrimary = Color(0xFF35174C),
                primaryContainer = tones.kitchen,
                onPrimaryContainer = tones.onKitchen,
                secondaryContainer = tones.movement,
                onSecondaryContainer = tones.onMovement,
                tertiaryContainer = tones.trend,
                onTertiaryContainer = tones.onTrend,
                background = Color(0xFF17151B),
                surface = Color(0xFF17151B),
                surfaceContainer = Color(0xFF242129),
                surfaceContainerLow = Color(0xFF242129),
                surfaceContainerHigh = Color(0xFF302A36),
                onSurface = Color(0xFFF3EAF5),
                onBackground = Color(0xFFF3EAF5),
                onSurfaceVariant = Color(0xFFC8BACD),
                outline = Color(0xFFAA96B6),
                outlineVariant = Color(0xFF56495E),
            )
        else
            lightColorScheme(
                primary = Color(0xFF633A82),
                onPrimary = Color.White,
                primaryContainer = tones.kitchen,
                onPrimaryContainer = tones.onKitchen,
                secondaryContainer = tones.movement,
                onSecondaryContainer = tones.onMovement,
                tertiaryContainer = tones.trend,
                onTertiaryContainer = tones.onTrend,
                background = Color(0xFFFAF8F3),
                surface = Color(0xFFFAF8F3),
                surfaceContainer = Color(0xFFFFFEFA),
                surfaceContainerLow = Color(0xFFFFFEFA),
                surfaceContainerHigh = Color(0xFFF0E7F4),
                onSurface = Color(0xFF2C2532),
                onBackground = Color(0xFF2C2532),
                onSurfaceVariant = Color(0xFF665B6C),
                outline = Color(0xFF806D88),
                outlineVariant = Color(0xFFDCD2DF),
            )
    SideEffect {
        (context as? ComponentActivity)?.enableEdgeToEdge(
            statusBarStyle =
                if (dark) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                else
                    SystemBarStyle.light(
                        android.graphics.Color.TRANSPARENT,
                        android.graphics.Color.TRANSPARENT,
                    ),
            navigationBarStyle =
                if (dark) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                else
                    SystemBarStyle.light(
                        android.graphics.Color.TRANSPARENT,
                        android.graphics.Color.TRANSPARENT,
                    ),
        )
    }
    CompositionLocalProvider(
        LocalTones provides tones,
        LocalAppearance provides
            Appearance(
                mode,
                dark,
                opaque,
                { value ->
                    opaque = value
                    prefs.edit().putBoolean("opaque", value).apply()
                },
            ) { next ->
                mode = next
                prefs.edit().putString("mode", next.name).apply()
            },
    ) {
        MaterialTheme(colorScheme = colors, content = content)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun AppearancePicker() {
    val appearance = LocalAppearance.current
    JournalCard(LocalTones.current.trend, LocalTones.current.onTrend) {
        Text("Darstellung", style = MaterialTheme.typography.titleLarge)
        Row {
            Switch(appearance.opaque, appearance.changeOpaque)
            Text("Deckende Navigation", Modifier.padding(start = 12.dp))
        }
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            ThemeMode.entries.forEach { mode ->
                ZuerstFilter(mode.label, appearance.mode == mode) { appearance.change(mode) }
            }
        }
    }
}

@Composable
internal fun ZuerstFilter(label: String, selected: Boolean, click: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    FilterChip(
        selected = selected,
        onClick = click,
        label = { Text(label) },
        shape = CircleShape,
        leadingIcon = {
            Icon(
                Icons.Default.Check,
                null,
                Modifier.size(18.dp),
                tint = if (selected) colors.onPrimary else Color.Transparent,
            )
        },
        colors =
            FilterChipDefaults.filterChipColors(
                containerColor = LocalTones.current.trend,
                labelColor = LocalTones.current.onTrend,
                selectedContainerColor = colors.primary,
                selectedLabelColor = colors.onPrimary,
            ),
        border = null,
        modifier = Modifier.heightIn(min = 48.dp),
    )
}

@Composable
internal fun animatedCount(value: Int): Int =
    androidx.compose.animation.core
        .animateIntAsState(value, androidx.compose.animation.core.tween(320), label = "Zahl")
        .value
