// When the daily and weekly digests are due. Pure TypeScript with no Deno or
// Node imports, so the digest-dispatch edge function and Vitest share it.
//
// Every time on the Settings page is wall-clock IST (Asia/Kolkata). IST has a
// fixed +05:30 offset and no daylight saving, so this is plain arithmetic.

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DigestSettings {
  daily_digest_enabled: boolean;
  daily_digest_time: string;
  weekly_digest_enabled: boolean;
  /** 0 = Sunday ... 6 = Saturday. */
  weekly_digest_day: number;
  weekly_digest_time: string;
}

export interface IstNow {
  /** "YYYY-MM-DD" in IST. */
  date: string;
  /** Minutes since midnight IST. */
  minutes: number;
  /** 0 = Sunday ... 6 = Saturday, in IST. */
  weekday: number;
}

export function istNow(now: Date): IstNow {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** "19:30" as minutes since midnight, or null when it is not a valid HH:MM. */
export function parseTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** The instant 00:00 IST on a "YYYY-MM-DD" date. */
export function istMidnight(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MS);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export interface DueDigest {
  kind: "daily" | "weekly";
  /** The log key: the IST date the digest is for. */
  periodStart: string;
  /** The time on Settings this digest was due at, "HH:MM" IST. Stored with the log row. */
  scheduledTime: string;
  /** The window the digest counts, [from, to). */
  from: Date;
  to: Date;
  /** The window before it, for the weekly comparison. */
  previousFrom: Date | null;
  previousTo: Date | null;
}

/**
 * Digests whose time has passed today and that have not been sent yet is the
 * caller's check (it holds the log); this only says what is due by the clock.
 *
 * Daily: today so far, from midnight IST to now. Weekly: the seven complete days
 * before today, set against the seven before those.
 */
export function dueDigests(now: Date, settings: DigestSettings): DueDigest[] {
  const ist = istNow(now);
  const due: DueDigest[] = [];

  const dailyAt = parseTime(settings.daily_digest_time);
  if (settings.daily_digest_enabled && dailyAt !== null && ist.minutes >= dailyAt) {
    due.push({
      kind: "daily",
      periodStart: ist.date,
      scheduledTime: settings.daily_digest_time,
      from: istMidnight(ist.date),
      to: now,
      previousFrom: null,
      previousTo: null,
    });
  }

  const weeklyAt = parseTime(settings.weekly_digest_time);
  if (
    settings.weekly_digest_enabled &&
    weeklyAt !== null &&
    ist.weekday === settings.weekly_digest_day &&
    ist.minutes >= weeklyAt
  ) {
    const from = istMidnight(addDays(ist.date, -7));
    const to = istMidnight(ist.date);
    due.push({
      kind: "weekly",
      periodStart: ist.date,
      scheduledTime: settings.weekly_digest_time,
      from,
      to,
      previousFrom: istMidnight(addDays(ist.date, -14)),
      previousTo: from,
    });
  }

  return due;
}

/**
 * Whether a digest already sent for a day should go out again. It should when the
 * time on Settings was moved later than the time it was sent for, and has now
 * passed: the team changed the time, so the day is not done. Moving it earlier, or
 * leaving it, never resends.
 */
export function movedLater(sentTime: string | null, configuredTime: string): boolean {
  const sent = parseTime(sentTime ?? "");
  const configured = parseTime(configuredTime);
  return sent !== null && configured !== null && configured > sent;
}

/** "Wed 30 Sep" for a "YYYY-MM-DD" date. */
export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${day} ${d.getUTCDate()} ${month}`;
}

/** "Wed 23 Sep to Tue 29 Sep" for the weekly window [from, to), in IST. */
export function weekRangeLabel(from: Date, to: Date): string {
  const first = istNow(from).date;
  const last = istNow(new Date(to.getTime() - 1)).date;
  return `${shortDate(first)} to ${shortDate(last)}`;
}
