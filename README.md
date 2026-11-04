# Zuerst

Deutschsprachige App von Odkaz Labs: Wähle bis zu drei Zutaten, bestätige, was du noch da hast, und erhalte ein Gericht für zwei Personen in höchstens 20 Minuten. Web, Android und iOS verwenden denselben Katalog mit 24 Rezepten und laufen ohne Konto oder Backend.

## Lokal starten

Im Verzeichnis `zuerst` (Node.js ≥ 22.13):

```sh
npm ci
npm run dev
```

Öffne [localhost:3000](http://localhost:3000). `npm test` prüft Rezeptkatalog, Suche und Matching. `npm run build` erstellt den statischen Export; `npm start` zeigt diesen Export lokal an.

## Native Apps

Das native Küchenjournal bündelt passende Gerichte, Vorrat und Kochverlauf. Du kannst einen Kassenbon fotografieren, ein vorhandenes Foto wählen oder Bontext einfügen. Die Erkennung läuft auf dem Gerät. Prüfe die Zutaten vor dem Übernehmen. Gespeichert werden bestätigte Zutaten und eingetragene Gerichte. Der Verlauf zeigt die letzten sieben Tage.

- **Android:** `android/` in Android Studio öffnen (JDK 17, Android SDK 35). `gradlew.bat :app:testReleaseUnitTest :app:assembleRelease` auf Windows beziehungsweise `./gradlew :app:testReleaseUnitTest :app:assembleRelease` auf macOS/Linux. Jetpack Compose nutzt Material 3 mit der Systempalette auf Android 12+ und einer Zuerst-Palette als Fallback. Mindestversion: Android 8.
- **iOS:** `ios/Zuerst.xcodeproj` in Xcode mit iOS-26-SDK öffnen und das Schema `Zuerst` im iPhone-Simulator starten. Der SwiftUI-Dock nutzt Apples Liquid Glass über einem bewegten Mesh; die Bedienung berücksichtigt reduzierte Bewegung und Transparenz. Für Gerätebuilds in Xcode ein Apple-Entwicklerteam wählen. Eine iOS-App wird über TestFlight/App Store oder mit passender Geräteprovisionierung verteilt; die APK ist ausschließlich für Android.

Bei Rezeptänderungen `npm run sync:native` ausführen und `shared/catalog.json` mit einchecken. `npm run sync:native -- --check` prüft die Übereinstimmung. Der GitHub-Workflow in `.github/workflows/native.yml` prüft die nativen Builds ohne Verteilungsschlüssel.

## Statisch veröffentlichen

Veröffentliche den **Inhalt** von `out/` inklusive `_next/` als Wurzel einer HTTPS-Website. Die App benötigt weder einen Node-Server noch Konfiguration oder Zugangsdaten. Die Startadresse ist die Wurzel der Website (`/`).

Für den APK-Download vor dem Webbuild die signierte, geprüfte Release-Datei nach `public/downloads/zuerst-android.apk` legen. Unter Windows erledigt `pwsh -File scripts/sign-android.ps1` Signatur und Prüfung nach `:app:assembleRelease`; `JAVA_HOME` und `ANDROID_HOME` müssen gesetzt sein, und Build Tools 36.0.0 müssen vorliegen. Der Schlüssel liegt im privaten Windows-Benutzerprofil. Für spätere APK-Updates denselben Schlüssel verwenden. Ohne APK blendet der Webbuild den Download aus.

Für Vercel: Nach `npm run build` erstellt `node scripts/stage-vercel.mjs` die statische Build-Ausgabe. Aus dem mit Zuerst verknüpften Projektordner kann sie mit `vercel deploy --prebuilt --prod` veröffentlicht werden.

## QR-Code für den Kühlschrank

Öffne die veröffentlichte HTTPS-Startadresse in Chrome und wähle **Speichern und teilen → QR-Code erstellen**. Lade den Code herunter und drucke ihn aus. Scanne ihn vor dem Aufhängen mit der Handykamera, am besten ohne WLAN: Der Link soll direkt die Zutatenauswahl öffnen.
