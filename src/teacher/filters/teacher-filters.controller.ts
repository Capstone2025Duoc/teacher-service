import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-user';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TeacherFiltersService } from './teacher-filters.service';
import { resolveVinculoIdFromRequest } from '../utils/resolve-vinculo-id';

@Controller('v1/api/teacher/filters')
export class TeacherFiltersController {
  constructor(private readonly service: TeacherFiltersService) { }

  @UseGuards(JwtAuthGuard)
  @Get('course-subjects')
  async courseSubjectPairs(@Req() req: AuthenticatedRequest) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    const results = await this.service.getCourseSubjectPairs(vinculoId);
    return { count: results.length, items: results };
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses')
  async courses(@Req() req: AuthenticatedRequest) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    const courses =
      await this.service.getCourseFilterItemsForTeacher(vinculoId);
    return { count: courses.length, items: courses };
  }

  @UseGuards(JwtAuthGuard)
  @Get('subjects/:courseId')
  async subjects(@Req() req: AuthenticatedRequest, @Param('courseId') courseId: string) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    const subjectItems = await this.service.getSubjectsForTeacherCourse(
      vinculoId,
      courseId,
    );
    return { count: subjectItems.length, items: subjectItems };
  }

  @UseGuards(JwtAuthGuard)
  @Get('students/:courseId')
  async students(@Req() req: AuthenticatedRequest, @Param('courseId') courseId: string) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    const studentItems = await this.service.getStudentFilterItemsForCourse(
      vinculoId,
      courseId,
    );
    return { count: studentItems.length, items: studentItems };
  }

  @UseGuards(JwtAuthGuard)
  @Get('admins')
  async admins(@Req() req: AuthenticatedRequest) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    const admins = await this.service.getAdministratorFilterItems(vinculoId);
    return { count: admins.length, items: admins };
  }
}
