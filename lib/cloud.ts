export const authURL = 'https://ep-rapid-tooth-bav9j8t9.neonauth.c-8.eu-central-1.aws.neon.tech/zuerst/auth';
export const dataURL = 'https://ep-rapid-tooth-bav9j8t9.apirest.c-8.eu-central-1.aws.neon.tech/zuerst/rest/v1';
export type Account = { id: string; name: string; email: string };

export async function authRequest(path: string, body?: Record<string, string>): Promise<any> {
  const base = typeof location !== 'undefined' && location.hostname === 'zuerst.vercel.app' ? '/api/auth' : authURL;
  const response = await fetch(`${base}/${path}`, {
    method: body ? 'POST' : 'GET', credentials: 'include', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(authError(data.code));
  return data;
}
function authError(code: string): string {
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD': return 'E-Mail oder Passwort stimmt nicht.';
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL': case 'USER_ALREADY_EXISTS': return 'Für diese E-Mail gibt es bereits ein Konto. Melde dich an.';
    case 'PASSWORD_TOO_SHORT': return 'Verwende mindestens 8 Zeichen für dein Passwort.';
    case 'TOO_MANY_REQUESTS': return 'Zu viele Versuche. Warte kurz und versuche es erneut.';
    default: return 'Die Anfrage konnte nicht abgeschlossen werden. Prüfe deine Verbindung und versuche es erneut.';
  }
}
export async function backupRequest(method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<any> {
  const { token } = await authRequest('token');
  if (!token) throw new Error('Bitte melde dich erneut an.');
  const response = await fetch(`${dataURL}/kitchen_backups${method === 'POST' ? '?on_conflict=user_id' : '?select=payload,updated_at'}`, {
    method, cache: 'no-store', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: body ? JSON.stringify({ payload: body, updated_at: new Date().toISOString() }) : undefined,
  });
  if (!response.ok) throw new Error(response.status === 401 ? 'Bitte melde dich erneut an.' : 'Die Sicherung ist gerade nicht erreichbar. Deine lokalen Daten sind erhalten.');
  return response.status === 204 ? [] : response.json();
}
