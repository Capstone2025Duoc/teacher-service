import { Injectable } from '@nestjs/common';
import { TeacherMainService } from '../teacher-main.service';

@Injectable()
export class TeacherCoursesService {
  constructor(private readonly mainService: TeacherMainService) {}

  resolveVinculoIdByPersonaAndColegio(personaId: string, colegioId: string) {
    return this.mainService.resolveVinculoIdByPersonaAndColegio(
      personaId,
      colegioId,
    );
  }

  getCourseSummaryForHead(vinculoId: string) {
    return this.mainService.getCourseSummaryForHead(vinculoId);
  }

  getStudentsAnalyticsForHead(vinculoId: string) {
    return this.mainService.getStudentsAnalyticsForHead(vinculoId);
  }
}
