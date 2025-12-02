import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../../auth/authenticated-user';

/**
 * Minimal resolver interface that services can implement when they need to
 * expose vinculo lookup through personaId+colegioId.
 */
export type VinculoResolver = {
  resolveVinculoIdByPersonaAndColegio(
    personaId: string,
    colegioId: string,
  ): Promise<string | undefined>;
};

export async function resolveVinculoIdFromRequest(
  req: AuthenticatedRequest,
  resolver: VinculoResolver,
): Promise<string> {
  const payload = req.user as AuthenticatedUser | undefined;
  if (!payload) {
    throw new BadRequestException('Token payload is missing');
  }

  if (payload.sub) return payload.sub;

  const personaId = payload.personaId;
  const colegioId = payload.colegioId;
  if (!personaId || !colegioId) {
    throw new BadRequestException(
      'Token payload must include vinculoId or personaId+colegioId',
    );
  }

  const resolved = await resolver.resolveVinculoIdByPersonaAndColegio(
    personaId,
    colegioId,
  );
  if (!resolved) {
    throw new NotFoundException('Vínculo institucional no encontrado');
  }

  return resolved;
}
