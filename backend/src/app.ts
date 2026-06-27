import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { EntryMethod, Gender, Role, SeatState, SessionState } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './lib/prisma.js';
import { requireAuth, requireRole, signJwt } from './auth.js';
import { verifyEntry } from './entryAuth.js';
import { getSocket } from './socket.js';
import { seatColor } from './domain/sessionRules.js';

const startSchema = z.object({
  storeId: z.string(),
  seatId: z.string(),
  peopleCount: z.number().int().min(1).max(8),
  gender: z.nativeEnum(Gender),
  entryMethod: z.nativeEnum(EntryMethod),
  entryToken: z.string().min(1),
});

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '200kb' }));
app.use(morgan('dev'));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const token = signJwt({ id: user.id, role: user.role, email: user.email, name: user.name });
  res.json({ token, role: user.role, name: user.name });
});

app.get('/api/stores', requireAuth, async (_req, res) => {
  const stores = await prisma.store.findMany({ include: { seats: true } });
  const payload = stores.map((store) => {
    const total = store.seats.length;
    const using = store.seats.filter((x) => x.state !== SeatState.VACANT).length;
    return {
      id: store.id,
      name: store.name,
      layoutJson: JSON.parse(store.layoutJson),
      congestionRate: total === 0 ? 0 : Math.round((using / total) * 100),
      totalSeats: total,
    };
  });
  res.json(payload);
});

app.get('/api/stores/:storeId/seats', requireAuth, async (req, res) => {
  const storeId = String(req.params.storeId);
  const seats = await prisma.seat.findMany({ where: { storeId } });
  res.json(
    seats.map((seat) => ({
      ...seat,
      color: seatColor(seat.state),
    })),
  );
});

app.post('/api/sessions/start', requireAuth, async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const seat = await prisma.seat.findUnique({ where: { id: parsed.data.seatId } });
  if (!seat || seat.storeId !== parsed.data.storeId) {
    res.status(404).json({ message: 'Seat not found' });
    return;
  }
  if (seat.state !== SeatState.VACANT) {
    res.status(409).json({ message: 'Seat not vacant' });
    return;
  }

  const validEntry = await verifyEntry(parsed.data.entryMethod, parsed.data.entryToken);
  if (!validEntry) {
    res.status(403).json({ message: 'Entry authentication failed' });
    return;
  }

  const activeSession = await prisma.session.findFirst({
    where: {
      userId: req.authUser!.id,
      state: { in: [SessionState.ACTIVE, SessionState.AWAY] },
    },
  });
  if (activeSession) {
    res.status(409).json({ message: 'Already using a seat' });
    return;
  }

  const session = await prisma.$transaction(async (tx) => {
    await tx.seat.update({ where: { id: seat.id }, data: { state: SeatState.IN_USE } });
    return tx.session.create({
      data: {
        userId: req.authUser!.id,
        seatId: seat.id,
        storeId: parsed.data.storeId,
        peopleCount: parsed.data.peopleCount,
        gender: parsed.data.gender,
        entryMethod: parsed.data.entryMethod,
      },
      include: { seat: true },
    });
  });

  getSocket().emit('seat:updated', { seatId: seat.id, state: SeatState.IN_USE });
  getSocket().emit('session:started', { sessionId: session.id, seatId: session.seatId });
  res.status(201).json(session);
});

app.post('/api/sessions/:sessionId/leave', requireAuth, async (req, res) => {
  const sessionId = String(req.params.sessionId);
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== req.authUser!.id || session.state !== SessionState.ACTIVE) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.seat.update({ where: { id: session.seatId }, data: { state: SeatState.AWAY } });
    return tx.session.update({
      where: { id: session.id },
      data: { state: SessionState.AWAY, awayStartedAt: new Date() },
    });
  });

  getSocket().emit('seat:updated', { seatId: session.seatId, state: SeatState.AWAY });
  getSocket().emit('session:away-started', { sessionId: session.id });
  res.json(updated);
});

