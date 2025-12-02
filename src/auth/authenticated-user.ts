import type { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  rol?: string;
  personaId?: string;
  colegioId?: string;
  scope?: string[];
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};
