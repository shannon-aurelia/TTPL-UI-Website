import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlitePath = process.env.DATABASE_SQLITE_PATH || './local.db';

const sqlite = new Database(sqlitePath);
export const db = drizzle(sqlite, { schema });
export type DbClient = typeof db;
export * from './schema';
