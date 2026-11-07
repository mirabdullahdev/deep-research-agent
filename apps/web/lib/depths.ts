import type { Depth } from "./types";

export const EXTRA_SEARCHES = 2;

export const DEPTHS: Record<
  Depth,
  { label: string; searches: number; rounds: number; time: string; blurb: string }
> = {
  quick: {
    label: "Quick",
    searches: 3,
    rounds: 0,
    time: "under a minute",
    blurb: "A fast pass over the essentials.",
  },
  standard: {
    label: "Standard",
    searches: 5,
    rounds: 1,
    time: "about a minute",
    blurb: "Broader coverage with one gap check.",
  },
  deep: {
    label: "Deep",
    searches: 8,
    rounds: 3,
    time: "a few minutes",
    blurb: "A wide sweep, three gap-filling rounds, a longer report.",
  },
};
