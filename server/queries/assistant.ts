import { db, assistants } from '../../db';
import { eq } from 'drizzle-orm';

export const getAssistantsList = async () => {
  return await db.select().from(assistants);
};

export const createAssistant = async (data: typeof assistants.$inferInsert) => {
  const [item] = await db.insert(assistants).values(data).returning();
  return item;
};
