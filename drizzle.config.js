/** @type { import("drizzle-kit").Config } */
export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_SQLITE_PATH || './local.db',
  },
};
