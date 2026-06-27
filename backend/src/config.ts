export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  usageLimitMinutes: 120,
  awayLimitMinutes: 30,
};
