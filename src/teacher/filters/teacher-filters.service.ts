import { Injectable } from '@nestjs/common';
import { TeacherMainService } from '../teacher-main.service';

@Injectable()
export class TeacherFiltersService {
  constructor(private readonly mainService: TeacherMainService) {}

  resolveVinculoIdByPersonaAndColegio(personaId: string, colegioId: string) {
    return this.mainService.resolveVinculoIdByPersonaAndColegio(
      personaId,
      colegioId,
    );
  }

  getCourseSubjectPairs(vinculoId: string) {
    return this.mainService.getCourseSubjectPairs(vinculoId);
  }

  getCourseFilterItemsForTeacher(vinculoId: string) {
    return this.mainService.getCourseFilterItemsForTeacher(vinculoId);
  }

  getSubjectsForTeacherCourse(vinculoId: string, courseId: string) {
    return this.mainService.getSubjectsForTeacherCourse(vinculoId, courseId);
  }

  getStudentFilterItemsForCourse(vinculoId: string, courseId: string) {
    return this.mainService.getStudentFilterItemsForCourse(vinculoId, courseId);
  }

  getAdministratorFilterItems(vinculoId: string) {
    return this.mainService.getAdministratorFilterItemsForColegio(vinculoId);
  }
}
