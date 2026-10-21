import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface BodyParserError extends Error {
  status?: number;
  type?: string;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as BodyParserError).status === 'number'
  );
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return (
    code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
    // SQLite reports ON DELETE RESTRICT violations as constraint triggers.
    code === 'SQLITE_CONSTRAINT_TRIGGER'
  );
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    return;
  }

  if (error instanceof ApiError) {
    const body: {
      error: { code: string; message: string; details?: unknown };
    } = {
      error: { code: error.code, message: error.message },
    };
    if (error.details !== undefined) {
      body.error.details = error.details;
    }
    res.status(error.status).json(body);
    return;
  }

  if (isBodyParserError(error)) {
    if (error.type === 'entity.too.large') {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body is too large.',
        },
      });
      return;
    }
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' },
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
  });
}
