import Link from "next/link";
export const metadata = { title: "Datenschutz & Nutzung · Zuerst" };
export default function PrivacyPage() {
  return (
    <main className="w-legal">
      <Link href="/?tab=privacy">← Zurück zu Zuerst</Link>
      <h1>Deine Daten. Deine Entscheidung.</h1>
      <p>
        Stand: 5. November 2026. Zuerst ist ein Küchen- und Alltagsjournal im
        Projekt Odkaz Labs. „Vora“ ist ein Studio-Arbeitsname, keine behauptete
        eingetragene Firma.
      </p>
      <h2>Lokale Nutzung</h2>
      <p>
        Rezepte funktionieren ohne Anmeldung. Vorrat, Einkauf, Kochverlauf und
        Darstellung werden auf deinem Gerät gespeichert. Das freiwillige
        Gesundheitsjournal liegt getrennt davon. Fotos werden lokal analysiert
        und nicht an einen Bildanalyse-Dienst hochgeladen. Das lokale Web-Modell
        wird beim ersten Foto geladen. Android kann dafür ein Modell über Google
        Play-Dienste beziehen; das Foto bleibt auf dem Gerät.
      </p>
      <h2>Freiwilliges Gesundheitsjournal</h2>
      <p>
        Ab 16 Jahren kannst du Alter in Jahren, bestätigte Lebensmittelmengen
        und Getränke auf diesem Gerät speichern. Ein Geburtsdatum ist nicht
        erforderlich. Unter 18 zeigt Zuerst keine Kalorienübersicht oder
        Abnehmziele und bietet keine eigenen Plus-Käufe an. Es gibt keine
        persönlichen Energy-Drink-Budgets. Freigabe, Export und Löschung findest
        du unter Mehr → Darstellung & Datenschutz.
      </p>
      <p>
        Health Connect und CoreMotion werden nur nach gesonderter Gerätefreigabe
        gelesen. Fehlende Werte bleiben unbekannt. Quellen und Zeitpunkte werden
        bei Gerätedaten angezeigt. Gesundheitsdaten sind nicht Bestandteil der
        optionalen Küchensicherung.
      </p>
      <h2>Konto und Küchensicherung</h2>
      <p>
        Bei freiwilliger Anmeldung werden E-Mail und Kontodaten über Neon Auth
        verarbeitet. Die optionale Küchensicherung wird in der EU gespeichert.
        Notwendige Sitzungscookies ermöglichen die Anmeldung. Es gibt keine
        Werbe- oder Analyse-Cookies und keinen Zwang, optionale Cookies zu
        akzeptieren. Browser- und Hostingdienste verarbeiten technisch
        erforderliche Verbindungsdaten zur Bereitstellung und Absicherung der
        Seite.
      </p>
      <h2>Zahlungen</h2>
      <p>
        Stripe Checkout und das Kundenportal öffnen sich erst nach deiner
        bewussten Auswahl. Dabei werden Konto- und Zahlungsinformationen zur
        Abwicklung des gewählten Angebots verarbeitet. Sandbox-Käufe sind
        ausschließlich Tests. Reale Verkäufe werden erst nach vollständiger
        Anbieter-, Steuer- und Vertragsfreigabe aktiviert. Die Plus-Preise sind
        1 € monatlich, 5 € jährlich oder 10 € einmalig für die Laufzeit des
        Produkts. Bis zur Live-Freigabe ist dies eine Vorschau und kein
        verfügbares Live-Angebot.
      </p>
      <h2>Rezeptimporte und Nährwerte</h2>
      <p>
        Importiere nur Inhalte, die du für deine persönliche Rezeptsammlung
        verwenden darfst. Original-Links bleiben erhalten. Die App ruft keine
        privaten Social-Media-Inhalte ab. Mengen, Zutaten, Allergene und
        Zubereitung prüfst du selbst. Nährwerte stammen aus USDA FoodData
        Central und sind Referenzwerte. Eine Foto-Suchhilfe ersetzt keine
        gewogene Menge. Zuerst ist kein Medizinprodukt und erstellt keine
        Diagnose, Behandlung oder individuelle Ernährungstherapie.
      </p>
      <h2>Deine Rechte und Kontakt</h2>
      <p>
        Du kannst lokale Daten jederzeit exportieren und löschen und freiwillige
        Gerätefreigaben in den Systemeinstellungen widerrufen. Kontoanfragen
        sowie Auskunft, Berichtigung, Löschung und Datenschutzanfragen:{" "}
        <a href="mailto:myriajr@gmx.net">myriajr@gmx.net</a>. Ein
        Beschwerderecht bei der zuständigen Datenschutzaufsicht bleibt bestehen.
      </p>
      <h2>Anbieterstatus</h2>
      <p>
        Die vollständigen rechtlichen Anbieterangaben und Verkaufsbedingungen
        sind noch nicht freigegeben. Deshalb bleibt der Live-Verkauf gesperrt.
        Hier werden keine erfundenen Adressen, Rechtsformen oder
        Firmenregisterangaben veröffentlicht.
      </p>
      <Link href="/?tab=privacy">Speicher verwalten</Link>
    </main>
  );
}
