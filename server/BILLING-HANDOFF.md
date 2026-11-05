# Billing-Handoff an den App-Chat

Stand 5. November 2026. Ab Koordinationsnachricht werden hier nur `api/billing.ts`, `api/stripe-webhook.ts`, `server/*`, `lib/billing-policy*`, `docs/STRIPE-PLAN.md` bearbeitet. Keine Deployments/Commits.

Vor Aufteilung neu angelegt: `app/wellness.tsx` (noch nicht eingebunden; importiert noch fehlende `wellness.css`), `lib/food-photo.ts`, `lib/wellness.test.ts`; `lib/wellness.ts` wurde gehärtet. Diese Dateien gehören nun vollständig dem App-Chat. Frühere Altersregel war ab18, bitte gemäß neuem Nutzerplan auf ab16 ohne Kalorienanzeigen unter18 anpassen. White Mode aus altem Brief wurde noch nicht durch neue Hell/Dunkel/System-Entscheidung ersetzt.

Dependencies bereits installiert und im Lockfile: `stripe` 23.1.0 (Standard-API 2026-10-28.endive), `pg` 8.23.1, `@types/pg` 8.23.1; TensorFlow 4.22.0 exakt gepinnt. Alle früheren npm-Prozesse beendet, keine weiteren Installationen geplant.

## API-Vertrag

- `GET /api/billing?action=status` → `{ready:boolean,mode:"test"|"live",termsVersion:"2026-11-05.1"}`. Nicht authentifiziert; keine Secrets.
- `GET /api/billing?action=entitlement` → `{plus,plan,status,until,cancelAtPeriodEnd,mode}`. Authentifizierung über kanonischen first-party Neon-Session-Cookie. Keine Freischaltung aus URL/LocalStorage.
- `POST /api/billing?action=checkout`, JSON `{plan:"month"|"year"|"lifetime",requestId:crypto.randomUUID(),adultConfirmed:true,termsVersion:"2026-11-05.1"}` → `{url,mode}`. Derselbe Request bei Retry. 401 ohne Konto, 403 ohne ausdrückliche Volljährigkeitsbestätigung, 400 bei alter Bedingungenversion, 409 bei bestehendem Plus. Gültiger Origin muss `https://zuerst.vercel.app` sein. Minderjährige dürfen diesen Aufruf in der UI nicht erhalten. Alter wird nicht an Stripe übergeben.
- `POST /api/billing?action=portal`, JSON `{}` → `{url}`. Gleiche Auth-/Origin-Regeln.
- Fehler `{error:string}`, sichere deutsche Meldungen, kein interner Fehler-/Secretdump.
- Rückkehr `/?tab=plus&checkout=returned` oder `canceled`; nach Rückkehr `entitlement` erneut lesen, nicht Plus anhand des Query-Parameters aktivieren.
- Webhook `/api/stripe-webhook`: raw body, Signaturprüfung, Modusprüfung, Deduplizierung im DB-Transaction-Lock; bezahlt/gekündigt/erstattet/disputed wird anhand aktuellen Stripe-Zustands neu geprüft.

Derzeit unterstützt Billing Web-Session-Cookies; native Cookie/Session-Anbindung muss explizit mit dem vorhandenen nativen Konto getestet werden. Keine native Secret-/Stripe-SDK-Integration einbauen. Test-/Live-Käufe sind serverseitig getrennt.

## Externe Konfiguration

Nutzer hat Übertragung von Neon-DB-URL und anschließend Stripe-Webhook-Secret ausdrücklich für Produktion+Preview freigegeben. Beide sind als sensitive Vercel-Variablen gespeichert. Der vom Nutzer im Chat übermittelte Sandbox-Schlüssel ist ebenfalls sensitive gespeichert; er soll durch einen eingeschränkten Schlüssel ersetzt/rotiert werden. Keine Secrets in Dateien.

`STRIPE_MODE=test`; alle drei Testpreise und Testportal-Konfiguration gesetzt. Privates DB-Schema `billing` mit Accounts, Checkouts, Events angelegt; PUBLIC erhält keinen Zugriff. Keine Küchen-/Gesundheitstabellen verändert.

Nur `Zuerst. Sandbox` verbunden; kein Live-Zugriff. Anbieter-/Steuerfreigabe offen. `BILLING_LIVE_APPROVED` bleibt ungesetzt. Keine Live-Aktivierung behaupten.

## Vercel-Konfiguration nötig

Bestehende `api/*.ts` werden als Vercel-Funktionen bereitgestellt. Kein zusätzlicher Rewrite für Billing nötig (`?action=`). Bitte `functions`-Konfiguration für `/api/billing.ts` und `/api/stripe-webhook.ts` auf maximal zulässige Laufzeit (mindestens 60 Sekunden) setzen, da Status mit Stripe abgeglichen wird. Health-Fotos nie an Server senden.

Teststand wird nach Sandbox-Integrationstests hier ergänzt.

