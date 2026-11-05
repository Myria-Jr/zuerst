# Zuerst

Deutschsprachige App von Vora (Studio-Arbeitsname im Projekt Odkaz Labs): Wähle bis zu drei Zutaten, bestätige, was du noch da hast, und erhalte ein Gericht für zwei Personen in höchstens 20 Minuten. Web, Android und iOS verwenden denselben Katalog mit 24 Rezepten. Die Kernfunktionen laufen lokal ohne Konto. Eine freiwillige Anmeldung ermöglicht manuelle Cloud-Sicherungen.

## Lokal starten

Im Verzeichnis `zuerst` (Node.js ≥ 22.13):

```sh
npm ci
npm run dev
```

Öffne [localhost:3000](http://localhost:3000). `npm test` prüft Rezeptkatalog, Suche und Matching. `npm run build` erstellt den statischen Export; `npm start` zeigt diesen Export lokal an.

## Zuerst 1.3

Hell, Dunkel und System sind kostenlos wählbar und bleiben gespeichert. Essen, Wasser, Bewegung, Küche und Auswertungen besitzen feste Bereichsfarben. Die Android-Navigation verbindet Material-Komponenten mit einer schwebenden, transluzenten Glasfläche und tatsächlicher Hintergrundunschärfe auf unterstützten Geräten. Auf großen Breiten wird sie zur NavigationRail. Die Lizenz der Haze-Bibliothek liegt unter `shared/licenses/haze.txt` sowie `public/licenses/haze.txt`.

Die gemeinsame Grundlage für Nährwerte, mengenbasierten Vorrat, Health-Connect-Tageswerte und überprüfbare Social-Rezeptentwürfe ist in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) beschrieben. Die Typen und Logik werden auf Android und im Web mit denselben Testvektoren geprüft. Die Lebensmittelsuche enthält 45 belegte USDA-Referenzlebensmittel; roh und gekocht sind getrennt. Lokale Foto-Suchhilfen benötigen eine bestätigte Zutat und Grammmenge. Web nutzt MobileNet (Apache 2.0), Android ML Kit, iOS Vision. Health Connect liest freigegebene Schritte/Etagen und optional tatsächliche Blutzuckermessungen; iOS liest Schritte/Etagen mit CoreMotion. Der Browser zeigt keine erfundenen Gerätedaten.

Heute, Rezeptbibliothek mit Merkliste und Filtern, Vorrat mit optionalen Aufbrauchdaten, Wochenplan mit Einkaufsliste und Kochverlauf. Fehlende Zutaten lassen sich aus Rezepten oder dem gesamten Wochenplan übernehmen. „Gekauftes übernehmen“ ergänzt ausgewählte Zutaten im Vorrat. Die Liste bündelt Zutaten; Mengen stehen in den Rezepten. Der Web-Einstieg ist die Übersicht; `/kochen/` öffnet direkt die Zutatenauswahl.

Das Gesundheitsjournal ist ab 16 freiwillig und separat gespeichert; unter 18 ohne Kalorienübersicht, Koffeinjournal oder eigene Plus-Käufe. Gerätefreigaben lassen sich widerrufen. Gesundheitsdaten gehen nicht in Küchensicherungen. Export, Lesen, Löschen und Wochenübersicht bleiben kostenlos. Social-Importe übernehmen Link plus selbst bereitgestellten und geprüften Rezepttext. Kein Video-Scraping.

Plus: 30/90-Tage-Vergleiche, automatische Planung bis zu vier Wochen, Vorlagen und gemeinsame Einkaufsliste. 1 €/Monat, 5 €/Jahr oder 10 € einmalig für die Produktlaufzeit. Gleiche Leistungen in allen Varianten, keine kostenpflichtige Cloud-KI. Live-Verkauf bleibt bis Konto-/Anbieter-/Steuer-/Vertragsfreigabe gesperrt; eine aktivierte Sandbox ist ausdrücklich Test. Native Käufe benötigen noch eine gesonderte Store-Anbindung.

Im Profil lassen sich Daten als JSON exportieren und nach Bestätigung wiederherstellen. Datenformat Version 2 ist zwischen Web, Android und iOS austauschbar. Alte native Journale werden beim Laden übernommen.

## Anmeldung und Sicherung

E-Mail/Passwort-Anmeldung über Neon Auth (Managed Better Auth), eigene Neon-Datenbank in Frankfurt. Passwörter werden vom Auth-Dienst verwaltet. Native Sitzungen liegen verschlüsselt im Android Keystore beziehungsweise in der Apple Keychain; im Web nutzt die Anmeldung HttpOnly-Cookies. Auf der Vercel-Startadresse vermeidet ein Auth-Proxy Abhängigkeiten von Drittanbieter-Cookies. Andere statische Hosts verwenden den Auth-Dienst direkt; der Browser muss dessen Cookies zulassen.

Es gibt keine automatische Synchronisierung. „Jetzt sichern“ ersetzt die Cloud-Sicherung des angemeldeten Kontos. „Sicherung wiederherstellen“ zeigt eine Bestätigung vor dem Ersetzen der lokalen Daten. Bonfotos und Bontext werden nicht gesichert. Die Cloud-Sicherung kann im Profil gelöscht werden. Datei-Export und Kernfunktionen benötigen keinen Cloud-Dienst.

Der Export bleibt eine eigenständige statische App. Auf Vercel ergänzt `api/auth.ts` den optionalen Auth-Proxy mit Origin-Prüfung und HttpOnly-Sitzungscookies. `scripts/stage-vercel.mjs` paketiert diese Funktion auch für Prebuilt-Deployments. Andere statische Hosts nutzen den Auth-Dienst direkt.

