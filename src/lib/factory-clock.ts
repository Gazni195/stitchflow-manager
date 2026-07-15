// Factory Working Clock — computes effective (working) time between two
// timestamps by excluding non-working hours, weekly closed days, and break
// windows. Kept as a pure module today so it can later be replaced by a
// user-configurable "Factory Calendar" (Settings → Factory Calendar)
// without touching any consumer.

export type TimeOfDay = { h: number; m: number };
export type BreakWindow = { name: string; start: TimeOfDay; end: TimeOfDay };

export type FactoryCalendar = {
  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  workingDays: number[];
  dayStart: TimeOfDay;
  dayEnd: TimeOfDay;
  breaks: BreakWindow[];
  holidays: string[]; // YYYY-MM-DD
};

export const DEFAULT_FACTORY_CALENDAR: FactoryCalendar = {
  workingDays: [1, 2, 3, 4, 5, 6], // Mon–Sat
  dayStart: { h: 9, m: 0 },
  dayEnd: { h: 20, m: 0 },
  breaks: [
    { name: "Morning Tea", start: { h: 10, m: 0 }, end: { h: 10, m: 15 } },
    { name: "Lunch", start: { h: 13, m: 30 }, end: { h: 14, m: 0 } },
    { name: "Evening Tea", start: { h: 16, m: 0 }, end: { h: 16, m: 15 } },
  ],
  holidays: [],
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function at(base: Date, t: TimeOfDay): Date {
  const x = new Date(base);
  x.setHours(t.h, t.m, 0, 0);
  return x;
}

function overlapSeconds(a1: Date, a2: Date, b1: Date, b2: Date): number {
  const start = Math.max(a1.getTime(), b1.getTime());
  const end = Math.min(a2.getTime(), b2.getTime());
  return Math.max(0, Math.floor((end - start) / 1000));
}

/** Elapsed wall-clock seconds. */
export function elapsedSeconds(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

/** Effective working seconds inside the factory calendar. */
export function effectiveWorkingSeconds(
  start: Date,
  end: Date,
  cal: FactoryCalendar = DEFAULT_FACTORY_CALENDAR,
): number {
  if (end <= start) return 0;
  let total = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const stopDay = new Date(end);
  stopDay.setHours(0, 0, 0, 0);

  while (cursor <= stopDay) {
    const dow = cursor.getDay();
    const isHoliday = cal.holidays.includes(ymd(cursor));
    const isWorking = cal.workingDays.includes(dow) && !isHoliday;

    if (isWorking) {
      const dayStart = at(cursor, cal.dayStart);
      const dayEnd = at(cursor, cal.dayEnd);
      let seg = overlapSeconds(start, end, dayStart, dayEnd);
      for (const br of cal.breaks) {
        seg -= overlapSeconds(start, end, at(cursor, br.start), at(cursor, br.end));
      }
      total += Math.max(0, seg);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

export type FactoryStatus =
  | { kind: "working" }
  | { kind: "break"; name: string; endsAt: Date }
  | { kind: "closed"; reason: "off-hours" | "holiday" | "weekly-off" };

export function factoryStatusAt(
  now: Date = new Date(),
  cal: FactoryCalendar = DEFAULT_FACTORY_CALENDAR,
): FactoryStatus {
  const dow = now.getDay();
  if (cal.holidays.includes(ymd(now))) return { kind: "closed", reason: "holiday" };
  if (!cal.workingDays.includes(dow)) return { kind: "closed", reason: "weekly-off" };
  const dayStart = at(now, cal.dayStart);
  const dayEnd = at(now, cal.dayEnd);
  if (now < dayStart || now >= dayEnd) return { kind: "closed", reason: "off-hours" };
  for (const br of cal.breaks) {
    const s = at(now, br.start);
    const e = at(now, br.end);
    if (now >= s && now < e) return { kind: "break", name: br.name, endsAt: e };
  }
  return { kind: "working" };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatClock(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** HH:MM:SS, zero-padded — for a live, second-by-second running timer. */
export function formatHMS(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
