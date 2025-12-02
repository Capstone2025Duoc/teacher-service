import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-user';
import { TeacherMainDomainService } from './teacher-main-domain.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { resolveVinculoIdFromRequest } from '../utils/resolve-vinculo-id';

@Controller('v1/api/teacher/main')
export class TeacherMainController {
  constructor(private readonly service: TeacherMainDomainService) {}

  /**
   * GET v1/api/teacher/main/day-schedule
   * Protected: returns the recurring schedule for the teacher in the token for the given date (default = today).
   * Query param: ?date=YYYY-MM-DD  (optional)
   */
  @UseGuards(JwtAuthGuard)
  @Get('day-schedule')
  async getDaySchedule(
    @Req() req: AuthenticatedRequest,
    @Query('date') dateStr?: string,
  ) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);

    let date = new Date();
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException(
          'Invalid date format, expected YYYY-MM-DD',
        );
      }
      date = parsed;
    }

    return this.service.getTeacherScheduleForDate(vinculoId, date);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.service.getProfile(req.user);
  }

  /**
   * (weekly schedule moved to v1/api/teacher/schedule)
   */
  /**
   * GET v1/api/teacher/main/subjects
   * Protected: returns all subjects (with course) that this professor teaches — useful for filters.
   * The professor identity is taken from the verified JWT (attached to request by JwtAuthGuard).
   */
  @UseGuards(JwtAuthGuard)
  @Get('subjects')
  async getSubjectsForFilter(@Req() req: AuthenticatedRequest) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);

    return this.service.getSubjectsForFilter(vinculoId);
  }

  /**
   * GET v1/api/teacher/main/stats
   * Protected: statistics for a given subject and course.
   * Query params: ?subjectId=<uuid>&courseId=<uuid>
   */
  @UseGuards(JwtAuthGuard)
  @Get('stats/:courseId/:subjectId')
  async getSubjectCourseStats(
    @Param('courseId') courseId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return await this.service.getSubjectCourseStatistics(subjectId, courseId);
  }
}
