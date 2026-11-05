package labs.odkaz.zuerst

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.launch

@Composable
internal fun HealthConnectCard() {
    val context = LocalContext.current
    val tones = LocalTones.current
    val scope = rememberCoroutineScope()
    val status = remember { HealthConnectClient.getSdkStatus(context) }
    val client =
        remember(status) {
            if (status == HealthConnectClient.SDK_AVAILABLE)
                HealthConnectClient.getOrCreate(context)
            else null
        }
    var steps by remember { mutableStateOf<Long?>(null) }
    var floors by remember { mutableStateOf<Double?>(null) }
    var glucose by remember { mutableStateOf<String?>(null) }
    var message by remember {
        mutableStateOf("Noch nicht verbunden. Fehlende Werte bleiben unbekannt.")
    }
    var busy by remember { mutableStateOf(false) }
    val movement = remember {
        setOf(
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(FloorsClimbedRecord::class),
        )
    }
    val sugar = remember { setOf(HealthPermission.getReadPermission(BloodGlucoseRecord::class)) }
    fun read() {
        scope.launch {
            busy = true
            steps = null
            floors = null
            glucose = null
            try {
                val hc = client ?: return@launch
                val permissions = hc.permissionController.getGrantedPermissions()
                val end = Instant.now()
                val start = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant()
                val range = TimeRangeFilter.between(start, end)
                if (movement.all { it in permissions }) {
                    val result =
                        hc.aggregate(
                            AggregateRequest(
                                setOf(
                                    StepsRecord.COUNT_TOTAL,
                                    FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL,
                                ),
                                range,
                            )
                        )
                    steps = result[StepsRecord.COUNT_TOTAL]
                    floors = result[FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL]
                    val origins = result.dataOrigins.joinToString { it.packageName }
                    message =
                        "Heute · abgerufen ${java.time.LocalTime.now().withNano(0)} · Quelle: ${origins.ifBlank{"Health Connect · keine Einträge"}}"
                } else message = "Bewegungsfreigabe fehlt. Du kannst sie erneut erteilen."
                if (sugar.all { it in permissions }) {
                    val result =
                        hc.readRecords(
                            ReadRecordsRequest(
                                BloodGlucoseRecord::class,
                                timeRangeFilter =
                                    TimeRangeFilter.between(end.minusSeconds(7 * 86400), end),
                                ascendingOrder = false,
                                pageSize = 1,
                            )
                        )
                    glucose =
                        result.records.firstOrNull()?.let {
                            "${it.level.inMillimolesPerLiter} mmol/l · ${it.time.atZone(ZoneId.systemDefault())} · ${it.metadata.dataOrigin.packageName}"
                        }
                }
            } catch (_: SecurityException) {
                message = "Freigabe verweigert oder widerrufen. Keine Daten gelesen."
            } catch (_: Exception) {
                message = "Health Connect gerade nicht verfügbar. Bitte später erneut versuchen."
            } finally {
                busy = false
            }
        }
    }
    val permissions =
        rememberLauncherForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) {
            read()
        }
    JournalCard(tones.movement, tones.onMovement) {
        Text("Bewegung", style = MaterialTheme.typography.titleLarge)
        Text(
            "${steps?.toString()?:"–"} Schritte · ${floors?.toString()?:"–"} Etagen",
            style = MaterialTheme.typography.headlineSmall,
        )
        Text(message)
        if (client != null) {
            Button({ permissions.launch(movement) }, enabled = !busy) {
                Text("Health Connect verbinden")
            }
            TextButton({ read() }, enabled = !busy) { Text("Werte aktualisieren") }
            TextButton({ permissions.launch(sugar) }, enabled = !busy) {
                Text("Blutzuckermessungen freiwillig freigeben")
            }
            Text(glucose ?: "Keine Blutzuckermessung verbunden oder vorhanden.")
            Text(
                "Nur tatsächliche Messungen mit Zeit und Quelle. Keine Messung durch Zuerst, keine Therapieempfehlung.",
                style = MaterialTheme.typography.bodySmall,
            )
            TextButton({
                scope.launch {
                    try {
                        client.permissionController.revokeAllPermissions()
                        steps = null
                        floors = null
                        glucose = null
                        message = "Gerätefreigaben widerrufen."
                    } catch (_: Exception) {
                        message = "Bitte Freigaben direkt in Health Connect verwalten."
                    }
                }
            }) {
                Text("Gerätefreigaben widerrufen")
            }
        } else {
            Text(
                "Health Connect fehlt oder benötigt ein Update. Ohne Verbindung bleiben Gerätedaten unbekannt."
            )
            TextButton({
                context.startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(
                            "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"
                        ),
                    )
                )
            }) {
                Text("Health Connect öffnen")
            }
        }
    }
}
