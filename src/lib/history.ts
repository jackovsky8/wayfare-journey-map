import type { JourneyItem } from "../types";

export interface JourneyDiff {
  id: string;
  label: string;
  at: string;
  start: number;
  removed: JourneyItem[];
  added: JourneyItem[];
}

export const createItemsDiff = (
  before: JourneyItem[],
  after: JourneyItem[],
  label: string,
): JourneyDiff | undefined => {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    JSON.stringify(before[start]) === JSON.stringify(after[start])
  )
    start += 1;
  let beforeEnd = before.length - 1;
  let afterEnd = after.length - 1;
  while (
    beforeEnd >= start &&
    afterEnd >= start &&
    JSON.stringify(before[beforeEnd]) === JSON.stringify(after[afterEnd])
  ) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  const removed = before.slice(start, beforeEnd + 1);
  const added = after.slice(start, afterEnd + 1);
  if (!removed.length && !added.length) return undefined;
  return {
    id: crypto.randomUUID(),
    label,
    at: new Date().toISOString(),
    start,
    removed,
    added,
  };
};

export const applyDiff = (
  items: JourneyItem[],
  diff: JourneyDiff,
  direction: "forward" | "backward",
) => {
  const copy = [...items];
  const remove = direction === "forward" ? diff.removed : diff.added;
  const insert = direction === "forward" ? diff.added : diff.removed;
  copy.splice(diff.start, remove.length, ...insert);
  return copy;
};
