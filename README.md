# Zuerst

Deutschsprachige App von Odkaz Labs: Wähle bis zu drei Zutaten, bestätige, was du noch da hast, und erhalte ein Gericht für zwei Personen in höchstens 20 Minuten. Web, Android und iOS verwenden denselben Katalog mit 24 Rezepten. Die Kernfunktionen laufen lokal ohne Konto. Eine freiwillige Anmeldung ermöglicht manuelle Cloud-Sicherungen.

## Lokal starten

Im Verzeichnis `zuerst` (Node.js ≥ 22.13):

```sh
npm ci
npm run dev
```

Öffne [localhost:3000](http://localhost:3000). `npm test` prüft Rezeptkatalog, Suche und Matching. `npm run build` erstellt den statischen Export; `npm start` zeigt diesen Export lokal an.

## Küchenjournal 1.2

Heute, Rezeptbibliothek mit Merkliste und Filtern, Vorrat mit optionalen Aufbrauchdaten, Wochenplan mit Einkaufsliste und Kochverlauf. Fehlende Zutaten lassen sich aus Rezepten oder dem gesamten Wochenplan übernehmen. „Gekauftes übernehmen“ ergänzt ausgewählte Zutaten im Vorrat. Die Liste bündelt Zutaten; Mengen stehen in den Rezepten. Der Web-Einstieg ist die Übersicht; `/kochen/` öffnet direkt die Zutatenauswahl.

Im Profil lassen sich Daten als JSON exportieren und nach Bestätigung wiederherstellen. Datenformat Version 2 ist zwischen Web, Android und iOS austauschbar. Alte native Journale werden beim Laden übernommen.

## Anmeldung und Sicherung

E-Mail/Passwort-Anmeldung über Neon Auth (Managed Better Auth), eigene Neon-Datenbank in Frankfurt. Passwörter werden vom Auth-Dienst verwaltet. Native Sitzungen liegen verschlüsselt im Android Keystore beziehungsweise in der Apple Keychain; im Web nutzt die Anmeldung HttpOnly-Cookies. Auf der Vercel-Startadresse vermeidet ein Auth-Proxy Abhängigkeiten von Drittanbieter-Cookies. Andere statische Hosts verwenden den Auth-Dienst direkt; der Browser muss dessen Cookies zulassen.

Es gibt keine automatische Synchronisierung. „Jetzt sichern“ ersetzt die Cloud-Sicherung des angemeldeten Kontos. „Sicherung wiederherstellen“ zeigt eine Bestätigung vor dem Ersetzen der lokalen Daten. Bonfotos und Bontext werden nicht gesichert. Die Cloud-Sicherung kann im Profil gelöscht werden. Datei-Export und Kernfunktionen benötigen keinen Cloud-Dienst.

Die öffentlichen Dienstadressen stehen in den Cloud-Modulen. Datenbank-Zugangsdaten und private Schlüssel gehören nie in App oder Repository. `backend/schema.sql` dokumentiert die bereits eingerichtete Tabelle mit nutzergebundener Row-Level Security. Für eigene Bereitstellungen Neon Auth und Data API aktivieren, das Schema auf einer neuen Datenbank anlegen, eigene Dienstadressen einsetzen und die HTTPS-Startadresse als vertrauenswürdige Origin freigeben.

## Native Apps

Das native Küchenjournal bündelt passende Gerichte, Vorrat und Kochverlauf. Du kannst einen Kassenbon fotografieren, ein vorhandenes Foto wählen oder Bontext einfügen. Die Erkennung läuft auf dem Gerät. Prüfe die Zutaten vor dem Übernehmen. Gespeichert werden bestätigte Zutaten und eingetragene Gerichte. Der Verlauf zeigt die letzten sieben Tage.

- **Android:** `android/` in Android Studio öffnen (JDK 17, Android SDK 35). `gradlew.bat :app:testReleaseUnitTest :app:assembleRelease` auf Windows beziehungsweise `./gradlew :app:testReleaseUnitTest :app:assembleRelease` auf macOS/Linux. Jetpack Compose nutzt Material 3 mit der Systempalette auf Android 12+ und einer Zuerst-Palette als Fallback. Mindestversion: Android 8.
- **iOS:** `ios/Zuerst.xcodeproj` in Xcode mit iOS-26-SDK öffnen und das Schema `Zuerst` im iPhone-Simulator starten. Der SwiftUI-Dock nutzt Apples Liquid Glass über einem bewegten Mesh; die Bedienung berücksichtigt reduzierte Bewegung und Transparenz. Für Gerätebuilds in Xcode ein Apple-Entwicklerteam wählen. Eine iOS-App wird über TestFlight/App Store oder mit passender Geräteprovisionierung verteilt; die APK ist ausschließlich für Android.

Bei Rezeptänderungen `npm run sync:native` ausführen und `shared/catalog.json` mit einchecken. `npm run sync:native -- --check` prüft die Übereinstimmung. Der GitHub-Workflow in `.github/workflows/native.yml` prüft die nativen Builds ohne Verteilungsschlüssel.

Die Download-APK enthält ARM64 und ARMv7 für Android-Smartphones und Tablets. Für x86-Emulatoren mit `-PzuerstAllAbis=true` bauen; damit werden auch die x86-Bibliotheken eingebunden. Die Bonerkennung bleibt vollständig auf dem Gerät.

## Statisch veröffentlichen

Veröffentliche den **Inhalt** von `out/` inklusive `_next/` als Wurzel einer HTTPS-Website. Die App benötigt weder einen Node-Server noch Konfiguration oder Zugangsdaten. Die Startadresse ist die Wurzel der Website (`/`).

Für den APK-Download vor dem Webbuild die signierte, geprüfte Release-Datei nach `public/downloads/zuerst-android.apk` legen. Unter Windows erledigt `pwsh -File scripts/sign-android.ps1` Signatur und Prüfung nach `:app:assembleRelease`; `JAVA_HOME` und `ANDROID_HOME` müssen gesetzt sein, und Build Tools 36.0.0 müssen vorliegen. Der Schlüssel liegt im privaten Windows-Benutzerprofil. Für spätere APK-Updates denselben Schlüssel verwenden. Ohne APK blendet der Webbuild den Download aus.

Für Vercel: Nach `npm run build` erstellt `node scripts/stage-vercel.mjs` die statische Build-Ausgabe. Aus dem mit Zuerst verknüpften Projektordner kann sie mit `vercel deploy --prebuilt --prod` veröffentlicht werden.

## QR-Code für den Kühlschrank

Öffne [zuerst.vercel.app/kochen/](https://zuerst.vercel.app/kochen/) in Chrome und wähle **Speichern und teilen → QR-Code erstellen**. Lade den Code herunter und drucke ihn aus. Scanne ihn vor dem Aufhängen mit der Handykamera, am besten ohne WLAN. Der Zusatz `/kochen/` öffnet direkt die Zutatenauswahl. Die Startadresse ohne diesen Zusatz führt zum Küchenjournal.
