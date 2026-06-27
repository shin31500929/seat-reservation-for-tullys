import { PrismaClient, Rarity, Role, SeatType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const stampSeeds = [
  { title: 'クラシックロゴ', imageEmoji: '☕', rarity: Rarity.COMMON, weight: 70 },
  { title: 'ラテアート', imageEmoji: '🫖', rarity: Rarity.RARE, weight: 25 },
  { title: 'ゴールデンビーンズ', imageEmoji: '✨', rarity: Rarity.ULTRA_RARE, weight: 5 },
];

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.upsert({
    where: { email: 'user@tullys.local' },
    update: {},
    create: { email: 'user@tullys.local', passwordHash, role: Role.USER, name: '一般利用者' },
  });
  await prisma.user.upsert({
    where: { email: 'staff@tullys.local' },
    update: {},
    create: { email: 'staff@tullys.local', passwordHash, role: Role.STAFF, name: '店員' },
  });
  await prisma.user.upsert({
    where: { email: 'admin@tullys.local' },
    update: {},
    create: { email: 'admin@tullys.local', passwordHash, role: Role.ADMIN, name: '管理者' },
  });

  const store = await prisma.store.upsert({
    where: { id: 'default-store' },
    update: {},
    create: {
      id: 'default-store',
      name: 'タリーズ渋谷店',
      layoutJson: JSON.stringify({ width: 360, height: 640, bg: '/layout/shibuya.svg' }),
      seats: {
        create: [
          { code: 'C-01', type: SeatType.COUNTER, x: 32, y: 90 },
          { code: 'C-02', type: SeatType.COUNTER, x: 82, y: 90 },
          { code: 'S-01', type: SeatType.SOFA2, x: 200, y: 180 },
          { code: 'S-02', type: SeatType.SOFA2, x: 250, y: 180 },
        ],
      },
    },
    include: { seats: true },
  });

  for (const seed of stampSeeds) {
    await prisma.stampDesign.upsert({
      where: { id: `${seed.rarity}-${seed.title}` },
      update: {},
      create: { id: `${seed.rarity}-${seed.title}`, ...seed },
    });
  }

  if (!store.seats.length) {
    throw new Error('Seat seed failed');
  }
}

main().finally(() => prisma.$disconnect());