app.post('/api/sessions/:sessionId/return', requireAuth, async (req, res) => {
  const sessionId = String(req.params.sessionId);
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== req.authUser!.id || session.state !== SessionState.AWAY) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.seat.update({ where: { id: session.seatId }, data: { state: SeatState.IN_USE } });
    return tx.session.update({
      where: { id: session.id },
      data: { state: SessionState.ACTIVE, awayStartedAt: null },
    });
  });

  getSocket().emit('seat:updated', { seatId: session.seatId, state: SeatState.IN_USE });
  getSocket().emit('session:away-ended', { sessionId: session.id });
  res.json(updated);
});

async function finishSession(sessionId: string, forced: boolean) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { seat: true, store: true },
  });
  if (!session || (session.state !== SessionState.ACTIVE && session.state !== SessionState.AWAY)) return null;

  const allStamps = await prisma.stampDesign.findMany({ where: { isActive: true } });
  const lottery = allStamps.flatMap((stamp) => Array.from({ length: stamp.weight }, () => stamp));
  const selected = lottery[Math.floor(Math.random() * lottery.length)] ?? allStamps[0];

  const ended = await prisma.$transaction(async (tx) => {
    await tx.seat.update({ where: { id: session.seatId }, data: { state: SeatState.VACANT } });
    const updated = await tx.session.update({
      where: { id: session.id },
      data: {
        state: forced ? SessionState.FORCE_ENDED : SessionState.ENDED,
        endedAt: new Date(),
      },
    });
    await tx.usageHistory.create({
      data: {
        userId: session.userId,
        sessionId: session.id,
        seatCode: session.seat.code,
        storeName: session.store.name,
        startedAt: session.startedAt,
        endedAt: updated.endedAt!,
        forced,
      },
    });
    if (selected) {
      await tx.stampAcquisition.create({ data: { userId: session.userId, stampId: selected.id } });
    }
    return updated;
  });

  getSocket().emit('seat:updated', { seatId: session.seatId, state: SeatState.VACANT });
  getSocket().emit(forced ? 'session:force-ended' : 'session:ended', { sessionId: session.id });

  return ended;
}

app.post('/api/sessions/:sessionId/end', requireAuth, async (req, res) => {
  const sessionId = String(req.params.sessionId);
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== req.authUser!.id) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }
  const ended = await finishSession(session.id, false);
  if (!ended) {
    res.status(409).json({ message: 'Session already ended' });
    return;
  }
  res.json(ended);
});

app.post('/api/staff/sessions/:sessionId/force-end', requireAuth, requireRole(Role.STAFF, Role.ADMIN), async (req, res) => {
  const ended = await finishSession(String(req.params.sessionId), true);
  if (!ended) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }
  res.json(ended);
});

app.get('/api/staff/dashboard', requireAuth, requireRole(Role.STAFF, Role.ADMIN), async (_req, res) => {
  const sessions = await prisma.session.findMany({
    where: { state: { in: [SessionState.ACTIVE, SessionState.AWAY] } },
    include: { seat: true },
  });

  const now = Date.now();
  const overdue = sessions.filter((s) => now - s.startedAt.getTime() > 120 * 60 * 1000).length;
  const awayCount = sessions.filter((s) => s.state === SessionState.AWAY).length;
  const active = sessions.filter((s) => s.state === SessionState.ACTIVE).length;

  const seats = await prisma.seat.findMany();
  const vacant = seats.filter((s) => s.state === SeatState.VACANT).length;
  const congestionRate = seats.length === 0 ? 0 : Math.round(((seats.length - vacant) / seats.length) * 100);

  res.json({
    congestionRate,
    activeUsers: active,
    awayUsers: awayCount,
    vacantSeats: vacant,
    overtimeUsers: overdue,
  });
});

app.get('/api/stamps/me', requireAuth, async (req, res) => {
  const stamps = await prisma.stampAcquisition.findMany({
    where: { userId: req.authUser!.id },
    include: { stamp: true },
    orderBy: { acquiredAt: 'desc' },
  });
  res.json(stamps);
});

app.get('/api/history/me', requireAuth, async (req, res) => {
  const history = await prisma.usageHistory.findMany({
    where: { userId: req.authUser!.id },
    orderBy: { endedAt: 'desc' },
  });
  res.json(history);
});

app.get('/api/notifications/me', requireAuth, async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.authUser!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(items);
});
