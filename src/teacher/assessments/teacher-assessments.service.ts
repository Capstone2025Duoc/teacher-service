import { Injectable } from '@nestjs/common';
import { TeacherMainService } from '../teacher-main.service';

@Injectable()
export class TeacherAssessmentsService {
  constructor(private readonly mainService: TeacherMainService) {}

  resolveVinculoIdByPersonaAndColegio(personaId: string, colegioId: string) {
    return this.mainService.resolveVinculoIdByPersonaAndColegio(
      personaId,
      colegioId,
    );
  }

  getStudentsWithGrades(
    vinculoId: string,
    courseId: string,
    subjectId: string,
  ) {
    return this.mainService.getStudentsWithGrades(
      vinculoId,
      courseId,
      subjectId,
    );
  }

  getCoursesForTeacher(vinculoId: string) {
    return this.mainService.getCoursesForTeacher(vinculoId);
  }

  getCursoMateriasForTeacher(vinculoId: string, courseId: string) {
    return this.mainService.getCursoMateriasForTeacher(vinculoId, courseId);
  }

  getSubjectsForTeacherInCourse(vinculoId: string, courseId: string) {
    return this.mainService.getSubjectsForTeacherInCourse(vinculoId, courseId);
  }

  getCursosMateriasForTeacherAndSubject(
    vinculoId: string,
    subjectId: string,
    courseId: string,
  ) {
    return this.mainService.getCursosMateriasForTeacherAndSubject(
      vinculoId,
      subjectId,
      courseId,
    );
  }

  getEvaluationsWithGradingInfo(
    vinculoId: string,
    subjectId: string,
    courseId: string,
  ) {
    return this.mainService.getEvaluationsWithGradingInfo(
      vinculoId,
      subjectId,
      courseId,
    );
  }

  createEvaluation(
    vinculoId: string,
    courseId: string,
    subjectId: string,
    payload: { name: string; tipo?: string; fecha: string },
  ) {
    return this.mainService.createEvaluation(
      vinculoId,
      courseId,
      subjectId,
      payload,
    );
  }

  upsertNote(
    vinculoId: string,
    evaluationId: string,
    payload: {
      alumnoVinculoId: string;
      nota: number;
      retroalimentacion?: string;
    },
  ) {
    return this.mainService.upsertNote(vinculoId, evaluationId, payload);
  }

  getStudentsForCourse(vinculoId: string, courseId: string) {
    return this.mainService.getStudentsForCourse(vinculoId, courseId);
  }

  getCourseSubjectExamStats(subjectId: string, courseId: string) {
    return this.mainService.getCourseSubjectExamStats(subjectId, courseId);
  }

  isHeadOfCourse(vinculoId: string, courseId: string) {
    return this.mainService.isHeadOfCourse(vinculoId, courseId);
  }
}
