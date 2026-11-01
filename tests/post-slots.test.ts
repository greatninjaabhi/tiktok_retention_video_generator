import { describe, expect, it } from 'vitest';
import { loadChannel } from '../render/channel';
import { MIN_LEAD_MINUTES, formatSlot, nextSlot, zonedTime, type PostSlots } from '../publish/post-slots';

const slots = loadChannel('politics').post_slots as PostSlots;
const tz = slots.timezone;
const at = (y: number, mo: number, d: number, h: number, mi: number) => zonedTime(y, mo, d, h, mi, tz);

describe('owner-approved schedule', () => {
  it('posts twice a day, 14 a week', () => {
    expect(Object.keys(slots.times)).toHaveLength(7);
    for (const times of Object.values(slots.times)) expect(times).toHaveLength(2);
  });
  it('never uses a round time', () => {
    for (const t of Object.values(slots.times).flat()) expect(Number(t.split(':')[1]) % 5).not.toBe(0);
  });
});

describe('next open slot', () => {
  it('handles daylight saving', () => {
    expect(at(2026, 11, 1, 19, 53).toISOString()).toBe('2026-11-02T01:53:00.000Z'); // CST, UTC-6
    expect(at(2026, 10, 31, 9, 7).toISOString()).toBe('2026-10-31T14:07:00.000Z'); // CDT, UTC-5
  });
  it('picks the next slot with time to review', () => {
    const now = at(2026, 11, 1, 11, 43);
    expect(nextSlot(slots, [], now).getTime()).toBe(at(2026, 11, 1, 19, 53).getTime());
  });
  it('skips a slot too soon to review', () => {
    const now = new Date(at(2026, 11, 1, 19, 53).getTime() - (MIN_LEAD_MINUTES - 1) * 60_000);
    expect(nextSlot(slots, [], now).getTime()).toBe(at(2026, 11, 2, 12, 47).getTime());
  });
  it('skips filled slots', () => {
    const now = at(2026, 11, 1, 11, 43);
    expect(nextSlot(slots, [at(2026, 11, 1, 19, 53)], now).getTime()).toBe(at(2026, 11, 2, 12, 47).getTime());
  });
  it('counts a post at another time toward its day, so a day stays at two', () => {
    const now = at(2026, 11, 2, 8, 0);
    const alaska = at(2026, 11, 2, 9, 41);
    expect(nextSlot(slots, [alaska], now).getTime()).toBe(at(2026, 11, 2, 12, 47).getTime());
    expect(nextSlot(slots, [alaska, at(2026, 11, 2, 12, 47)], now).getTime()).toBe(at(2026, 11, 3, 12, 13).getTime());
  });
  it('shows the time in the channel\'s zone', () => {
    expect(formatSlot(at(2026, 11, 1, 19, 53), tz)).toContain('7:53');
  });
});
