# Zuerst Plus – Stripe-Integration

Offizieller Stripe Implementation Planner am 5. November 2026 regulär aufgerufen und akzeptiert: `iguide_61VhrEWd78sWOcAb641GSP0oME5o8`.

- Hosted Checkout im Browser; keine Zahlungsdaten im App-Frontend.
- Plus: 1 EUR monatlich, 5 EUR jährlich, 10 EUR einmalig Lifetime. Ein Produkt, drei Preisvarianten, Endpreise inklusive gegebenenfalls anfallender Steuer.
- Gratis ohne Karte oder Konto. Plus wird erst nach serverseitig bestätigter Zahlung freigeschaltet.
- Flexible Billing; Customer Portal für Rechnungen, Zahlungsmittel, Preiswechsel und Kündigung zum Periodenende.
- Signierte Webhooks, atomare Deduplizierung und erneutes Lesen des aktuellen Stripe-Zustands. Keine Freischaltung anhand des Rücksprung-URLs.
- Servergebundene Kundenzuordnung über die verifizierte Neon-Auth-Sitzung. Test und Live besitzen getrennte Schlüssel, Preise, Webhooks und Datensätze.
- Gesundheitsjournal, Fotos und importierte Rezeptinhalte gehen nicht an Stripe und nicht in die Küchensicherung.
- Steuerpflicht/Registrierung und rechtlicher Anbieter sind offen. `automatic_tax` bleibt deaktiviert. Der Checkout setzt `managed_payments.enabled=false`, weil Managed Payments kontoseitig voreingestellt war und dessen Grundlagen nicht bestätigt sind.
- Aktuell verbindet das Plugin nur Zuerst. Sandbox. Live wird erst nach tatsächlicher Kontoverfügbarkeit, Händlerbereitschaft, Anbieterfreigabe und bestandenen Integrationstests aktiviert.

Blueprints: `subscription-billing-checkout` und `customer-portal-integration-accounts-v2`. Die konkrete Integration verwendet vorhandene Customers v1, die vom Customer Portal weiterhin unterstützt werden; keine Connect-Plattform.

Quellen: [Checkout/Billing](https://docs.stripe.com/payments/checkout/build-subscriptions), [Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal), [Webhooks](https://docs.stripe.com/webhooks), [Steuern](https://docs.stripe.com/billing/taxes/collect-taxes).

## Umsetzung und Testnachweis

`api/billing.ts`, `api/stripe-webhook.ts` und `server/billing.ts` implementieren die Integration. Die private Neon-Struktur trennt Test-/Live-Kunden, Checkout-Anfragen und verarbeitete Events. Authentifizierung erfolgt über bestätigte Neon-Session-Cookies. Bloßes Öffnen legt keinen Stripe-Customer an. Checkout benötigt ausdrückliche Volljährigkeitsbestätigung und `termsVersion=2026-11-05.1`; beides wird im privaten Checkout-Audit erfasst.

Stripe Node 23.1.0 verwendet API 2026-10-28.endive. Alle drei Hosted-Checkout-Varianten wurden in der echten Sandbox bezahlt und serverseitig bestätigt. Lifetime-Erstattung, Portal-Kündigung, Zahlungsfehler und Webhook-Replay wurden geprüft. Details und klare Prüfgrenzen: `server/BILLING-TEST-RESULTS.json`.

Die öffentliche Stripe→Vercel-Auslieferung und der vollständige Browserablauf mit echter Neon-Sitzung werden nach der koordinierten App-Veröffentlichung geprüft. Live ist gesperrt. Steuerpflicht/Registrierungen und Anbieterfreigabe bleiben offen; technische Tests ersetzen diese Freigaben nicht.
