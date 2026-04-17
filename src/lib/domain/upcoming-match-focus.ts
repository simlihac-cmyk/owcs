import { RemainingMatchInsight } from "@/lib/types";

export type UpcomingMatchFocusMode = "today" | "upcoming" | "pending";

export interface UpcomingMatchFocus {
  dateKey: string;
  mode: UpcomingMatchFocusMode;
  matches: RemainingMatchInsight[];
}

function buildDateKeyFormatter(timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function toCalendarDateKey(value: Date | string, timeZone?: string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value.slice(0, 10) : "";
  }

  const parts = buildDateKeyFormatter(timeZone).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function getUpcomingMatchFocus(
  matches: RemainingMatchInsight[],
  options: { now?: Date; timeZone?: string } = {}
): UpcomingMatchFocus | null {
  if (matches.length === 0) {
    return null;
  }

  const { now = new Date(), timeZone } = options;
  const todayKey = toCalendarDateKey(now, timeZone);
  const groups = matches.reduce<Map<string, RemainingMatchInsight[]>>((accumulator, match) => {
    const dateKey = toCalendarDateKey(match.scheduledAt, timeZone);
    accumulator.set(dateKey, [...(accumulator.get(dateKey) ?? []), match]);
    return accumulator;
  }, new Map());
  const orderedKeys = Array.from(groups.keys()).sort((left, right) => left.localeCompare(right));
  const selectedKey =
    orderedKeys.find((dateKey) => dateKey === todayKey) ??
    orderedKeys.find((dateKey) => dateKey > todayKey) ??
    orderedKeys.filter((dateKey) => dateKey < todayKey).at(-1) ??
    orderedKeys[0];

  if (!selectedKey) {
    return null;
  }

  return {
    dateKey: selectedKey,
    mode: selectedKey === todayKey ? "today" : selectedKey > todayKey ? "upcoming" : "pending",
    matches: [...(groups.get(selectedKey) ?? [])].sort(
      (left, right) =>
        left.scheduledAt.localeCompare(right.scheduledAt) || right.importanceScore - left.importanceScore
    )
  };
}
