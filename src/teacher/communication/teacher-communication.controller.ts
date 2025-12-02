import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-user';
import { TeacherCommunicationService } from './teacher-communication.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { resolveVinculoIdFromRequest } from '../utils/resolve-vinculo-id';

type CommunicationPayload = {
  cursoId?: string;
  estudianteId?: string;
  profesorId?: string;
  administradorId?: string;
  asunto: string;
  tipo?: string;
  descripcion?: string;
};

@Controller('v1/api/teacher/communication')
export class TeacherCommunicationController {
  constructor(private readonly service: TeacherCommunicationService) { }

  @UseGuards(JwtAuthGuard)
  @Get()
  async listCommunications(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    const requestedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const safeLimit =
      typeof requestedLimit === 'number' &&
        Number.isFinite(requestedLimit) &&
        requestedLimit > 0
        ? requestedLimit
        : undefined;
    return this.service.listCommunicationsForTeacher(vinculoId, {
      limit: safeLimit,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createCommunication(
    @Req() req: AuthenticatedRequest,
    @Body() payload: CommunicationPayload,
  ) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    const result = await this.service.createCommunication(vinculoId, payload);
    return result;
  }
}
