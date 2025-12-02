import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-user';
import { TeacherObservationsService } from './teacher-observations.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { resolveVinculoIdFromRequest } from '../utils/resolve-vinculo-id';

@Controller('v1/api/teacher/observations')
export class TeacherObservationsController {
  constructor(private readonly service: TeacherObservationsService) { }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId')
  async getObservations(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
  ) {
    if (!courseId) {
      throw new BadRequestException('courseId path parameter is required');
    }
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    return this.service.getObservationsForTeacher(
      vinculoId,
      undefined,
      courseId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('courses/:courseId')
  async createObservation(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
    @Body()
    body: {
      alumnoVinculoId?: string;
      tipo?: string;
      cursoMateriaId?: string;
      titulo?: string;
      descripcion?: string;
    },
  ) {
    if (!courseId) {
      throw new BadRequestException('courseId path parameter is required');
    }

    if (!body?.alumnoVinculoId || !body?.tipo || !body?.descripcion) {
      throw new BadRequestException(
        'Missing required fields: alumnoVinculoId, tipo, descripcion',
      );
    }

    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    return this.service.createObservation(vinculoId, courseId, {
      alumnoVinculoId: body.alumnoVinculoId,
      tipo: body.tipo,
      cursoMateriaId: body.cursoMateriaId ?? null,
      titulo: body.titulo ?? null,
      descripcion: body.descripcion,
    });
  }
}
