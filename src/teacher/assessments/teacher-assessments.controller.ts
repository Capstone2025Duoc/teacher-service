import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-user';
import { TeacherAssessmentsService } from './teacher-assessments.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { resolveVinculoIdFromRequest } from '../utils/resolve-vinculo-id';

class CreateEvaluationBody {
  name!: string;
  tipo?: string;
  fecha!: string;
}

class UpsertGradeBody {
  alumnoVinculoId!: string;
  nota?: number;
  calificacion?: number;
  retroalimentacion?: string;
}

@Controller('v1/api/teacher/assessments')
export class TeacherAssessmentsController {
  constructor(private readonly service: TeacherAssessmentsService) {}

  private async resolveVinculo(req: AuthenticatedRequest) {
    return resolveVinculoIdFromRequest(req, this.service);
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId/subjects/:subjectId/students-with-grades')
  async getStudentsWithGrades(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
    @Param('subjectId') subjectId: string,
  ) {
    const vinculoId = await this.resolveVinculo(req);
    if (!courseId || !subjectId) {
      throw new BadRequestException('Missing courseId or subjectId in params');
    }

    const cms = await this.service.getCursosMateriasForTeacherAndSubject(
      vinculoId,
      subjectId,
      courseId,
    );
    if (!cms || cms.length === 0) {
      const isHead = await this.service.isHeadOfCourse(vinculoId, courseId);
      if (!isHead) {
        throw new NotFoundException(
          'You are not assigned to this subject in the given course',
        );
      }
    }

    return this.service.getStudentsWithGrades(vinculoId, courseId, subjectId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses')
  async getCourses(@Req() req: AuthenticatedRequest) {
    const vinculoId = await this.resolveVinculo(req);
    return this.service.getCoursesForTeacher(vinculoId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId/subjects')
  async getSubjectsForCourse(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
  ) {
    const vinculoId = await this.resolveVinculo(req);
    if (!courseId) {
      throw new BadRequestException('Missing courseId parameter');
    }

    return this.service.getSubjectsForTeacherInCourse(vinculoId, courseId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId/curso-materias')
  async getCursoMateriasForCourse(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
  ) {
    const vinculoId = await this.resolveVinculo(req);
    if (!courseId) {
      throw new BadRequestException('Missing courseId parameter');
    }

    return this.service.getCursoMateriasForTeacher(vinculoId, courseId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId/subjects/:subjectId/evaluations')
  async getEvaluations(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
    @Param('subjectId') subjectId: string,
  ) {
    const vinculoId = await this.resolveVinculo(req);
    if (!courseId || !subjectId) {
      throw new BadRequestException('Missing courseId or subjectId in params');
    }

    return this.service.getEvaluationsWithGradingInfo(
      vinculoId,
      subjectId,
      courseId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('courses/:courseId/subjects/:subjectId/create-evaluation')
  async createEvaluation(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
    @Param('subjectId') subjectId: string,
    @Body() body: CreateEvaluationBody,
  ) {
    const vinculoId = await this.resolveVinculo(req);
    if (!courseId || !subjectId) {
      throw new BadRequestException('Missing courseId or subjectId in params');
    }

    const { name, tipo, fecha } = body;
    if (!name || !fecha) {
      throw new BadRequestException('Missing name or fecha in body');
    }

    return this.service.createEvaluation(vinculoId, courseId, subjectId, {
      name,
      tipo,
      fecha,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('evaluations/:evaluationId/grades')
  async upsertGrade(
    @Req() req: AuthenticatedRequest,
    @Param('evaluationId') evaluationId: string,
    @Body() body: UpsertGradeBody,
  ) {
    const vinculoId = await this.resolveVinculo(req);
    const alumnoVinculoId = body.alumnoVinculoId;
    const notaValue =
      body.nota != null ? body.nota : (body.calificacion ?? undefined);
    const retroalimentacion = body.retroalimentacion;
    if (!alumnoVinculoId || notaValue == null) {
      throw new BadRequestException('Missing alumnoVinculoId or nota in body');
    }

    return this.service.upsertNote(vinculoId, evaluationId, {
      alumnoVinculoId,
      nota: notaValue,
      retroalimentacion,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId/subjects/:subjectId/students')
  async getStudentsForSubject(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
    @Param('subjectId') subjectId: string,
  ) {
    const vinculoId = await this.resolveVinculo(req);
    if (!courseId || !subjectId) {
      throw new BadRequestException('Missing courseId or subjectId in params');
    }

    const cms = await this.service.getCursosMateriasForTeacherAndSubject(
      vinculoId,
      subjectId,
      courseId,
    );
    if (!cms || cms.length === 0) {
      const isHead = await this.service.isHeadOfCourse(vinculoId, courseId);
      if (!isHead) {
        throw new NotFoundException(
          'You are not assigned to this subject in the given course',
        );
      }
    }

    return this.service.getStudentsForCourse(vinculoId, courseId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('subjects/:courseId/:subjectId/stats')
  async getSubjectStatsForCourse(
    @Req() req: AuthenticatedRequest,
    @Param('subjectId') subjectId: string,
    @Param('courseId') courseId: string,
  ) {
    const vinculoId = await this.resolveVinculo(req);
    const cms = await this.service.getCursosMateriasForTeacherAndSubject(
      vinculoId,
      subjectId,
      courseId,
    );
    if (!cms || cms.length === 0) {
      const isHead = await this.service.isHeadOfCourse(vinculoId, courseId);
      if (!isHead) {
        throw new NotFoundException(
          'You are not assigned to this subject in the given course',
        );
      }
    }

    return this.service.getCourseSubjectExamStats(subjectId, courseId);
  }
}
