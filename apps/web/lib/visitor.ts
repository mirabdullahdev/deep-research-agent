const KEY = "visitor-id";

export function visitorId(): string {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved) return saved;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}
