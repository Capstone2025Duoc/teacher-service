import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-user';
import { TeacherScheduleService } from './teacher-schedule.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { resolveVinculoIdFromRequest } from '../utils/resolve-vinculo-id';

@Controller('v1/api/teacher/schedule')
export class TeacherScheduleController {
  constructor(private readonly service: TeacherScheduleService) { }

  @UseGuards(JwtAuthGuard)
  @Get('week')
  async getWeekSchedule(@Req() req: AuthenticatedRequest) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    return this.service.getTeacherWeeklySchedule(vinculoId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getScheduleStats(@Req() req: AuthenticatedRequest) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    return this.service.getTeacherScheduleStatistics(vinculoId);
  }
}
