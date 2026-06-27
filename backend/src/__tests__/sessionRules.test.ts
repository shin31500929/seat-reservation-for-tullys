import { describe, expect, it } from 'vitest';
import { detectAwayNotice, detectUsageNotice, seatColor } from '../domain/sessionRules.js';

describe('session rules', () => {
  it('returns proper seat colors', () => {
    expect(seatColor('VACANT')).toBe('green');
    expect(seatColor('IN_USE')).toBe('red');
    expect(seatColor('AWAY')).toBe('yellow');
  });

  it('detects usage notices', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    expect(detectUsageNotice(new Date('2026-01-01T10:10:00Z'), now)).toBe('usage_10');
    expect(detectUsageNotice(new Date('2026-01-01T10:05:00Z'), now)).toBe('usage_5');
    expect(detectUsageNotice(new Date('2026-01-01T10:00:00Z'), now)).toBe('usage_end');
  });

  it('detects away notices', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    expect(detectAwayNotice(new Date('2026-01-01T11:40:00Z'), now)).toBe('away_10');
    expect(detectAwayNotice(new Date('2026-01-01T11:35:00Z'), now)).toBe('away_5');
    expect(detectAwayNotice(new Date('2026-01-01T11:30:00Z'), now)).toBe('away_end');
  });
});
