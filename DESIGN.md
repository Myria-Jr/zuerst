# Zuerst – Gestaltungsgrundlage

Modus: Operate. Verbindlicher Hybrid: Google Pixel / Material You / Google Health als Kern, Apple-inspirierte Liquid-Glass-Akzente ausschließlich an der Navigation. Großzügige, ruhige Flächen, präzise Beschriftungen, große Tippflächen und echte persönliche Daten. Hellmodus ist ausdrücklich vorgegeben und bleibt auch bei dunkler Systemeinstellung aktiv. Weiße Karten und ein sehr heller neutraler Hintergrund tragen Aubergine, Pistazie und Lavendel als Akzente.

- Android: Material 3, helle dynamische Systempalette, schwebende Glasnavigation mit fünf Bereichen. Auf erweiterten Breiten wird daraus eine seitliche NavigationRail. Haze 1.1.1 passt zum bestehenden Kotlin-/Compose-Stack, liest den tatsächlichen Inhalt hinter der Navigation und nutzt bei nicht unterstützter Unschärfe eine stark deckende Fläche. Karten und Bedienelemente bleiben Material.
- iOS: Systemschrift und semantische helle Farben, große Navigationstitel, fünf native Tabs, Formulare und Sheets. System-Liquid-Glass an Navigation und Koch-Dock bleibt erhalten.
- Web: Geist, 48–50 px hohe Hauptaktionen, sichtbarer Tastaturfokus und feste helle Darstellung. Desktop nutzt eine Seitenleiste; mobil eine transluzente Daumennavigation mit echtem CSS-Backdrop-Blur und deckendem Fallback bei reduzierter Transparenz.
- Hauptbereiche: Heute, Rezepte, Vorrat, Plan, Verlauf. Das Profil öffnet über die Kopfzeile; Einkauf gehört zum Plan.
- Standardzustand zeigt echte Nullen und hilfreiche nächste Schritte. Diagramme stellen nur eingetragene Gerichte dar. Bewegung unterstützt Zustandswechsel und wird bei reduzierter Bewegung abgeschaltet.
