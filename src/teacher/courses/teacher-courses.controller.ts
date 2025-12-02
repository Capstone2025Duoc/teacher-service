import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../auth/authenticated-user';
import { TeacherCoursesService } from './teacher-courses.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { resolveVinculoIdFromRequest } from '../utils/resolve-vinculo-id';

@Controller('v1/api/teacher/course')
export class TeacherCoursesController {
  constructor(private readonly service: TeacherCoursesService) { }

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  async getCourseSummary(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    const summary = await this.service.getCourseSummaryForHead(vinculoId);
    if (!summary) {
      return res.status(204).send();
    }
    return res.json(summary);
  }

  @UseGuards(JwtAuthGuard)
  @Get('students/analytics')
  async getStudentsAnalytics(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    const analytics = await this.service.getStudentsAnalyticsForHead(vinculoId);
    return res.json(analytics);
  }
}
