import { db, news } from '../../db';
import { eq, desc } from 'drizzle-orm';

export const getNewsList = async () => {
  return await db.select().from(news).orderBy(desc(news.createdAt));
};

export const createNewsItem = async (data: typeof news.$inferInsert) => {
  const [item] = await db.insert(news).values(data).returning();
  return item;
};

export const deleteNewsItem = async (id: string) => {
  const [item] = await db.delete(news).where(eq(news.id, id)).returning();
  return item;
};
