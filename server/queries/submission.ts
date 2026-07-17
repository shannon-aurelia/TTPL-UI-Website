import { db, submissions, users } from '../../db';
import { eq, desc } from 'drizzle-orm';

export const getSubmissionsForUser = async (userId: string) => {
  return await db.select().from(submissions).where(eq(submissions.userId, userId)).orderBy(desc(submissions.submittedAt));
};

export const getAllSubmissions = async () => {
  return await db
    .select({
      id: submissions.id,
      userId: submissions.userId,
      userName: users.name,
      userEmail: users.email,
      trackId: submissions.trackId,
      type: submissions.type,
      moduleIndex: submissions.moduleIndex,
      fileUrl: submissions.fileUrl,
      fileName: submissions.fileName,
      score: submissions.score,
      notes: submissions.notes,
      submittedAt: submissions.submittedAt
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .orderBy(desc(submissions.submittedAt));
};

export const createSubmission = async (data: typeof submissions.$inferInsert) => {
  const [item] = await db.insert(submissions).values(data).returning();
  return item;
};

export const updateSubmissionGrade = async (id: string, score: number, notes?: string) => {
  const [item] = await db
    .update(submissions)
    .set({ score, notes: notes || null })
    .where(eq(submissions.id, id))
    .returning();
  return item;
};
