import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-user';
import { TeacherNotificationsService } from './teacher-notifications.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { resolveVinculoIdFromRequest } from '../utils/resolve-vinculo-id';

@Controller('v1/api/teacher/notifications')
export class TeacherNotificationsController {
  constructor(private readonly service: TeacherNotificationsService) { }

  @UseGuards(JwtAuthGuard)
  @Get()
  async listNotifications(
    @Req() req: AuthenticatedRequest,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    return this.service.getNotificationsForTeacher(vinculoId, {
      unreadOnly: unreadOnly === 'true',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  async markRead(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('read') read?: boolean,
  ) {
    if (!id) {
      throw new BadRequestException('Notification id is required');
    }
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    const shouldRead = read !== false;
    return this.service.markNotificationReadForTeacher(
      vinculoId,
      id,
      shouldRead,
    );
  }
}
