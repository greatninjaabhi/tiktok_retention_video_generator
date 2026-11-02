import { describe, expect, it } from 'vitest';
import { loadChannel } from '../render/channel';
import { CATCH_UP_MINUTES, MAX_WEEKLY_SHIFT_MINUTES, MIN_LEAD_MINUTES, formatSlot, needsVideo, nextSlot, weeklyTime, zonedTime, type PostSlots } from '../publish/post-slots';

const slots = loadChannel('politics').post_slots as PostSlots;
const tz = slots.timezone;
const at = (y: number, mo: number, d: number, h: number, mi: number) => zonedTime(y, mo, d, h, mi, tz);
/** The real slot time for a base time on a given day. */
const slot = (y: number, mo: number, d: number, base: string) => {
  const { h, mi } = weeklyTime(base, y, mo, d);
  return at(y, mo, d, h, mi);
};

describe('owner-approved schedule', () => {
  it('posts three times a day, 21 a week', () => {
    expect(Object.keys(slots.times)).toHaveLength(7);
    for (const times of Object.values(slots.times)) expect(times).toHaveLength(3);
  });
  it('never uses a round time, in any week', () => {
    for (const t of Object.values(slots.times).flat()) {
      expect(Number(t.split(':')[1]) % 5).not.toBe(0);
      for (let d = 1; d <= 300; d += 1) expect(weeklyTime(t, 2026, 1, d).mi % 5).not.toBe(0);
    }
  });
  it('moves a little each week, and holds steady within a week', () => {
    const minutes = (d: number) => { const w = weeklyTime('19:53', 2026, 11, d); return w.h * 60 + w.mi; };
    const weeks = [1, 8, 15, 22, 29].map(minutes); // the same weekday, week after week
    expect(new Set(weeks).size).toBeGreaterThan(1);
    for (const m of weeks) expect(Math.abs(m - (19 * 60 + 53))).toBeLessThanOrEqual(MAX_WEEKLY_SHIFT_MINUTES);
    const weekOf = (d: number) => weeklyTime('19:53', 2026, 11, d);
    expect(weekOf(1)).toEqual(weekOf(1)); // the same run of the schedule always agrees with itself
  });
});

describe('next open slot', () => {
  const sun = (base: string) => slot(2026, 11, 1, base);
  const morning = () => sun('09:07');
  it('handles daylight saving', () => {
    expect(at(2026, 11, 1, 19, 53).toISOString()).toBe('2026-11-02T01:53:00.000Z'); // CST, UTC-6
    expect(at(2026, 10, 31, 9, 7).toISOString()).toBe('2026-10-31T14:07:00.000Z'); // CDT, UTC-5
  });
  it('picks the next slot with time to review', () => {
    expect(nextSlot(slots, [], at(2026, 11, 1, 11, 43), [morning()]).getTime()).toBe(sun('14:41').getTime());
  });
  it('skips a slot too soon to review', () => {
    const now = new Date(sun('14:41').getTime() - (MIN_LEAD_MINUTES - 1) * 60_000);
    expect(nextSlot(slots, [], now, [morning()]).getTime()).toBe(sun('19:53').getTime());
  });
  it('skips filled slots', () => {
    expect(nextSlot(slots, [sun('14:41')], at(2026, 11, 1, 11, 43), [morning()]).getTime()).toBe(sun('19:53').getTime());
  });
  it('counts a post at another time toward its day, so a day stays at three', () => {
    const now = at(2026, 11, 2, 5, 0);
    const alaska = at(2026, 11, 2, 9, 41);
    const mon = (base: string) => slot(2026, 11, 2, base);
    expect(nextSlot(slots, [alaska], now).getTime()).toBe(mon('08:23').getTime());
    expect(nextSlot(slots, [alaska, mon('08:23'), mon('12:47')], now).getTime()).toBe(slot(2026, 11, 3, '08:12').getTime());
  });
  it('catches up soon if a slot was missed earlier today', () => {
    const now = at(2026, 11, 1, 11, 43);
    const got = nextSlot(slots, [], now);
    expect(got.getTime() - now.getTime()).toBeGreaterThanOrEqual(CATCH_UP_MINUTES * 60_000);
    expect(got.getTime() - now.getTime()).toBeLessThanOrEqual((CATCH_UP_MINUTES + 1) * 60_000);
    expect(got.getUTCMinutes() % 5).not.toBe(0);
  });
  it('waits for the next slot instead of posting overnight', () => {
    expect(nextSlot(slots, [], at(2026, 11, 1, 23, 30)).getTime()).toBe(slot(2026, 11, 2, '08:23').getTime());
  });
  it('makes a video only when one is due, so they never pile up', () => {
    expect(needsVideo(slots, [], at(2026, 11, 1, 14, 30), [morning(), sun('14:41')])).toBe(true);
    expect(needsVideo(slots, [sun('19:53')], at(2026, 11, 1, 14, 30), [morning(), sun('14:41')])).toBe(false);
    expect(needsVideo(slots, [], at(2026, 11, 2, 4, 30))).toBe(true);
  });
  it('shows the time in the channel\'s zone', () => {
    expect(formatSlot(at(2026, 11, 1, 19, 53), tz)).toContain('7:53');
  });
});
