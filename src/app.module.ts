// Ensure a global `crypto` exists for libraries that expect Web Crypto API
if (typeof (globalThis as any).crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto');
  (globalThis as any).crypto = nodeCrypto.webcrypto || nodeCrypto;
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TeacherMainController } from './teacher/main/teacher-main.controller';
import { TeacherAttendanceController } from './teacher/attendance/teacher-attendance.controller';
import { TeacherScheduleController } from './teacher/schedule/teacher-schedule.controller';
import { TeacherAssessmentsController } from './teacher/assessments/teacher-assessments.controller';
import { TeacherObservationsController } from './teacher/observations/teacher-observations.controller';
import { TeacherCoursesController } from './teacher/courses/teacher-courses.controller';
import { TeacherNotificationsController } from './teacher/notifications/teacher-notifications.controller';
import { TeacherFiltersController } from './teacher/filters/teacher-filters.controller';
import { TeacherCommunicationController } from './teacher/communication/teacher-communication.controller';
import { TeacherEvaluationsController } from './teacher/evaluations/teacher-evaluations.controller';
import { TeacherMainService } from './teacher/teacher-main.service';
import { TeacherMainDomainService } from './teacher/main/teacher-main-domain.service';
import { TeacherAttendanceService } from './teacher/attendance/teacher-attendance.service';
import { TeacherScheduleService } from './teacher/schedule/teacher-schedule.service';
import { TeacherCoursesService } from './teacher/courses/teacher-courses.service';
import { TeacherCommunicationService } from './teacher/communication/teacher-communication.service';
import { TeacherNotificationsService } from './teacher/notifications/teacher-notifications.service';
import { TeacherObservationsService } from './teacher/observations/teacher-observations.service';
import { TeacherAssessmentsService } from './teacher/assessments/teacher-assessments.service';
import { TeacherEvaluationsService } from './teacher/evaluations/teacher-evaluations.service';
import { TeacherFiltersService } from './teacher/filters/teacher-filters.service';
import { Vinculo } from './entities/vinculo.entity';
import { Materia } from './entities/materia.entity';
import { Curso } from './entities/curso.entity';
import { CursosMaterias } from './entities/cursos-materias.entity';
import { Clase } from './entities/clase.entity';
import { ProfesorMateria } from './entities/profesores-materias.entity';
import { Horario } from './entities/horario.entity';
import { Sala } from './entities/sala.entity';
import {
  Notificacion,
  NotificacionDestinatario,
} from './entities/notificacion.entity';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'sage_user',
      password: process.env.DB_PASSWORD ?? 'sage_password',
      database: process.env.DB_NAME ?? 'sage',
      entities: [
        Vinculo,
        Materia,
        Curso,
        CursosMaterias,
        Clase,
        ProfesorMateria,
        Horario,
        Sala,
        Notificacion,
        NotificacionDestinatario,
      ],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([
      Vinculo,
      Materia,
      Curso,
      CursosMaterias,
      Clase,
      ProfesorMateria,
      Horario,
      Sala,
      Notificacion,
      NotificacionDestinatario,
    ]),
  ],
  controllers: [
    AppController,
    TeacherMainController,
    TeacherAttendanceController,
    TeacherScheduleController,
    TeacherCoursesController,
    TeacherAssessmentsController,
    TeacherNotificationsController,
    TeacherObservationsController,
    TeacherCommunicationController,
    TeacherFiltersController,
    TeacherEvaluationsController,
  ],
  providers: [
    AppService,
    TeacherMainService,
    TeacherMainDomainService,
    TeacherAttendanceService,
    TeacherScheduleService,
    TeacherCoursesService,
    TeacherCommunicationService,
    TeacherNotificationsService,
    TeacherObservationsService,
    TeacherAssessmentsService,
    TeacherEvaluationsService,
    TeacherFiltersService,
    JwtAuthGuard,
  ],
})
export class AppModule { }
