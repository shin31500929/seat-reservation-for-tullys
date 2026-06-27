import { SessionState } from '@prisma/client';
import { prisma } from './lib/prisma.js';
import { detectAwayNotice, detectUsageNotice } from './domain/sessionRules.js';
import { getSocket } from './socket.js';

function usageMessage(kind: string): string {
  if (kind === 'usage_10') return '利用終了まで10分です';
  if (kind === 'usage_5') return '利用終了まで5分です';
  if (kind === 'usage_end') return '利用時間が終了しました';
  return '利用時間を超過しています';
}

function awayMessage(kind: string): string {
  if (kind === 'away_10') return '離席終了まで10分です';
  if (kind === 'away_5') return '離席終了まで5分です';
  return '離席可能時間が終了しました';
}

export function startNotificationScheduler(): NodeJS.Timeout {
  return setInterval(async () => {
    const io = getSocket();
    const now = new Date();
    const sessions = await prisma.session.findMany({
      where: { state: { in: [SessionState.ACTIVE, SessionState.AWAY] } },
      include: { seat: true },
    });

    for (const session of sessions) {
      const usageNotice = detectUsageNotice(session.startedAt, now);
      const awayNotice = session.awayStartedAt ? detectAwayNotice(session.awayStartedAt, now) : null;

      if (usageNotice === 'usage_10' && !session.notifiedUsage10) {
        await prisma.session.update({ where: { id: session.id }, data: { notifiedUsage10: true } });
        await prisma.notification.create({ data: { userId: session.userId, kind: usageNotice, message: usageMessage(usageNotice) } });
      }
      if (usageNotice === 'usage_5' && !session.notifiedUsage5) {
        await prisma.session.update({ where: { id: session.id }, data: { notifiedUsage5: true } });
        await prisma.notification.create({ data: { userId: session.userId, kind: usageNotice, message: usageMessage(usageNotice) } });
      }
      if (usageNotice === 'usage_end' && !session.notifiedUsageEnd) {
        await prisma.session.update({ where: { id: session.id }, data: { notifiedUsageEnd: true } });
        await prisma.notification.create({ data: { userId: session.userId, kind: usageNotice, message: usageMessage(usageNotice) } });
      }
      if (usageNotice === 'overdue') {
        io.emit('staff:overdue', { sessionId: session.id, seatCode: session.seat.code });
      }

      if (awayNotice === 'away_10' && !session.notifiedAway10) {
        await prisma.session.update({ where: { id: session.id }, data: { notifiedAway10: true } });
        await prisma.notification.create({ data: { userId: session.userId, kind: awayNotice, message: awayMessage(awayNotice) } });
      }
      if (awayNotice === 'away_5' && !session.notifiedAway5) {
        await prisma.session.update({ where: { id: session.id }, data: { notifiedAway5: true } });
        await prisma.notification.create({ data: { userId: session.userId, kind: awayNotice, message: awayMessage(awayNotice) } });
      }
      if (awayNotice === 'away_end' && !session.notifiedAwayEnd) {
        await prisma.session.update({ where: { id: session.id }, data: { notifiedAwayEnd: true } });
        await prisma.notification.create({ data: { userId: session.userId, kind: awayNotice, message: awayMessage(awayNotice) } });
      }
    }
  }, 60_000);
}
