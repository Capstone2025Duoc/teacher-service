import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { TeacherMainController } from '../src/teacher/main/teacher-main.controller';
import { TeacherScheduleController } from '../src/teacher/schedule/teacher-schedule.controller';
import { TeacherMainDomainService } from '../src/teacher/main/teacher-main-domain.service';
import { TeacherScheduleService } from '../src/teacher/schedule/teacher-schedule.service';

const fakeUser = {
  sub: 'v-teacher',
  personaId: 'p-teacher',
  colegioId: 'c-teacher',
  rol: 'profesor',
};

class JwtAuthGuardStub implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.user = fakeUser;
    return true;
  }
}

const profileResponse = {
  nombre: 'Marcela',
  email: 'marcela@campus',
  colegio: { id: 'c-teacher', nombre: 'Colegio Norte' },
};
const dayScheduleResponse = [
  {
    horarioId: 'h-day',
    startTime: '08:00:00',
    endTime: '09:30:00',
    subjectName: 'Historia',
    courseName: '202',
    salaName: 'Aula 2',
  },
];
const weeklyScheduleResponse = {
  monday: [],
  tuesday: [
    {
      horarioId: 'h-1',
      startTime: '09:00',
      subjectName: 'Física',
      courseName: '301',
    },
  ],
  wednesday: [],
  thursday: [],
  friday: [],
};
const scheduleStatsResponse = {
  totalHorarios: 5,
  weeklyHours: 12,
  distinctCourses: 2,
  salaCount: 3,
};
const subjectsResponse = [
  {
    courseId: 'c-1',
    courseName: '101',
    subjectId: 'm-1',
    subjectName: 'Lenguaje',
  },
];
const courseStatsResponse = {
  courseId: 'c-1',
  subjectId: 'm-1',
  studentsCount: 30,
  attendanceAverage: 85,
  subjectAverage: 6.2,
};

const teacherMainDomainServiceMock = {
  resolveVinculoIdByPersonaAndColegio: jest.fn().mockResolvedValue('v-teacher'),
  getTeacherScheduleForDate: jest.fn().mockResolvedValue(dayScheduleResponse),
  getSubjectsForFilter: jest.fn().mockResolvedValue(subjectsResponse),
  getSubjectCourseStatistics: jest.fn().mockResolvedValue(courseStatsResponse),
  getProfile: jest.fn().mockResolvedValue(profileResponse),
};

const teacherScheduleServiceMock = {
  resolveVinculoIdByPersonaAndColegio: jest.fn().mockResolvedValue('v-teacher'),
  getTeacherWeeklySchedule: jest.fn().mockResolvedValue(weeklyScheduleResponse),
  getTeacherScheduleStatistics: jest
    .fn()
    .mockResolvedValue(scheduleStatsResponse),
};

let app: INestApplication;

describe('TeacherController (e2e)', () => {
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TeacherMainController, TeacherScheduleController],
      providers: [
        {
          provide: TeacherMainDomainService,
          useValue: teacherMainDomainServiceMock,
        },
        {
          provide: TeacherScheduleService,
          useValue: teacherScheduleServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new JwtAuthGuardStub())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns teacher profile and honors guard', async () => {
    await request(app.getHttpServer())
      .get('/v1/api/teacher/main/profile')
      .expect(200)
      .expect(profileResponse);
    expect(teacherMainDomainServiceMock.getProfile).toHaveBeenCalledWith(
      fakeUser,
    );
  });

  it('serves today schedule with date override', async () => {
    await request(app.getHttpServer())
      .get('/v1/api/teacher/main/day-schedule?date=2025-12-01')
      .expect(200)
      .expect(dayScheduleResponse);
    expect(
      teacherMainDomainServiceMock.getTeacherScheduleForDate,
    ).toHaveBeenCalled();
  });

  it('exposes subjects filter data and course stats', async () => {
    await request(app.getHttpServer())
      .get('/v1/api/teacher/main/subjects')
      .expect(200)
      .expect(subjectsResponse);
    await request(app.getHttpServer())
      .get('/v1/api/teacher/main/stats/c-1/m-1')
      .expect(200)
      .expect(courseStatsResponse);
    expect(
      teacherMainDomainServiceMock.getSubjectsForFilter,
    ).toHaveBeenCalledWith('v-teacher');
    expect(
      teacherMainDomainServiceMock.getSubjectCourseStatistics,
    ).toHaveBeenCalledWith('m-1', 'c-1');
  });

  it('delivers weekly schedule + stats via schedule controller', async () => {
    await request(app.getHttpServer())
      .get('/v1/api/teacher/schedule/week')
      .expect(200)
      .expect(weeklyScheduleResponse);
    await request(app.getHttpServer())
      .get('/v1/api/teacher/schedule/stats')
      .expect(200)
      .expect(scheduleStatsResponse);
    expect(
      teacherScheduleServiceMock.getTeacherWeeklySchedule,
    ).toHaveBeenCalledWith('v-teacher');
    expect(
      teacherScheduleServiceMock.getTeacherScheduleStatistics,
    ).toHaveBeenCalledWith('v-teacher');
  });
});
