"use client";
import { useState } from "react";
import { authRequest } from "../../lib/cloud";
import "../journal.css";
export default function ResetPassword() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="journal-app">
      <main className="j-main">
        <a className="j-brand" href="/">
          <img src="/icon.svg" width="38" height="38" alt="" />
          Zuerst.
        </a>
        <h1>Neues Passwort</h1>
        <section className="j-panel">
          {done ? (
            <>
              <p>
                Dein Passwort wurde geändert. Melde dich mit dem neuen Passwort
                an.
              </p>
              <a href="/?tab=profile" className="j-primary">
                Zur App
              </a>
            </>
          ) : (
            <form
              className="j-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const password = String(
                  new FormData(e.currentTarget).get("password"),
                );
                const token = new URLSearchParams(location.search).get("token");
                if (!token) {
                  setMessage(
                    "Der Link ist unvollständig. Fordere im Profil eine neue E-Mail an.",
                  );
                  return;
                }
                setBusy(true);
                try {
                  await authRequest("reset-password", {
                    token,
                    newPassword: password,
                  });
                  setDone(true);
                } catch {
                  setMessage(
                    "Der Link ist abgelaufen oder ungültig. Fordere im Profil eine neue E-Mail an.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="j-field">
                Neues Passwort
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </label>
              <button className="j-primary" disabled={busy}>
                {busy ? "Wird gespeichert …" : "Passwort speichern"}
              </button>
            </form>
          )}
          {message && <p role="alert">{message}</p>}
        </section>
      </main>
    </div>
  );
}
