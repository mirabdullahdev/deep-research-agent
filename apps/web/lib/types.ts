export interface SearchItem {
  query: string;
  reason: string;
}

export interface SourceRef {
  n: number;
  url: string;
  title: string;
}

export type ServerEvent =
  | { type: "stage"; stage: string }
  | { type: "plan"; searches: SearchItem[] }
  | {
      type: "agent";
      event: "start" | "reading" | "done" | "error";
      question: string;
      reason?: string;
      findings?: number;
      detail?: string;
    }
  | { type: "source"; question: string; url: string; title: string }
  | { type: "gaps"; searches: SearchItem[] }
  | { type: "report"; delta: string }
  | { type: "sources"; sources: SourceRef[] }
  | { type: "usage"; spent_usd: number; cap_usd: number }
  | {
      type: "done";
      report: string;
      spent_usd: number;
      tokens_in: number;
      tokens_out: number;
    }
  | { type: "error"; detail: string };
