import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getUserByEmail, createUser } from '../queries/user';
import { AppError } from '../utils/errors';
import { ZLogin, ZRegister } from '../../validation/auth';
import type { z } from 'zod';

export async function registerUser(input: z.infer<typeof ZRegister>) {
  const existing = await getUserByEmail(input.email);
  if (existing) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS', 'email');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await createUser({
    id: randomUUID(),
    email: input.email,
    passwordHash,
    name: input.name,
    role: 'student',
    createdAt: Date.now()
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

export async function loginUser(input: z.infer<typeof ZLogin>) {
  const user = await getUserByEmail(input.email);
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}
