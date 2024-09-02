import type { Config } from 'drizzle-kit';

export default {
  schema: ['./features/boatProfile/model/boatProfile.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
