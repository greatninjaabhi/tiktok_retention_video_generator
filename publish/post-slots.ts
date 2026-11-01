/**
 * The posting schedule (channels/<id>/channel.yaml), which we apply ourselves because Buffer's API
 * can't edit its queue slots: each post is sent with its own exact time. Times shift a little each
 * week, staying non-round, and hold steady within the week.
 */
import { createRng } from '../render/rng';

export type PostSlots = { timezone: string; times: Record<string, string[]> };

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
/** Time to review a video in Buffer before it goes out. */
export const MIN_LEAD_MINUTES = 120;
/** The most a slot moves from its base time in channel.yaml. */
export const MAX_WEEKLY_SHIFT_MINUTES = 10;

/** Calendar parts of an instant in a time zone. */
function partsIn(at: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute') };
}

/** The instant a wall-clock time happens in a time zone (handles daylight saving). */
export function zonedTime(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  const p = partsIn(new Date(wanted), tz);
  const offset = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - wanted;
  const guess = new Date(wanted - offset);
  const q = partsIn(guess, tz);
  return new Date(guess.getTime() + (wanted - Date.UTC(q.y, q.mo - 1, q.d, q.h, q.mi)));
}

/** This week's version of a base time like "19:53", for the given calendar day. */
export function weeklyTime(base: string, y: number, mo: number, d: number): { h: number; mi: number } {
  const [h, mi] = base.split(':').map(Number) as [number, number];
  const noon = new Date(Date.UTC(y, mo - 1, d, 12));
  const sunday = new Date(noon.getTime() - noon.getUTCDay() * 86_400_000).toISOString().slice(0, 10);
  const span = MAX_WEEKLY_SHIFT_MINUTES * 2 + 1;
  const shift = Math.floor(createRng(`${sunday}|${noon.getUTCDay()}|${base}`).next() * span) - MAX_WEEKLY_SHIFT_MINUTES;
  let total = h * 60 + mi + shift;
  if (total % 5 === 0) total += total > h * 60 + mi ? -1 : 1; // never a round time, and stays in range
  return { h: Math.floor(total / 60), mi: total % 60 };
}

const dayKey = (at: Date, tz: string) => { const p = partsIn(at, tz); return `${p.y}-${p.mo}-${p.d}`; };

/**
 * The next open slot: far enough ahead to review, and on a day that isn't already full. Posts
 * already scheduled at other times still count toward their day, so a day never exceeds its quota.
 */
export function nextSlot(slots: PostSlots, scheduled: Date[], now = new Date()): Date {
  const earliest = now.getTime() + MIN_LEAD_MINUTES * 60_000;
  for (let i = 0; i < 21; i++) {
    const base = partsIn(new Date(now.getTime() + i * 86_400_000), slots.timezone);
    const noon = new Date(Date.UTC(base.y, base.mo - 1, base.d, 12));
    const times = slots.times[DAYS[noon.getUTCDay()]!] ?? [];
    const taken = scheduled.filter((s) => dayKey(s, slots.timezone) === `${base.y}-${base.mo}-${base.d}`).length;
    if (taken >= times.length) continue;
    for (const t of [...times].sort()) {
      const { h, mi } = weeklyTime(t, base.y, base.mo, base.d);
      const at = zonedTime(base.y, base.mo, base.d, h, mi, slots.timezone);
      if (at.getTime() >= earliest && !scheduled.some((s) => s.getTime() === at.getTime())) return at;
    }
  }
  throw new Error('no open posting slot in the next 3 weeks');
}

export function formatSlot(at: Date, tz: string): string {
  return at.toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}