## API-Aktualisierung nach Koordination

`GET entitlement` wurde korrigiert: kein Stripe-Customer und keine E-Mail-Übertragung beim bloßen Öffnen. Ohne bestehende Zuordnung sofort `free`; auch Portal erzeugt keinen neuen Customer.

Checkout benötigt zusätzlich `adultConfirmed:true` und `termsVersion:"2026-11-05.1"`. `billingTermsVersion` wird aus `lib/billing-policy.ts` exportiert und im Status-Endpunkt als `termsVersion` geliefert. Die private Checkout-Tabelle auditiert Version und Bestätigungszeitpunkt; es wird keine Alterszahl gespeichert oder zu Stripe gesendet. Diese technisch vorhandene Bedingungenversion ist keine rechtliche Anbieter-/Live-Freigabe.

`@types/pg` ist tatsächlich 8.23.1. Alle 8 gezielten Billing-/Auth-Tests bestanden. Testkonfiguration und Signatur-/echte Sandbox-Checks folgen.

## Zwischenstand echter Sandbox-Tests

- Offizieller Hosted Checkout wurde für alle drei Preise vollständig mit offiziellen Stripe-Testkarten abgeschlossen. Server-Refresh ergab `plus:true` mit `plan:month`, `plan:year`, `plan:lifetime`; Centbeträge 100/500/1000 von Stripe bestätigt.
- Ein erneuter Kauf bei bestehendem Plus wurde abgewiesen.
- Lifetime komplett erstattet; Server-Refresh ergab `plus:false,status:unpaid_or_refunded`.
- Monatsabo im echten Customer Portal zum Periodenende gekündigt. Aktuelle flexible Billing-API setzt dabei `cancel_at`, während `cancel_at_period_end=false` bleibt. Der Server berücksichtigt jetzt beide Felder und kürzt `until` auf das effektive Kündigungsdatum.
- Manipulierte Signatur wird abgewiesen. Weitere Replay-/Ausfalltests folgen.
- Es wurde nichts deployed und nichts committed. Das konfigurierte Webhook-Ziel liefert bis zur Veröffentlichung noch keinen neuen Handler; reale öffentliche Stripe→Vercel-Auslieferung ist deshalb erst nach deinem Deployment endgültig prüfbar.
- Testentitlements haben `mode:test`; Live liest ausschließlich Datensätze und Stripe-Objekte mit `mode:live` und sperrt ohne `BILLING_LIVE_APPROVED=true`. Der Client muss die Entitlement-Umgebung an die Status-Umgebung binden und Sandbox sichtbar markieren.

## Finale Übergabe

Backend-Arbeit abgeschlossen, keine parallelen Commits/Deployments. **Checkout-Bedingungenversion: `2026-11-05.1`**. Die finalen API-Formate stehen oben. Alle Preise und Secrets liegen in Vercel; keine Secrets in Quellen/Logs. Der offizielle Planner wurde ohne Umgehung akzeptiert. Externe Tests und offene Prüfgrenzen stehen maschinenlesbar in `server/BILLING-TEST-RESULTS.json`.

Zusätzlich tatsächlich geprüft: Abo-Zahlungsfehler (`past_due` → `plus:false`), endgültige Testabo-Kündigung (`canceled` → `plus:false`), gleichzeitige Webhook-Duplikate (beide HTTP200, genau eine Event-Zeile), manipulierte Signatur (400), falsch signierter Umgebungsinhalt (400), Checkout-Wiederholung und Tarifwechsel mit Ablauf der alten Sitzung. Offene Checkout-Sitzungen schalten kein Plus frei.

11 gezielte HTTP-/Policy-/Auth-Tests bestanden. TypeScript-Check bestanden. Aufruf für deinen Gesamtcheck: `node --test server/billing.test.ts lib/billing-policy.test.ts lib/auth-proxy.test.ts`; `npm test` enthält aktuell nur `lib/*.test.ts`, bitte bei deinem finalen Paket-Update `server/*.test.ts` ergänzen. Keine weiteren Dependencies nötig.

Die Rolle von `ready` ist **technische Konfiguration der ausgewählten Umgebung**, keine Rechts-/Live-Freigabe. Test-Plus darf zur Sandbox-Vorschau verwendet werden, sofern `entitlement.mode === status.mode === "test"` und die UI sichtbar Sandbox ausweist. Live kann niemals auf Testentitlements zurückfallen.

Vor tatsächlichem Live: öffentlich zugestellte Webhooks nach deinem Deployment prüfen, echten Neon-Login→Checkout→Rückkehr einmal testen, native Sitzungsbindung prüfen, rechtliche Anbieter-/Steuergrundlagen bestätigen und Live-Konto regulär verbinden. Smart-Retries-/E-Mail-Einstellungen wurden empfohlen, aber nicht als aktiviert ausgegeben. Der veröffentlichte Handler wird im App-Chat nach Deployment geprüft. Alle Testprozesse dieses Chats sind beendet.
