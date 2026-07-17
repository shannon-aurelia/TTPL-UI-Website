import { randomUUID } from 'crypto';
import { getNewsList, createNewsItem, deleteNewsItem } from '../queries/news';
import type { ZNewsCreate } from '../../validation/news';
import type { z } from 'zod';

export async function fetchNews() {
  return await getNewsList();
}

export async function addNews(input: z.infer<typeof ZNewsCreate>) {
  return await createNewsItem({
    id: randomUUID(),
    title: input.title,
    content: input.content,
    tag: input.tag,
    createdAt: Date.now()
  });
}

export async function removeNews(id: string) {
  return await deleteNewsItem(id);
}
