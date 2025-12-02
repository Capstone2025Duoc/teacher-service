import { Injectable } from '@nestjs/common';
import { TeacherMainService } from '../teacher-main.service';

@Injectable()
export class TeacherScheduleService {
  constructor(private readonly mainService: TeacherMainService) {}

  resolveVinculoIdByPersonaAndColegio(personaId: string, colegioId: string) {
    return this.mainService.resolveVinculoIdByPersonaAndColegio(
      personaId,
      colegioId,
    );
  }

  getTeacherWeeklySchedule(vinculoId: string) {
    return this.mainService.getTeacherWeeklySchedule(vinculoId);
  }

  getTeacherScheduleStatistics(vinculoId: string) {
    return this.mainService.getTeacherScheduleStatistics(vinculoId);
  }
}
