import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from './authenticated-user';
import jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromRequest(req);
    if (!token) throw new UnauthorizedException('Missing authentication token');

    const pubKeyEnv = process.env.JWT_PUBLIC_KEY;
    if (!pubKeyEnv)
      throw new UnauthorizedException('JWT public key not configured');

    // .env values may be wrapped in quotes and contain escaped newlines (\n).
    // Normalize by removing surrounding quotes (if any) and replacing escaped newlines with real ones.
    let pubKey = pubKeyEnv;
    // remove surrounding single or double quotes
    if (
      (pubKey.startsWith('"') && pubKey.endsWith('"')) ||
      (pubKey.startsWith("'") && pubKey.endsWith("'"))
    ) {
      pubKey = pubKey.slice(1, -1);
    }
    pubKey = pubKey.replace(/\\n/g, '\n').trim();

    try {
      const payload = jwt.verify(token, pubKey, { algorithms: ['RS256'] });
      // attach payload to request.user for downstream handlers
      req.user = payload as AuthenticatedUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromRequest(req: Request): string | undefined {
    const cookieHeader = req.headers?.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(/;\s*/);
      for (const c of cookies) {
        const [name, ...rest] = c.split('=');
        if (!name) continue;
        if (name === 'Authentication' || name === 'authentication') {
          return decodeURIComponent(rest.join('='));
        }
      }
    }

    const auth = req.headers?.authorization || req.headers?.Authorization;
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }

    return undefined;
  }
}
