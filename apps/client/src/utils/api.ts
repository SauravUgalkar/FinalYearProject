export const API_BASE =
  // support common env names (Vite / CRA), fallback to localhost:5000 which your client currently calls
  (process.env.VITE_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5000');

export async function postJSON(path: string, body: any) {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include'
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: data };
    return data;
  } catch (err) {
    console.error('Network / API error', err);
    throw err;
  }
}