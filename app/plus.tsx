"use client";
import { useState, useEffect, useRef } from "react";
import { Check } from "lucide-react";
import {
  plans,
  billingTermsVersion,
  type Plan,
  type Entitlement,
} from "../lib/billing-policy";
import type { Account } from "../lib/cloud";
import type { Wellness } from "../lib/wellness";
import { WellnessCard as Card } from "./wellness";
export async function billingRequest(action: string, body?: unknown) {
  const response = await fetch(`/api/billing?action=${action}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Zahlungsanbindung nicht erreichbar.");
  return result;
}
export function useEntitlement(account: Account | null) {
  const [value, setValue] = useState<Entitlement | null>(null);
  const [mode,setMode] = useState<'test'|'live'|null>(null);
  useEffect(() => {
    let active = true;
    setValue(null);
    if (account)
      Promise.all([billingRequest("status"),billingRequest("entitlement")])
        .then(([status,data]) => {
          if (active) {setMode(status.ready?status.mode:null);setValue(status.ready&&status.mode===data.mode?data:null);}
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [account?.id]);
  return { value:value?.mode===mode?value:null, setValue:(next:Entitlement|null)=>setValue(next?.mode===mode?next:null) };
}
export function PlusPage({
  account,
  state,
  onLogin,
  entitlement,
  refresh,
}: {
  account: Account | null;
  state: Wellness;
  onLogin: () => void;
  entitlement: Entitlement | null;
  refresh: (value: Entitlement | null) => void;
}) {
  const [ready, setReady] = useState(false),
    [mode, setMode] = useState("test"),
    [plan, setPlan] = useState<Plan>("year"),
    [busy, setBusy] = useState(false),
    [adult, setAdult] = useState(false),
    [terms, setTerms] = useState(false),
    [message, setMessage] = useState("");
  const minor = !!state.profile && state.profile.age < 18;
  const requestIds=useRef<Partial<Record<Plan,string>>>({});
  useEffect(() => {
    let active = true;
    billingRequest("status")
      .then((data) => {
        if (active) {
          setReady(data.ready);
          setMode(data.mode);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function open(action: "checkout" | "portal") {
    if (!account) {
      onLogin();
      return;
    }
    if (action === "checkout" && (!adult || !terms || minor)) return;
    setBusy(true);
    try {
      const result = await billingRequest(
        action,
        action === "checkout"
          ? {
              plan,
              requestId: requestIds.current[plan] ??= crypto.randomUUID(),
              adultConfirmed: true,
              termsVersion: billingTermsVersion,
            }
          : {},
      );
      const url = new URL(result.url);
      if (
        url.protocol !== "https:" ||
        !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)
      )
        throw Error("Zahlungsadresse konnte nicht bestätigt werden.");
      location.assign(url.href);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Zahlung nicht erreichbar.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="w-stack">
      <Card tone="trend">
        <h2>Mehr Komfort. Gleiche Freiheit.</h2>
        <p>
          Plus ergänzt 30- und 90-Tage-Vergleiche, automatische Planung für bis
          zu vier Wochen, wiederverwendbare Vorlagen und den gemeinsamen
          Einkauf.
        </p>
        <p>
          Gratis bleiben Lebensmittelsuche, lokale Fotosuche, Journal, Wasser,
          Gerätedaten, Wochenübersicht, Rezeptimporte und vollständiger
          Datenexport. Kein Konto nötig.
        </p>
        <p>
          Alle Plus-Varianten enthalten dieselben Funktionen. Kostenpflichtige
          Cloud-KI ist nicht enthalten.
        </p>
        {!ready ? (
          <p className="w-feedback">
            Plus-Vorschau · Käufe noch nicht erhältlich.
          </p>
        ) : mode === "test" ? (
          <p className="w-feedback">
            Sandbox-Test · keine echten Zahlungen. Nur Testzahlungsdaten
            verwenden. Testzugang gilt ausschließlich im Testmodus.
          </p>
        ) : null}
        {entitlement?.plus && (
          <p role="status">
            Plus ist aktiv
            {entitlement.plan === "lifetime"
              ? " · Lifetime"
              : entitlement.until
                ? ` bis ${new Date(entitlement.until * 1000).toLocaleDateString("de-DE")}`
                : ""}
            {entitlement.cancelAtPeriodEnd
              ? " · gekündigt zum Periodenende"
              : ""}
            .
          </p>
        )}
      </Card>
      <Card>
        <h2>Deine Variante</h2>
        <div
          className="w-price-options"
          role="radiogroup"
          aria-label="Plus-Variante"
        >
          {(Object.keys(plans) as Plan[]).map((id) => (
            <button
              role="radio"
              aria-checked={plan === id}
              onClick={() => setPlan(id)}
              key={id}
            >
              <strong>{plans[id].label}</strong>
              <span>
                {id === "month"
                  ? "Monatlich kündbar"
                  : id === "year"
                    ? "Jährlich kündbar"
                    : "Für die Laufzeit dieses Produkts"}
              </span>
              <Check size={20} style={{ opacity: plan === id ? 1 : 0 }} />
            </button>
          ))}
        </div>
        <p>
          Monat und Jahr verlängern sich automatisch bis zur Kündigung zum Ende
          der bezahlten Periode. Lifetime ist eine Einmalzahlung. Endpreise in
          Euro.
        </p>
        {minor ? (
          <p>Eigene Käufe sind ab 18 verfügbar.</p>
        ) : (
          <>
            <label className="w-check">
              <input
                type="checkbox"
                checked={adult}
                onChange={(e) => setAdult(e.target.checked)}
              />
              Ich bin mindestens 18 Jahre alt.
            </label>
            <label className="w-check">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              <span>
                Ich habe die{" "}
                <a href="/datenschutz/">Nutzungs- und Datenschutzhinweise</a>{" "}
                gelesen. Preis- und Vertragsdetails werden vor Abschluss
                gezeigt.
              </span>
            </label>
          </>
        )}
        <button
          className="j-primary"
          disabled={
            busy || !ready || minor || !!entitlement?.plus || !adult || !terms
          }
          onClick={() => void open("checkout")}
        >
          {!ready
            ? "Noch nicht erhältlich"
            : !account
              ? "Für Plus anmelden"
              : mode === "test"
                ? "Test-Checkout öffnen"
                : "Zur sicheren Zahlung"}
        </button>
      </Card>
      <Card>
        <h2>Zugang verwalten</h2>
        <p>
          Die Freischaltung wird vom Server bestätigt. Die Rückkehr von der
          Zahlungsseite allein schaltet Plus nicht frei.
        </p>
        {account ? (
          <>
            <button
              className="j-secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await billingRequest("entitlement");
                  refresh(result);
                  setMessage(
                    result.plus
                      ? "Plus-Zugang bestätigt."
                      : "Kein bezahlter Zugang bestätigt.",
                  );
                } catch {
                  setMessage("Status momentan nicht erreichbar.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Status aktualisieren
            </button>
            <button
              className="j-secondary"
              disabled={busy || !ready}
              onClick={() => void open("portal")}
            >
              Abo & Rechnungen verwalten
            </button>
          </>
        ) : (
          <button className="j-secondary" onClick={onLogin}>
            Zum Konto
          </button>
        )}
        <p className="w-note">
          Für native Store-Veröffentlichungen wird eine gesonderte
          Store-Zahlungsanbindung benötigt.
        </p>
        {message && (
          <p role="status" className="w-feedback">
            {message}
          </p>
        )}
      </Card>
    </div>
  );
}
