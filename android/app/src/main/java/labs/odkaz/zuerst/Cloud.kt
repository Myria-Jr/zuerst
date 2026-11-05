package labs.odkaz.zuerst

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal data class Account(val id: String, val email: String)

internal class Cloud(context: Context) {
    private val storage = context.getSharedPreferences("cloud_session", Context.MODE_PRIVATE)
    private val alias = "zuerst-session-v1"
    private val auth = "https://ep-rapid-tooth-bav9j8t9.neonauth.c-8.eu-central-1.aws.neon.tech/zuerst/auth"
    private val api = "https://ep-rapid-tooth-bav9j8t9.apirest.c-8.eu-central-1.aws.neon.tech/zuerst/rest/v1/kitchen_backups"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return (store.getKey(alias, null) as? SecretKey) ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    private fun cookie(): String? = runCatching {
        val source = storage.getString("cookie", null) ?: return@runCatching null
        val parts = source.split(":")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
        String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8)
    }.getOrNull()

    private fun saveCookie(value: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        storage.edit().putString("cookie", Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply()
    }

    private fun request(url: String, method: String = "GET", body: JSONObject? = null, jwt: String? = null): String {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 20_000; connection.readTimeout = 20_000
            connection.instanceFollowRedirects = false
            connection.requestMethod = method
            connection.setRequestProperty("Accept", "application/json")
            if (jwt == null) {
                connection.setRequestProperty("Origin", "https://zuerst.vercel.app")
                cookie()?.let { connection.setRequestProperty("Cookie", it) }
            } else {
                connection.setRequestProperty("Authorization", "Bearer $jwt")
                connection.setRequestProperty("Prefer", "resolution=merge-duplicates,return=representation")
            }
            body?.let {
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true
                connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val text = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val code = runCatching { JSONObject(text).optString("code") }.getOrDefault("")
                error(when {
                    code == "INVALID_EMAIL_OR_PASSWORD" -> "E-Mail oder Passwort stimmt nicht."
                    code.startsWith("USER_ALREADY_EXISTS") -> "Für diese E-Mail gibt es bereits ein Konto. Melde dich an."
                    status == 429 -> "Zu viele Versuche. Bitte warte kurz."
                    status == 401 -> "Bitte melde dich erneut an."
                    else -> "Die Anfrage konnte nicht abgeschlossen werden. Bitte prüfe deine Verbindung."
                })
            }
            if (jwt == null) connection.headerFields.filterKeys { it?.equals("Set-Cookie", true) == true }.values.flatten()
                .map { it.substringBefore(';') }.firstOrNull { it.startsWith("__Secure-neonauth.session_token=") && it.substringAfter('=').isNotBlank() }?.let(::saveCookie)
            return text
        } finally { connection.disconnect() }
    }

    suspend fun session(): Account? = withContext(Dispatchers.IO) {
        if (cookie() == null) return@withContext null
        val source = request("$auth/get-session")
        val user = if(source == "null") null else JSONObject(source.ifBlank { "{}" }).optJSONObject("user")
        user?.let { Account(it.getString("id"), it.getString("email")) }
    }
    suspend fun signIn(email: String, password: String, register: Boolean, name: String): Account = withContext(Dispatchers.IO) {
        request("$auth/${if (register) "sign-up" else "sign-in"}/email", "POST", JSONObject().put("email", email.trim()).put("password", password).apply { if (register) put("name", name.ifBlank { "Zuerst" }) })
        session() ?: error("Die Anmeldung konnte nicht abgeschlossen werden. Versuche es erneut.")
    }
    suspend fun signOut() = withContext(Dispatchers.IO) {
        request("$auth/sign-out", "POST", JSONObject())
        storage.edit().remove("cookie").apply()
    }
    suspend fun reset(email: String) = withContext(Dispatchers.IO) {
        request("$auth/request-password-reset", "POST", JSONObject().put("email", email.trim()).put("redirectTo", "https://zuerst.vercel.app/reset/")); Unit
    }
    private fun jwt(): String = JSONObject(request("$auth/token")).getString("token")
    suspend fun save(journal: Journal) = withContext(Dispatchers.IO) {
        request("$api?on_conflict=user_id", "POST", JSONObject().put("payload", journal.json()).put("updated_at", java.time.Instant.now().toString()), jwt()); Unit
    }
    suspend fun restore(catalog: Catalog): Journal = withContext(Dispatchers.IO) {
        val rows = JSONArray(request("$api?select=payload", jwt = jwt()))
        check(rows.length() > 0) { "Für dieses Konto ist noch keine Sicherung vorhanden." }
        Journal.parse(rows.getJSONObject(0).getJSONObject("payload").toString(), catalog)
    }
    suspend fun removeBackup() = withContext(Dispatchers.IO) { request(api, "DELETE", jwt = jwt()); Unit }
}
