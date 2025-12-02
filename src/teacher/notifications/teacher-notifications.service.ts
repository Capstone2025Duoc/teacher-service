import { Injectable } from '@nestjs/common';
import { TeacherMainService } from '../teacher-main.service';

@Injectable()
export class TeacherNotificationsService {
  constructor(private readonly mainService: TeacherMainService) {}

  resolveVinculoIdByPersonaAndColegio(personaId: string, colegioId: string) {
    return this.mainService.resolveVinculoIdByPersonaAndColegio(
      personaId,
      colegioId,
    );
  }

  getNotificationsForTeacher(
    vinculoId: string,
    options?: { unreadOnly?: boolean },
  ) {
    return this.mainService.getNotificationsForTeacher(vinculoId, options);
  }

  markNotificationReadForTeacher(
    vinculoId: string,
    notificationId: string,
    read = true,
  ) {
    return this.mainService.markNotificationReadForTeacher(
      vinculoId,
      notificationId,
      read,
    );
  }
}
