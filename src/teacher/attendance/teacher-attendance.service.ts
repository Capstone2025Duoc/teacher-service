import { Injectable } from '@nestjs/common';
import { TeacherMainService } from '../teacher-main.service';

@Injectable()
export class TeacherAttendanceService {
  constructor(private readonly mainService: TeacherMainService) {}

  resolveVinculoIdByPersonaAndColegio(personaId: string, colegioId: string) {
    return this.mainService.resolveVinculoIdByPersonaAndColegio(
      personaId,
      colegioId,
    );
  }

  getCoursesForTeacher(vinculoId: string) {
    return this.mainService.getCoursesForTeacher(vinculoId);
  }

  getStudentsForCourse(vinculoId: string, courseId: string) {
    return this.mainService.getStudentsForCourse(vinculoId, courseId);
  }

  getAttendanceForCourseByDate(
    vinculoId: string,
    courseId: string,
    fecha: string,
  ) {
    return this.mainService.getAttendanceForCourseByDate(
      vinculoId,
      courseId,
      fecha,
    );
  }

  updateAttendanceEntries(
    vinculoId: string,
    courseId: string,
    fecha: string,
    updates: Array<{
      alumnoVinculoId: string;
      estado: 'presente' | 'ausente' | 'tardanza';
    }>,
  ) {
    return this.mainService.updateAttendanceEntries(
      vinculoId,
      courseId,
      fecha,
      updates,
    );
  }

  recordAttendance(
    vinculoId: string,
    courseId: string,
    payload: {
      cursoMateriaId?: string;
      fecha: string;
      attendances: Array<{
        alumnoVinculoId: string;
        estado: 'presente' | 'ausente' | 'tardanza';
      }>;
    },
  ) {
    return this.mainService.recordAttendance(vinculoId, courseId, payload);
  }
}
