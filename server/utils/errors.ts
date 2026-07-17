import type { Context } from 'hono';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public field?: string
  ) {
    super(message);
  }
}

export const handleError = (c: Context, error: unknown, fallbackMessage = 'An unexpected error occurred') => {
  if (error instanceof AppError) {
    return c.json({
      success: false,
      error: error.message,
      code: error.code,
      field: error.field
    }, error.statusCode as any);
  }
  console.error('Unhandled Error:', error);
  return c.json({
    success: false,
    error: fallbackMessage,
    code: 'INTERNAL_ERROR'
  }, 500);
};
