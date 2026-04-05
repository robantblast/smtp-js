const DEFAULT_TIMEZONE = "America/New_York";

interface TimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getTimeZoneParts(date: Date, timeZone: string): TimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUtc - date.getTime();
}

function buildDateInTimeZone(parts: TimeParts, timeZone: string): Date {
  const utcDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  );
  const offsetMs = getTimeZoneOffsetMs(utcDate, timeZone);
  return new Date(utcDate.getTime() - offsetMs);
}

function parseDateTimeInput(value: string, timeZone: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const parts: TimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: match[6] ? Number(match[6]) : 0
  };

  return buildDateInTimeZone(parts, timeZone);
}

export function resolveBaseDateTime(value?: string, timeZone = DEFAULT_TIMEZONE): Date {
  if (!value) return new Date();

  const parsed = parseDateTimeInput(value, timeZone);
  if (parsed) return parsed;

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) return fallback;

  return new Date();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatWeekdayDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatMonthDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "2-digit",
    year: "numeric"
  }).format(date);
}

function startOfMonth(date: Date, timeZone: string): Date {
  const parts = getTimeZoneParts(date, timeZone);
  return buildDateInTimeZone(
    {
      year: parts.year,
      month: parts.month,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0
    },
    timeZone
  );
}

export function applyLegacyDateReplacements(
  template: string,
  baseDate: Date,
  timeZone = DEFAULT_TIMEZONE
): string {
  let result = template;

  const date0 = baseDate;
  const dateMinus50 = addDays(baseDate, -50);
  const dateMinus55 = addDays(baseDate, -55);

  // result = result.replace(/Wednesday, March 25, 2026/g, formatWeekdayDate(date0, timeZone));
  // result = result.replace(/Wednesday, February 04, 2026/g, formatWeekdayDate(dateMinus50, timeZone));
  // result = result.replace(/Friday, January 30, 2026/g, formatWeekdayDate(dateMinus55, timeZone));
  result = result.replace(/January 31, 2026/g, formatMonthDate(date0, timeZone));

  const periodStart = startOfMonth(date0, timeZone);
  const periodStartText = formatMonthDate(periodStart, timeZone);
  const periodEndText = formatMonthDate(date0, timeZone);

  result = result.replace(
    /January 1st through January 31st, 2026/g,
    `${periodStartText} through ${periodEndText}`
  );

  return result;
}

export const US_EASTERN_TIMEZONE = DEFAULT_TIMEZONE;
