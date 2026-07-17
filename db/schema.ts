import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('student'), // 'student', 'assistant', 'admin'
  createdAt: integer('created_at').notNull()
});

export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  trackId: text('track_id').notNull(), // 'rl', 'idp', 't3'
  type: text('type').notNull(), // 'pre-test', 'post-test', 'report'
  moduleIndex: integer('module_index').notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  score: integer('score'), // null means ungraded
  notes: text('notes'),
  submittedAt: integer('submitted_at').notNull()
});

export const news = sqliteTable('news', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  tag: text('tag').notNull(), // 'Announcement', 'Practicum', 'Resource', 'Project'
  createdAt: integer('created_at').notNull()
});

export const assistants = sqliteTable('assistants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  roleType: text('role_type').notNull(), // 'assistant', 'alumni'
  portraitUrl: text('portrait_url'),
  email: text('email'),
  instagram: text('instagram'),
  batch: text('batch').notNull() // '2024', 'Elektro 23', 'Elektro 22'
});

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  createdAt: integer('created_at').notNull()
});