Die öffentlichen Dienstadressen stehen in den Cloud-Modulen. Datenbank-Zugangsdaten und private Schlüssel gehören nie in App oder Repository. `backend/schema.sql` dokumentiert die bereits eingerichtete Tabelle mit nutzergebundener Row-Level Security. Für eigene Bereitstellungen Neon Auth und Data API aktivieren, das Schema auf einer neuen Datenbank anlegen, eigene Dienstadressen einsetzen und die HTTPS-Startadresse als vertrauenswürdige Origin freigeben.

## Native Apps

Das native Küchenjournal bündelt passende Gerichte, Vorrat und Kochverlauf. Du kannst einen Kassenbon fotografieren, ein vorhandenes Foto wählen oder Bontext einfügen. Die Erkennung läuft auf dem Gerät. Prüfe die Zutaten vor dem Übernehmen. Gespeichert werden bestätigte Zutaten und eingetragene Gerichte. Der Verlauf zeigt die letzten sieben Tage.

- **Android:** `android/` in Android Studio öffnen (JDK 17, Android SDK 35). `gradlew.bat :app:testReleaseUnitTest :app:assembleRelease` auf Windows beziehungsweise `./gradlew :app:testReleaseUnitTest :app:assembleRelease` auf macOS/Linux. Jetpack Compose nutzt Material 3 mit der hellen Systempalette auf Android 12+ und einer Zuerst-Palette als Fallback. Mindestversion: Android 8.
- **iOS:** `ios/Zuerst.xcodeproj` in Xcode mit iOS-26-SDK öffnen und das Schema `Zuerst` im iPhone-Simulator starten. Der SwiftUI-Dock nutzt Apples Liquid Glass über einem bewegten Mesh; die Bedienung berücksichtigt reduzierte Bewegung und Transparenz. Für Gerätebuilds in Xcode ein Apple-Entwicklerteam wählen. Eine iOS-App wird über TestFlight/App Store oder mit passender Geräteprovisionierung verteilt; die APK ist ausschließlich für Android.

Bei Rezeptänderungen `npm run sync:native` ausführen und `shared/catalog.json` mit einchecken. `npm run sync:native -- --check` prüft die Übereinstimmung. Der GitHub-Workflow in `.github/workflows/native.yml` prüft die nativen Builds ohne Verteilungsschlüssel.

Die Download-APK enthält ARM64 und ARMv7 für Android-Smartphones und Tablets. Für x86-Emulatoren mit `-PzuerstAllAbis=true` bauen; damit werden auch die x86-Bibliotheken eingebunden. Die Bonerkennung bleibt vollständig auf dem Gerät.

## Statisch veröffentlichen

Veröffentliche den **Inhalt** von `out/` inklusive `_next/` als Wurzel einer HTTPS-Website. Die lokalen Gratisfunktionen benötigen weder Backend noch Zugangsdaten. Optionales Konto/Cloud-Sicherung und Stripe Billing benötigen die jeweiligen API-Funktionen und serverseitige Konfiguration. Die Startadresse ist die Wurzel der Website (`/`).

Für den APK-Download vor dem Webbuild die signierte, geprüfte Release-Datei nach `public/downloads/zuerst-android.apk` legen. Unter Windows erledigt `pwsh -File scripts/sign-android.ps1` Signatur und Prüfung nach `:app:assembleRelease`; `JAVA_HOME` und `ANDROID_HOME` müssen gesetzt sein, und Build Tools 36.0.0 müssen vorliegen. Der Schlüssel liegt im privaten Windows-Benutzerprofil. Für spätere APK-Updates denselben Schlüssel verwenden. Ohne APK blendet der Webbuild den Download aus.

Für Vercel: Nach `npm run build` erstellt `node scripts/stage-vercel.mjs` die statische Build-Ausgabe. Aus dem mit Zuerst verknüpften Projektordner kann sie mit `vercel deploy --prebuilt --prod` veröffentlicht werden.

Der verbundene Git-Build auf Vercel verwendet `node scripts/fetch-apk.mjs && npm run build`. Das Skript lädt die bereits veröffentlichte APK und prüft die in `release/android.json` festgelegte SHA-256-Prüfsumme. Bei einer neuen Android-Version zuerst die geprüfte APK auf Sites veröffentlichen und anschließend das Release-Manifest aktualisieren. Private Signaturschlüssel werden dafür nicht benötigt.

## QR-Code für den Kühlschrank

Öffne [zuerst.vercel.app/kochen/](https://zuerst.vercel.app/kochen/) in Chrome und wähle **Speichern und teilen → QR-Code erstellen**. Lade den Code herunter und drucke ihn aus. Scanne ihn vor dem Aufhängen mit der Handykamera, am besten ohne WLAN. Der Zusatz `/kochen/` öffnet direkt die Zutatenauswahl. Die Startadresse ohne diesen Zusatz führt zum Küchenjournal.

## Modell und Zahlungen

`npm run build` lädt und prüft die 1,9-MB-MobileNet-Gewichte automatisch per SHA-256; sie werden mit der statischen App ausgeliefert. Fotos bleiben lokal. Quellen/Lizenzen unter `public/licenses/`, Lebensmitteldaten in `shared/foods.json`. `server/BILLING-HANDOFF.md` beschreibt sichere Stripe-Konfiguration und API-Vertrag. Geheimnisse gehören ausschließlich in Server-Umgebungsvariablen.

Für iOS sind Mac und Xcode 26 nötig. Persönliche Gerätetests sind mit einer kostenlosen Apple-ID möglich; App Store und TestFlight erfordern das Apple Developer Program. Der Simulator-Build wird im GitHub-Workflow geprüft.
