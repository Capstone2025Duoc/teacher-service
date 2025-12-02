import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-user';
import { TeacherAttendanceService } from './teacher-attendance.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { resolveVinculoIdFromRequest } from '../utils/resolve-vinculo-id';

type AttendanceState = 'presente' | 'ausente' | 'tardanza';

type AttendanceUpdate = {
  alumnoVinculoId: string;
  estado: AttendanceState;
};

type UpdateAttendanceBody = {
  updates?: AttendanceUpdate[];
};

type TakeAttendanceBody = {
  cursoMateriaId?: string;
  fecha?: string;
  attendances?: AttendanceUpdate[];
};

@Controller('v1/api/teacher/attendance')
export class TeacherAttendanceController {
  constructor(private readonly service: TeacherAttendanceService) {}

  @UseGuards(JwtAuthGuard)
  @Get('courses')
  async getCourses(@Req() req: AuthenticatedRequest) {
    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    return this.service.getCoursesForTeacher(vinculoId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId/students')
  async getStudentsForCourse(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
  ) {
    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }

    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    return this.service.getStudentsForCourse(vinculoId, courseId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId/:fecha')
  async getAttendanceForCourse(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
    @Param('fecha') fecha: string,
  ) {
    if (!courseId || !fecha) {
      throw new BadRequestException('courseId and fecha are required');
    }

    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fecha)) {
      throw new BadRequestException(
        'Invalid fecha format, expected YYYY-MM-DD',
      );
    }

    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);
    return this.service.getAttendanceForCourseByDate(
      vinculoId,
      courseId,
      fecha,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('courses/:courseId/:fecha')
  async updateAttendanceEntries(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
    @Param('fecha') fecha: string,
    @Body() body: UpdateAttendanceBody,
  ) {
    if (!courseId || !fecha) {
      throw new BadRequestException('courseId and fecha are required');
    }

    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fecha)) {
      throw new BadRequestException(
        'Invalid fecha format, expected YYYY-MM-DD',
      );
    }

    const updates = body?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new BadRequestException('Missing updates payload');
    }

    for (const update of updates) {
      if (!update?.alumnoVinculoId || !update?.estado) {
        throw new BadRequestException(
          'Each update needs alumnoVinculoId and estado',
        );
      }
    }

    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);

    try {
      return await this.service.updateAttendanceEntries(
        vinculoId,
        courseId,
        fecha,
        updates,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('not authorized')) {
        throw new ForbiddenException(
          'Not authorized to update attendance for this course',
        );
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('take/:courseId')
  async takeAttendance(
    @Req() req: AuthenticatedRequest,
    @Param('courseId') courseId: string,
    @Body() body: TakeAttendanceBody,
  ) {
    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }

    const fecha = body?.fecha;
    const attendances = body?.attendances;
    if (!fecha || !Array.isArray(attendances) || attendances.length === 0) {
      throw new BadRequestException('fecha and attendances are required');
    }

    const vinculoId = await resolveVinculoIdFromRequest(req, this.service);

    try {
      return await this.service.recordAttendance(vinculoId, courseId, {
        cursoMateriaId: body.cursoMateriaId,
        fecha,
        attendances,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not authorized')) {
        throw new ForbiddenException(
          'Not authorized to record attendance for this course',
        );
      }
      throw error;
    }
  }
}
