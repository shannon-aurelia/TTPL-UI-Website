import { db, users } from '../../db';
import { eq } from 'drizzle-orm';

export const getUserByEmail = async (email: string) => {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
};

export const getUserById = async (id: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
};

export const createUser = async (data: typeof users.$inferInsert) => {
  const [user] = await db.insert(users).values(data).returning();
  return user;
};
