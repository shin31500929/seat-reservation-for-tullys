import { config } from '../config.js';

export type SessionNotice = 'usage_10' | 'usage_5' | 'usage_end' | 'away_10' | 'away_5' | 'away_end' | 'overdue';

export function remainingMinutes(startedAt: Date, now: Date, maxMinutes: number): number {
  const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 60000);
  return maxMinutes - elapsed;
}

export function detectUsageNotice(startedAt: Date, now: Date): SessionNotice | null {
  const remain = remainingMinutes(startedAt, now, config.usageLimitMinutes);
  if (remain === 10) return 'usage_10';
  if (remain === 5) return 'usage_5';
  if (remain === 0) return 'usage_end';
  if (remain < 0) return 'overdue';
  return null;
}

export function detectAwayNotice(awayStartedAt: Date, now: Date): SessionNotice | null {
  const remain = remainingMinutes(awayStartedAt, now, config.awayLimitMinutes);
  if (remain === 10) return 'away_10';
  if (remain === 5) return 'away_5';
  if (remain === 0) return 'away_end';
  return null;
}

export function seatColor(state: 'VACANT' | 'IN_USE' | 'AWAY'): 'green' | 'red' | 'yellow' {
  if (state === 'VACANT') return 'green';
  if (state === 'IN_USE') return 'red';
  return 'yellow';
}
