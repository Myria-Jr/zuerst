package labs.odkaz.zuerst

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.HazeDefaults
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeChild

internal data class NavigationDestination(val label: String, val icon: ImageVector)

@Composable
internal fun GlassNavigation(
    destinations: List<NavigationDestination>, selected: Int, onSelect: (Int) -> Unit,
    state: HazeState, expanded: Boolean, modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(32.dp)
    val colors = MaterialTheme.colorScheme
    val glass = modifier
        .shadow(12.dp, shape, ambientColor = Color(0x1A302338), spotColor = Color(0x29302338))
        .clip(shape)
        .hazeChild(state, HazeDefaults.style(
            backgroundColor = colors.surface,
            tint = HazeTint(Color.White.copy(alpha = .78f)),
            blurRadius = 20.dp, noiseFactor = 0f,
        )) { fallbackTint = HazeTint(Color.White.copy(alpha = .97f)) }
        .border(BorderStroke(1.dp, Brush.verticalGradient(listOf(Color.White, Color.White.copy(alpha = .35f)))), shape)

    if (expanded) {
        NavigationRail(modifier = glass.width(96.dp).heightIn(max = 510.dp), containerColor = Color.Transparent) {
            Spacer(Modifier.height(12.dp))
            destinations.forEachIndexed { index, destination ->
                NavigationRailItem(selected = selected == index, onClick = { onSelect(index) },
                    icon = { Icon(destination.icon, null) }, label = { Text(destination.label) },
                    modifier = Modifier.padding(vertical = 5.dp))
            }
        }
    } else {
        NavigationBar(modifier = glass, containerColor = Color.Transparent, tonalElevation = 0.dp,
            windowInsets = WindowInsets(0, 0, 0, 0)) {
            destinations.forEachIndexed { index, destination ->
                NavigationBarItem(selected = selected == index, onClick = { onSelect(index) },
                    icon = { Icon(destination.icon, null) }, label = { Text(destination.label) })
            }
        }
    }
}
