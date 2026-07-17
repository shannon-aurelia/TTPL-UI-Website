import { z } from 'zod';

export const ZNewsCreate = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(5, 'Content must be at least 5 characters'),
  tag: z.string().min(1, 'Tag is required')
});
