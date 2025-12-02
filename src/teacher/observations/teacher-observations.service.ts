import { Injectable } from '@nestjs/common';
import { TeacherMainService } from '../teacher-main.service';

@Injectable()
export class TeacherObservationsService {
  constructor(private readonly mainService: TeacherMainService) {}

  resolveVinculoIdByPersonaAndColegio(personaId: string, colegioId: string) {
    return this.mainService.resolveVinculoIdByPersonaAndColegio(
      personaId,
      colegioId,
    );
  }

  getObservationsForTeacher(
    vinculoId: string,
    tipo?: string,
    courseId?: string,
  ) {
    return this.mainService.getObservationsForTeacher(
      vinculoId,
      tipo,
      courseId,
    );
  }

  async createObservation(
    vinculoId: string,
    courseId: string,
    payload: {
      alumnoVinculoId: string;
      tipo: string;
      cursoMateriaId?: string | null;
      titulo?: string | null;
      descripcion: string;
    },
  ) {
    // If caller provided a cursoMateriaId, try to resolve its curso_id and prefer that
    // This makes the endpoint tolerant if the path courseId and the provided
    // cursoMateriaId don't match (frontend sometimes supplies mismatched values).
    try {
      const { cursoMateriaId } = payload;
      if (cursoMateriaId) {
        const resolvedCourseId =
          await this.mainService.getCursoMateriaCourseId(cursoMateriaId);
        // Temporary debug logs to help diagnose mismatches during development.
        // These will appear in the teacher-service logs when the endpoint is called.
        // Remove or change to proper logger once diagnosis is complete.

        console.debug('[teacher-observations] createObservation called with', {
          cursoMateriaId,
          courseId,
          resolvedCourseId,
        });

        const effectiveCourseId = resolvedCourseId ?? courseId;
        return await this.mainService.createObservation(
          vinculoId,
          effectiveCourseId,
          payload,
        );
      }

      return await this.mainService.createObservation(
        vinculoId,
        courseId,
        payload,
      );
    } catch (error) {
      console.error('[teacher-observations] createObservation error', error);
      throw error;
    }
  }
}
