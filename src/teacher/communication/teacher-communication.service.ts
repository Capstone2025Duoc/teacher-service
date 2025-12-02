import { Injectable } from '@nestjs/common';
import { TeacherMainService } from '../teacher-main.service';
import type { TeacherCommunicationsResponse } from '../teacher-main.service';

@Injectable()
export class TeacherCommunicationService {
  constructor(private readonly mainService: TeacherMainService) {}

  resolveVinculoIdByPersonaAndColegio(personaId: string, colegioId: string) {
    return this.mainService.resolveVinculoIdByPersonaAndColegio(
      personaId,
      colegioId,
    );
  }

  listCommunicationsForTeacher(
    vinculoId: string,
    options?: { limit?: number },
  ): Promise<TeacherCommunicationsResponse> {
    return this.mainService.getCommunicationsForTeacher(vinculoId, options);
  }

  createCommunication(
    vinculoId: string,
    payload: {
      cursoId?: string;
      estudianteId?: string;
      profesorId?: string;
      administradorId?: string;
      asunto: string;
      tipo?: string;
      descripcion?: string;
    },
  ): Promise<{ notificationId: string; recipients: number }> {
    return this.mainService.createCommunication(vinculoId, payload);
  }
}
