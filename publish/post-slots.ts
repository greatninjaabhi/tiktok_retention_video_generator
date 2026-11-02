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
/** A slot missed earlier today posts this soon after the video is ready. */
export const CATCH_UP_MINUTES = 30;
/** Catch-up posts only go out between these local hours; overnight they wait for the next slot. */
const CATCH_UP_HOURS = { from: 7, to: 22 };
/** Don't make a video for a slot further off than this, so videos never pile up. */
export const MAX_AHEAD_HOURS = 14;

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

/** A time soon after `now`, if a slot earlier today went unfilled and it's a sensible hour. */
function catchUpTime(slots: PostSlots, posts: Date[], now: Date): Date | null {
  const today = partsIn(now, slots.timezone);
  if (today.h < CATCH_UP_HOURS.from || today.h >= CATCH_UP_HOURS.to) return null;
  const times = slots.times[DAYS[new Date(Date.UTC(today.y, today.mo - 1, today.d, 12)).getUTCDay()]!] ?? [];
  const passed = times.filter((t) => {
    const { h, mi } = weeklyTime(t, today.y, today.mo, today.d);
    return zonedTime(today.y, today.mo, today.d, h, mi, slots.timezone).getTime() < now.getTime();
  }).length;
  const filled = posts.filter((p) => dayKey(p, slots.timezone) === `${today.y}-${today.mo}-${today.d}`).length;
  if (filled >= passed) return null;
  const at = new Date(now.getTime() + CATCH_UP_MINUTES * 60_000);
  at.setUTCSeconds(0, 0);
  if (at.getUTCMinutes() % 5 === 0) at.setUTCMinutes(at.getUTCMinutes() + 1); // never a round time
  return at;
}

/**
 * When the next video should post: soon, if a slot was missed earlier today, or else the next
 * open slot far enough ahead to review. `scheduled` and `sent` both count toward a day's quota,
 * including posts at other times, so a day never goes over.
 */
export function nextSlot(slots: PostSlots, scheduled: Date[], now = new Date(), sent: Date[] = []): Date {
  const posts = [...scheduled, ...sent];
  const catchUp = catchUpTime(slots, posts, now);
  if (catchUp) return catchUp;
  const earliest = now.getTime() + MIN_LEAD_MINUTES * 60_000;
  for (let i = 0; i < 21; i++) {
    const base = partsIn(new Date(now.getTime() + i * 86_400_000), slots.timezone);
    const noon = new Date(Date.UTC(base.y, base.mo - 1, base.d, 12));
    const times = slots.times[DAYS[noon.getUTCDay()]!] ?? [];
    const taken = posts.filter((s) => dayKey(s, slots.timezone) === `${base.y}-${base.mo}-${base.d}`).length;
    if (taken >= times.length) continue;
    for (const t of [...times].sort()) {
      const { h, mi } = weeklyTime(t, base.y, base.mo, base.d);
      const at = zonedTime(base.y, base.mo, base.d, h, mi, slots.timezone);
      if (at.getTime() >= earliest && !posts.some((s) => s.getTime() === at.getTime())) return at;
    }
  }
  throw new Error('no open posting slot in the next 3 weeks');
}

/** Whether a run should make a video now. False means the next slot is covered or still far off. */
export function needsVideo(slots: PostSlots, scheduled: Date[], now = new Date(), sent: Date[] = []): boolean {
  return nextSlot(slots, scheduled, now, sent).getTime() <= now.getTime() + MAX_AHEAD_HOURS * 3_600_000;
}

export function formatSlot(at: Date, tz: string): string {
  return at.toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}
