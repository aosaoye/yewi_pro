import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities/index';
import { MIGRATIONS } from './migrations/index';

const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(__dirname, '..', '..', '.env'),
];
const envPath = envCandidates.find((candidate) => existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/yewi';

const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  /sslmode=require|\.render\.com|supabase\.co|neon\.tech/i.test(databaseUrl);

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: ALL_ENTITIES,
  migrations: MIGRATIONS,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
