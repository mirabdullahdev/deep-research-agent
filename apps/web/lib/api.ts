import type { ServerEvent } from "./types";
import { visitorId } from "./visitor";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const headers = () => ({ "Content-Type": "application/json", "X-Visitor-Id": visitorId() });

async function toError(res: Response): Promise<Error> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return new Error(body.detail);
  } catch {}
  if (res.status === 422) {
    return new Error("Something in the request was out of bounds. Check the plan and try again.");
  }
  return new Error(`The server returned an error (${res.status}).`);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the research server. Is the API running?");
  }
  if (!res.ok) throw await toError(res);
  return res.json();
}

export const makePlan = (topic: string) => post<{ steps: string[]; reply: string }>("/api/plan", { topic });

export interface RunRequest {
  topic: string;
  steps: string[];
}

export async function* streamResearch(
  body: RunRequest,
  signal: AbortSignal,
): AsyncGenerator<ServerEvent> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/research`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal.aborted) return;
    throw new Error("Can't reach the research server. Is the API running?");
  }
  if (!res.ok || !res.body) throw await toError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      if (data) yield JSON.parse(data) as ServerEvent;
    }
  }
}
