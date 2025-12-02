import { Injectable } from '@nestjs/common';
import { TeacherMainService } from '../teacher-main.service';
import type { AuthenticatedUser } from '../../auth/authenticated-user';

@Injectable()
export class TeacherMainDomainService {
  constructor(private readonly mainService: TeacherMainService) {}

  resolveVinculoIdByPersonaAndColegio(personaId: string, colegioId: string) {
    return this.mainService.resolveVinculoIdByPersonaAndColegio(
      personaId,
      colegioId,
    );
  }

  getTeacherScheduleForDate(vinculoId: string, date: Date) {
    return this.mainService.getTeacherScheduleForDate(vinculoId, date);
  }

  getSubjectsForFilter(vinculoId: string) {
    return this.mainService.getSubjectsForFilter(vinculoId);
  }

  getSubjectCourseStatistics(subjectId: string, courseId: string) {
    return this.mainService.getSubjectCourseStatistics(subjectId, courseId);
  }

  getProfile(user: AuthenticatedUser) {
    return this.mainService.getProfile(user);
  }
}
