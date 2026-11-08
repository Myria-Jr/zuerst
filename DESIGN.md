# Zuerst – Gestaltungsgrundlage

Modus: Operate. Verbindlicher Hybrid: Google Pixel / Material You / Google Health als Kern, Apple-inspirierte Liquid-Glass-Akzente ausschließlich an der Navigation. Großzügige, ruhige Flächen, präzise Beschriftungen, große Tippflächen und echte persönliche Daten. Version 1.3: System ist Standard; Hell und Dunkel lassen sich kostenlos dauerhaft wählen. Feste Farbpaare für Bewegung (Mint/Petrol), Ernährung (Apricot/Terrakotta), Küche (Pistazie/Oliv), Wasser (Himmel-/Tiefblau) und Auswertungen (Flieder/Violett). Android-Systemfarben vereinheitlichen diese Bereiche nicht.

- Android: Material 3, feste semantische Hell-/Dunkelpalette, schwebende Glasnavigation mit fünf Bereichen. Auf erweiterten Breiten wird daraus eine seitliche NavigationRail. Haze 1.1.1 passt zum bestehenden Kotlin-/Compose-Stack, liest den tatsächlichen Inhalt hinter der Navigation und nutzt bei nicht unterstützter Unschärfe eine stark deckende Fläche. Karten und Bedienelemente bleiben Material.
- iOS: Systemschrift und semantische Hell-/Dunkelfarben, große Navigationstitel, fünf native Tabs, Formulare und Sheets. System-Liquid-Glass an Navigation und Koch-Dock bleibt erhalten.
- Web: Geist, 48–50 px hohe Hauptaktionen, sichtbarer Tastaturfokus und Hell/Dunkel/System. Desktop nutzt eine Seitenleiste; mobil eine transluzente Daumennavigation mit echtem CSS-Backdrop-Blur und deckendem Fallback bei reduzierter Transparenz.
- Hauptbereiche: Heute, Essen, Rezepte, Vorrat, Mehr. Das Profil öffnet über die Kopfzeile; Plan, Einkauf, Kochverlauf, Gesundheitsdetails, Plus und Einstellungen liegen unter Mehr.
- Standardzustand zeigt echte Nullen und hilfreiche nächste Schritte. Diagramme stellen nur eingetragene Gerichte dar. Bewegung unterstützt Zustandswechsel und wird bei reduzierter Bewegung abgeschaltet.

- Auswahlpillen: mindestens 48 dp, 8 dp horizontaler und 10 dp vertikaler Abstand; keine Größenänderung im Auswahlzustand.
- Navigation 200 ms, Zahlen 320 ms. Keine Dauerdekoration. Reduzierte Bewegung deaktiviert räumliche Animationen; reduzierte Transparenz beziehungsweise Android-Schalter liefert deckende Navigation.
- Gesundheitswerte ohne Quelle oder Messung bleiben unbekannt. Lokale Zählwerte zeigen ausdrücklich nur protokollierte Einträge.
- Version 1.5: Heute beginnt mit einem konkreten nächsten Kochschritt, gefolgt von kurzen Eintragswegen und kompakten, optional ausgeblendeten Kennzahlen. Journal-Aktivierung ist freiwillig und klar erreichbar. Keine doppelt gestapelten Werbekarten. Rezeptlinks sind ohne Konto nutzbar, Wiederholportionen verlangen eine erneute Bestätigung.
