import { Repository, ObjectLiteral } from 'typeorm';
import { TeacherMainService } from './teacher-main.service';
import { Clase } from '../entities/clase.entity';
import { CursosMaterias } from '../entities/cursos-materias.entity';
import { Horario } from '../entities/horario.entity';
import { ProfesorMateria } from '../entities/profesores-materias.entity';
import { Vinculo } from '../entities/vinculo.entity';
import {
  Notificacion,
  NotificacionDestinatario,
} from '../entities/notificacion.entity';

type MockRepo<T extends ObjectLiteral = any> = Partial<Record<keyof Repository<T>, jest.Mock>> & {
  manager?: { query?: jest.Mock };
};

const mockRepo = <T = any>(): MockRepo<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  manager: { query: jest.fn() },
  createQueryBuilder: jest.fn(),
});

const createQueryBuilderMock = () => {
  const builder: any = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  };
  return builder;
};

describe('TeacherMainService', () => {
  let service: TeacherMainService;
  let cursosMateriasRepo: MockRepo<CursosMaterias>;
  let claseRepo: MockRepo<Clase>;
  let horarioRepo: MockRepo<Horario>;
  let vinculoRepo: MockRepo<Vinculo>;
  let profesorMateriaRepo: MockRepo<ProfesorMateria>;
  let notificacionRepo: MockRepo<Notificacion>;
  let notificacionDestinatarioRepo: MockRepo<NotificacionDestinatario>;

  beforeEach(() => {
    cursosMateriasRepo = mockRepo<CursosMaterias>();
    claseRepo = mockRepo<Clase>();
    horarioRepo = mockRepo<Horario>();
    vinculoRepo = mockRepo<Vinculo>();
    profesorMateriaRepo = mockRepo<ProfesorMateria>();
    notificacionRepo = mockRepo<Notificacion>();
    notificacionDestinatarioRepo = mockRepo<NotificacionDestinatario>();

    service = new TeacherMainService(
      cursosMateriasRepo as Repository<CursosMaterias>,
      claseRepo as Repository<Clase>,
      horarioRepo as Repository<Horario>,
      vinculoRepo as Repository<Vinculo>,
      profesorMateriaRepo as Repository<ProfesorMateria>,
      notificacionRepo as Repository<Notificacion>,
      notificacionDestinatarioRepo as Repository<NotificacionDestinatario>,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('getOverview', () => {
    it('returns subjects and last class when cursos_materias exist', async () => {
      const cms = [
        {
          cursoId: 'c-1',
          curso: { nombre: '101 Básico' },
          materiaId: 'm-1',
          materia: { nombre: 'Lenguaje' },
        },
      ];
      cursosMateriasRepo.find!.mockResolvedValue(cms);

      const builder = createQueryBuilderMock();
      claseRepo.createQueryBuilder!.mockReturnValue(builder);
      const lastClass = {
        id: 'cl-1',
        fecha: '2025-11-28',
        tema: 'Repaso',
        observaciones: 'Todo bien',
        cursoMateria: {
          cursoId: 'c-1',
          curso: { nombre: '101 Básico' },
          materiaId: 'm-1',
          materia: { nombre: 'Lenguaje' },
        },
      };
      builder.getOne.mockResolvedValue(lastClass);

      const result = await service.getOverview('v-1');

      expect(result.subjects).toEqual([
        {
          courseId: 'c-1',
          courseName: '101 Básico',
          subjectId: 'm-1',
          subjectName: 'Lenguaje',
        },
      ]);
      expect(result.lastClass).toMatchObject({
        classId: 'cl-1',
        date: '2025-11-28',
        courseId: 'c-1',
        courseName: '101 Básico',
        subjectId: 'm-1',
        subjectName: 'Lenguaje',
        topic: 'Repaso',
      });
    });

    it('falls back to profesor_materia when no course filter and no cms', async () => {
      cursosMateriasRepo.find!.mockResolvedValue([]);
      profesorMateriaRepo.find!.mockResolvedValue([
        { materiaId: 'm-2', materia: { nombre: 'Historia' } },
      ]);

      const result = await service.getOverview('v-1');

      expect(result.subjects).toEqual([
        {
          courseId: null,
          courseName: '',
          subjectId: 'm-2',
          subjectName: 'Historia',
        },
      ]);
      expect(result.lastClass).toBeUndefined();
    });
  });

  describe('getProfile', () => {
    it('builds profile using persona, colegio and vinculo data', async () => {
      vinculoRepo
        .manager!.query!.mockResolvedValueOnce([
          {
            id: 'p-1',
            nombre: 'Laura',
            apellido_paterno: 'Martínez',
            apellido_materno: 'Lara',
            contacto_email: 'laura@test',
          },
        ])
        .mockResolvedValueOnce([
          { id: 'c-1', nombre_institucion: 'Colegio Norte' },
        ]);
      vinculoRepo.findOne!.mockResolvedValue({
        emailInstitucional: 'laura@school',
        id: 'v-1',
      });

      const result = await service.getProfile({
        personaId: 'p-1',
        sub: 'user-1',
        rol: 'profesor',
        colegioId: 'c-1',
      });

      expect(result.nombre).toBe('Laura Martínez Lara');
      expect(result.email).toBe('laura@school');
      expect(result.colegio).toEqual({ id: 'c-1', nombre: 'Colegio Norte' });
    });
  });

  describe('resolveVinculoIdByPersonaAndColegio', () => {
    it('returns vinculo id when found', async () => {
      vinculoRepo.findOne!.mockResolvedValue({ id: 'v-2' });
      const result = await service.resolveVinculoIdByPersonaAndColegio(
        'p-2',
        'c-2',
      );
      expect(result).toBe('v-2');
    });
  });

  describe('getSubjectsForFilter', () => {
    it('deduplicates duplicate cursos_materias entries', async () => {
      cursosMateriasRepo.find!.mockResolvedValue([
        {
          cursoId: 'c-1',
          materiaId: 'm-1',
          curso: { nombre: '101' },
          materia: { nombre: 'Lenguaje' },
        },
        {
          cursoId: 'c-1',
          materiaId: 'm-1',
          curso: { nombre: '101' },
          materia: { nombre: 'Lenguaje' },
        },
      ]);

      const result = await service.getSubjectsForFilter('v-3');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ subjectId: 'm-1', courseName: '101' });
    });

    it('falls back to profesor_materia when no cms', async () => {
      cursosMateriasRepo.find!.mockResolvedValue([]);
      profesorMateriaRepo.find!.mockResolvedValue([
        { materiaId: 'm-3', materia: { nombre: 'Ciencias' } },
      ]);

      const result = await service.getSubjectsForFilter('v-3');

      expect(result).toEqual([
        {
          courseId: null,
          courseName: '',
          subjectId: 'm-3',
          subjectName: 'Ciencias',
        },
      ]);
    });
  });

  describe('getSubjectsForTeacherInCourse', () => {
    it('returns subjects assigned to a specific course', async () => {
      cursosMateriasRepo.find!.mockResolvedValueOnce([
        {
          cursoId: 'c-2',
          curso: { nombre: '202' },
          materiaId: 'm-4',
          materia: { nombre: 'Química' },
        },
      ]);

      const result = await service.getSubjectsForTeacherInCourse('v-4', 'c-2');

      expect(result).toEqual([
        {
          courseId: 'c-2',
          courseName: '202',
          subjectId: 'm-4',
          subjectName: 'Química',
        },
      ]);
    });

    it('falls back to profesor_materia matching course materias when cms absent', async () => {
      cursosMateriasRepo
        .find!.mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { materiaId: 'm-5', curso: { nombre: '303' }, cursoId: 'c-3' },
        ]);
      profesorMateriaRepo.find!.mockResolvedValue([
        { materiaId: 'm-5', materia: { nombre: 'Física' } },
      ]);

      const result = await service.getSubjectsForTeacherInCourse('v-5', 'c-3');

      expect(result).toEqual([
        {
          courseId: 'c-3',
          courseName: '303',
          subjectId: 'm-5',
          subjectName: 'Física',
        },
      ]);
    });
  });

  describe('getSubjectToday', () => {
    it('returns subjects, courses and schedules for the given subject', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-12-01T12:00:00Z'));
      cursosMateriasRepo.find!.mockResolvedValue([
        {
          cursoId: 'c-4',
          curso: { nombre: '401' },
          materiaId: 'm-6',
          materia: { nombre: 'Física' },
        },
      ]);

      const builder = createQueryBuilderMock();
      horarioRepo.createQueryBuilder!.mockReturnValue(builder);
      builder.getMany.mockResolvedValue([
        {
          id: 'h-1',
          diaSemana: 1,
          horaInicio: '08:00:00',
          horaFin: '09:00:00',
          cursoMateria: {
            cursoId: 'c-4',
            curso: { nombre: '401' },
            materiaId: 'm-6',
            materia: { nombre: 'Física' },
          },
          salaId: 's-1',
          sala: { nombre: 'Sala A' },
        },
      ]);

      const result = await service.getSubjectToday('m-6');

      expect(result.subjects).toHaveLength(1);
      expect(result.courses).toEqual([{ courseId: 'c-4', courseName: '401' }]);
      expect(result.schedules[0]).toMatchObject({
        scheduleId: 'h-1',
        subjectName: 'Física',
        salaName: 'Sala A',
      });
    });
  });

  describe('getTeacherScheduleForDate', () => {
    it('returns mapped horarios for the given date', async () => {
      const date = new Date('2025-12-02T00:00:00Z');
      const builder = createQueryBuilderMock();
      horarioRepo.createQueryBuilder!.mockReturnValue(builder);
      builder.getMany.mockResolvedValue([
        {
          id: 'h-2',
          diaSemana: 2,
          horaInicio: '10:00:00',
          horaFin: '11:30:00',
          cursoMateria: {
            cursoId: 'c-5',
            curso: { nombre: '501' },
            materiaId: 'm-7',
            materia: { nombre: 'Biología' },
          },
          salaId: null,
          sala: null,
        },
      ]);

      const result = await service.getTeacherScheduleForDate('v-6', date);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        courseName: '501',
        subjectName: 'Biología',
        salaId: null,
      });
    });
  });
});
