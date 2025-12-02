import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-user';
import { TeacherEvaluationsService } from './teacher-evaluations.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { resolveVinculoIdFromRequest } from '../utils/resolve-vinculo-id';

@Controller('v1/api/teacher/evaluaciones')
export class TeacherEvaluationsController {
  constructor(private readonly service: TeacherEvaluationsService) { }

  /**
   * GET v1/api/teacher/evaluaciones/courses
   * Protected: returns a lightweight list of courses where the teacher teaches.
   * Response items: { courseId, courseName }
   */
  @UseGuards(JwtAuthGuard)
  @Get('courses')
  async getCourses(@Req() req: AuthenticatedRequest) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    return this.service.getCoursesForTeacher(vinculoId);
  }
}
