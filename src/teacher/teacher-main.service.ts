import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TeacherMainOverviewDto,
  SubjectDto,
  LastClassDto,
} from './dto/teacher-main.dto';
import { CursosMaterias } from '../entities/cursos-materias.entity';
import { Clase } from '../entities/clase.entity';
import { ProfesorMateria } from '../entities/profesores-materias.entity';
import { Horario } from '../entities/horario.entity';
import { Vinculo } from '../entities/vinculo.entity';
import {
  Notificacion,
  NotificacionDestinatario,
} from '../entities/notificacion.entity';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type RiskCategory = 'bajo' | 'medio' | 'alto' | 'critico';

type StudentAnalyticsItem = {
  alumnoVinculoId: string;
  rut: string | null;
  nombreCompleto: string | null;
  promedio: number | null;
  asistenciaPercent: number;
  riesgoPercent: number;
  riesgoCategoria: RiskCategory;
};

type StudentsAnalyticsResponse = {
  students: StudentAnalyticsItem[];
  mediumRiskCount: number;
  criticalRiskCount: number;
};

export type TeacherCommunicationItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  metadata: Record<string, any> | null;
  courseId: string | null;
  createdAt: Date;
  recipients: number;
  readRecipients: number;
};

export type TeacherCommunicationsResponse = {
  total: number;
  items: TeacherCommunicationItem[];
};

type TeacherCommunicationPayload = {
  cursoId?: string;
  estudianteId?: string;
  profesorId?: string;
  administradorId?: string;
  asunto: string;
  tipo?: string;
  descripcion?: string;
};

@Injectable()
export class TeacherMainService {
  constructor(
    @InjectRepository(CursosMaterias)
    private readonly cursosMateriasRepo: Repository<CursosMaterias>,
    @InjectRepository(Clase)
    private readonly claseRepo: Repository<Clase>,
    @InjectRepository(Horario)
    private readonly horarioRepo: Repository<Horario>,
    @InjectRepository(Vinculo)
    private readonly vinculoRepo: Repository<Vinculo>,
    @InjectRepository(ProfesorMateria)
    private readonly profesorMateriaRepo: Repository<ProfesorMateria>,
    @InjectRepository(Notificacion)
    private readonly notificacionRepo: Repository<Notificacion>,
    @InjectRepository(NotificacionDestinatario)
    private readonly notificacionDestinatarioRepo: Repository<NotificacionDestinatario>,
  ) {}

  /**
   * Get the subjects that this teacher teaches and the last class they taught.
   */
  async getOverview(
    vinculoId: string,
    courseId?: string,
  ): Promise<TeacherMainOverviewDto> {
    // 1) subjects: find cursos_materias for this professor and include materia and curso
    const where: any = { profesorVinculoId: vinculoId };
    if (courseId) where.cursoId = courseId;

    const cms = await this.cursosMateriasRepo.find({
      where,
      relations: ['materia', 'curso'],
    });

    const subjects: SubjectDto[] = cms.map((cm) => ({
      courseId: cm.cursoId,
      courseName: cm.curso?.nombre ?? '',
      subjectId: cm.materiaId,
      subjectName: cm.materia?.nombre ?? '',
    }));

    // If there are no cursos_materias and no course filter was provided,
    // fall back to profesores_materias (these are professor-level subjects without a course).
    if (subjects.length === 0 && !courseId) {
      const pm = await this.profesorMateriaRepo.find({
        where: { profesorVinculoId: vinculoId },
        relations: ['materia'],
      });
      if (pm.length > 0) {
        return {
          vinculoId,
          subjects: pm.map((p) => ({
            courseId: null,
            courseName: '',
            subjectId: p.materiaId,
            subjectName: p.materia?.nombre ?? '',
          })),
          lastClass: undefined,
        };
      }
    }

    // 2) last class: query clases joined to cursos_materias -> materia & curso, filter by profesor vinculo
    const qb = this.claseRepo
      .createQueryBuilder('cl')
      .innerJoinAndSelect('cl.cursoMateria', 'cm')
      .innerJoinAndSelect('cm.materia', 'm')
      .innerJoinAndSelect('cm.curso', 'c')
      .where('cm.profesor_vinculo_id = :vinculoId', { vinculoId });
    if (courseId) {
      qb.andWhere('cm.curso_id = :cursoId', { cursoId: courseId });
    }

    qb.orderBy('cl.fecha', 'DESC')
      .addOrderBy('cl.hora_inicio', 'DESC')
      .limit(1);

    const lastClass = await qb.getOne();

    let lastClassDto: LastClassDto | undefined = undefined;
    if (lastClass) {
      lastClassDto = {
        classId: lastClass.id,
        date: lastClass.fecha?.toString?.() ?? lastClass.fecha,
        courseId: lastClass.cursoMateria?.cursoId ?? lastClass.cursoMateriaId,
        courseName: lastClass.cursoMateria?.curso?.nombre ?? '',
        subjectId:
          lastClass.cursoMateria?.materiaId ??
          lastClass.cursoMateria?.materia?.id,
        subjectName: lastClass.cursoMateria?.materia?.nombre ?? '',
        topic: lastClass.tema,
        observations: lastClass.observaciones,
      };
    }

    return {
      vinculoId,
      subjects,
      lastClass: lastClassDto,
    };
  }

  /**
   * Fetch authenticated teacher profile (persona + colegio data).
   */
  async getProfile(user: AuthenticatedUser) {
    const personaId = user.personaId ?? user.sub;
    const colegioId = user.colegioId ?? null;

    const personaRows: Array<any> = personaId
      ? await this.vinculoRepo.manager.query(
          `SELECT p.id, p.nombre, p.apellido_paterno, p.apellido_materno, c.email AS contacto_email
           FROM personas p
           LEFT JOIN contactos c ON c.id = p.contacto_id
           WHERE p.id = $1 LIMIT 1`,
          [personaId],
        )
      : [];
    const persona = personaRows[0];

    let colegio: any = null;
    if (colegioId) {
      const colegioRows = await this.vinculoRepo.manager.query(
        `SELECT id, nombre_institucion FROM colegios WHERE id = $1 LIMIT 1`,
        [colegioId],
      );
      colegio = colegioRows[0];
    }

    const vinculo =
      personaId && colegioId
        ? await this.vinculoRepo.findOne({ where: { personaId, colegioId } })
        : null;

    const nameParts = [
      persona?.nombre,
      persona?.apellido_paterno,
      persona?.apellido_materno,
    ].filter((value) => value && String(value).trim() !== '');
    const fullName = nameParts.join(' ').trim() || null;

    const email =
      vinculo?.emailInstitucional ?? persona?.contacto_email ?? null;

    return {
      personaId,
      userId: user.sub,
      rol: user.rol ?? null,
      colegioId,
      nombre: fullName,
      email,
      colegio: colegio
        ? { id: colegio.id, nombre: colegio.nombre_institucion }
        : null,
    };
  }

  /**
   * Resolve a vinculo id using personaId + colegioId. Returns undefined if not found.
   */
  async resolveVinculoIdByPersonaAndColegio(
    personaId: string,
    colegioId: string,
  ): Promise<string | undefined> {
    const v = await this.vinculoRepo.findOne({
      where: { personaId, colegioId },
    });
    return v?.id;
  }

  /**
   * Return all subjects (with course) that this professor teaches. Useful to populate a filter.
   */
  async getSubjectsForFilter(vinculoId: string) {
    const cms = await this.cursosMateriasRepo.find({
      where: { profesorVinculoId: vinculoId },
      relations: ['materia', 'curso'],
    });

    // Deduplicate by courseId + materiaId
    const map = new Map<string, SubjectDto>();
    for (const cm of cms) {
      const key = `${cm.cursoId}::${cm.materiaId}`;
      if (!map.has(key)) {
        map.set(key, {
          courseId: cm.cursoId,
          courseName: cm.curso?.nombre ?? '',
          subjectId: cm.materiaId,
          subjectName: cm.materia?.nombre ?? '',
        });
      }
    }

    let results = Array.from(map.values());

    // fallback: if no cursos_materias found, check profesores_materias
    if (results.length === 0) {
      const pm = await this.profesorMateriaRepo.find({
        where: { profesorVinculoId: vinculoId },
        relations: ['materia'],
      });
      if (pm.length > 0) {
        results = pm.map((p) => ({
          courseId: null,
          courseName: '',
          subjectId: p.materiaId,
          subjectName: p.materia?.nombre ?? '',
        }));
      }
    }

    return results;
  }

  /**
   * Return the list of subjects (materias) that this professor teaches in a specific course.
   * Only returns subjects assigned to that course for which the professor is the assigned profesor.
   */
  async getSubjectsForTeacherInCourse(vinculoId: string, courseId: string) {
    const cms = await this.cursosMateriasRepo.find({
      where: { profesorVinculoId: vinculoId, cursoId: courseId },
      relations: ['materia', 'curso'],
    });

    const map = new Map<string, SubjectFilterItem>();
    for (const cm of cms) {
      const mid = cm.materiaId;
      if (!map.has(mid)) {
        map.set(mid, {
          courseId: cm.cursoId ?? courseId,
          courseName: cm.curso?.nombre ?? '',
          subjectId: mid,
          subjectName: cm.materia?.nombre ?? '',
        });
      }
    }

    // fallback: if there are no cursos_materias for this course, maybe the professor has materias at profesor_materia scope
    if (map.size === 0) {
      const pm = await this.profesorMateriaRepo.find({
        where: { profesorVinculoId: vinculoId },
        relations: ['materia'],
      });
      if (pm.length > 0) {
        const cmsForCourse = await this.cursosMateriasRepo.find({
          where: { cursoId: courseId },
          relations: ['curso'],
        });
        const materiaIdsInCourse = new Set(
          cmsForCourse.map((c) => c.materiaId),
        );
        const fallbackCourseName = cmsForCourse[0]?.curso?.nombre ?? '';
        for (const p of pm) {
          if (materiaIdsInCourse.has(p.materiaId)) {
            if (!map.has(p.materiaId)) {
              map.set(p.materiaId, {
                courseId: courseId,
                courseName: fallbackCourseName,
                subjectId: p.materiaId,
                subjectName: p.materia?.nombre ?? '',
              });
            }
          }
        }
      }
    }

    return Array.from(map.values());
  }

  /**
   * Return subject-related info and today's classes for a given subjectId.
   * Includes courses where the subject is assigned and classes that have fecha = today.
   */
  async getSubjectToday(subjectId: string) {
    // find course assignments for this subject
    const cms = await this.cursosMateriasRepo.find({
      where: { materiaId: subjectId },
      relations: ['materia', 'curso'],
    });

    const subjects: SubjectDto[] = cms.map((cm) => ({
      courseId: cm.cursoId,
      courseName: cm.curso?.nombre ?? '',
      subjectId: cm.materiaId,
      subjectName: cm.materia?.nombre ?? '',
    }));

    const courseMap = new Map<
      string,
      { courseId: string; courseName: string }
    >();
    for (const cm of cms) {
      if (cm.cursoId && !courseMap.has(cm.cursoId)) {
        courseMap.set(cm.cursoId, {
          courseId: cm.cursoId,
          courseName: cm.curso?.nombre ?? '',
        });
      }
    }
    const courses = Array.from(courseMap.values());

    // get today's weekday (0=Sunday..6=Saturday)
    const today = new Date();
    const dow = today.getDay();

    // query recurring horarios for this subject on today's weekday
    const horarios = await this.horarioRepo
      .createQueryBuilder('h')
      .innerJoinAndSelect('h.cursoMateria', 'cm')
      .innerJoinAndSelect('cm.materia', 'm')
      .innerJoinAndSelect('cm.curso', 'c')
      .where('cm.materia_id = :subjectId', { subjectId })
      .leftJoinAndSelect('h.sala', 'sala')
      .andWhere('h.dia_semana = :dow', { dow })
      .andWhere('h.activo = true')
      .andWhere('(h.fecha_inicio IS NULL OR h.fecha_inicio <= :today)', {
        today: today.toISOString().slice(0, 10),
      })
      .andWhere('(h.fecha_fin IS NULL OR h.fecha_fin >= :today)', {
        today: today.toISOString().slice(0, 10),
      })
      .orderBy('h.hora_inicio', 'ASC')
      .getMany();

    const schedules = horarios.map((h) => ({
      scheduleId: h.id,
      day: h.diaSemana,
      startTime: h.horaInicio,
      endTime: h.horaFin,
      courseId: h.cursoMateria?.cursoId ?? h.cursoMateriaId,
      courseName: h.cursoMateria?.curso?.nombre ?? '',
      subjectId: h.cursoMateria?.materiaId ?? '',
      subjectName: h.cursoMateria?.materia?.nombre ?? '',
      salaId: h.salaId ?? null,
      salaName: h.sala?.nombre ?? null,
    }));

    return {
      subjectId,
      subjects,
      courses,
      schedules,
    };
  }

  /**
   * Get teacher schedule (recurring) for a given date. Returns horarios (recurring entries)
   * joined with cursos_materias info for the teacher vinculo.
   */
  async getTeacherScheduleForDate(vinculoId: string, date: Date) {
    const dow = date.getDay(); // 0-6

    const qb = this.horarioRepo
      .createQueryBuilder('h')
      .innerJoinAndSelect('h.cursoMateria', 'cm')
      .innerJoinAndSelect('cm.curso', 'c')
      .innerJoinAndSelect('cm.materia', 'm')
      .leftJoinAndSelect('h.sala', 'sala')
      .where('cm.profesor_vinculo_id = :vinculoId', { vinculoId })
      .andWhere('h.dia_semana = :dow', { dow })
      .andWhere('h.activo = true')
      .orderBy('h.hora_inicio', 'ASC');

    // respect optional date ranges
    qb.andWhere('(h.fecha_inicio IS NULL OR h.fecha_inicio <= :date)', {
      date: date.toISOString().slice(0, 10),
    });
    qb.andWhere('(h.fecha_fin IS NULL OR h.fecha_fin >= :date)', {
      date: date.toISOString().slice(0, 10),
    });

    const horarios = await qb.getMany();

    return horarios.map((h) => ({
      horarioId: h.id,
      day: h.diaSemana,
      startTime: h.horaInicio,
      endTime: h.horaFin,
      courseId: h.cursoMateria?.cursoId ?? h.cursoMateriaId,
      courseName: h.cursoMateria?.curso?.nombre ?? '',
      subjectId: h.cursoMateria?.materiaId ?? '',
      subjectName: h.cursoMateria?.materia?.nombre ?? '',
      salaId: h.salaId ?? null,
      salaName: h.sala?.nombre ?? null,
    }));
  }

  /**
   * Return the weekly recurring schedule (Mon-Fri) for a teacher grouped by weekday.
   */
  async getTeacherWeeklySchedule(vinculoId: string) {
    // Use raw SQL to also fetch the sala name (if set) and avoid needing a Sala entity.
    const rows: any[] = await this.horarioRepo.manager.query(
      `SELECT h.id as horario_id, h.dia_semana, h.hora_inicio, h.hora_fin,
              m.nombre as subject_name,
              c.id as course_id, c.nombre as course_name,
              s.nombre as sala_nombre
       FROM horarios h
       JOIN cursos_materias cm ON cm.id = h.curso_materia_id
       JOIN materias m ON m.id = cm.materia_id
       JOIN cursos c ON c.id = cm.curso_id
       LEFT JOIN salas s ON s.id = h.sala_id
       WHERE cm.profesor_vinculo_id = $1 AND h.activo = true
       ORDER BY h.dia_semana ASC, h.hora_inicio ASC
      `,
      [vinculoId],
    );

    // group by dia_semana (DB uses 0=Sunday .. 6=Saturday). We will expose monday..friday
    const map = new Map<number, Array<any>>();
    for (const r of rows) {
      const day: number = Number(r.dia_semana);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push({
        horarioId: r.horario_id,
        startTime: r.hora_inicio,
        endTime: r.hora_fin,
        subjectName: r.subject_name,
        courseId: r.course_id,
        courseName: r.course_name,
        salaName: r.sala_nombre ?? null,
      });
    }

    // map DB days to weekday keys (monday..friday). DB: 1=Monday
    const result: Record<string, Array<any>> = {
      monday: map.get(1) ?? [],
      tuesday: map.get(2) ?? [],
      wednesday: map.get(3) ?? [],
      thursday: map.get(4) ?? [],
      friday: map.get(5) ?? [],
    };

    return result;
  }

  /**
   * Return schedule-related statistics for a teacher.
   */
  async getTeacherScheduleStatistics(vinculoId: string) {
    // total recurring horarios
    const totalRes: any[] = await this.horarioRepo.manager.query(
      `SELECT COUNT(*)::int as total
       FROM horarios h
       JOIN cursos_materias cm ON cm.id = h.curso_materia_id
       WHERE cm.profesor_vinculo_id = $1 AND h.activo = true`,
      [vinculoId],
    );
    const totalHorarios = Number(totalRes[0]?.total ?? 0);

    // weekly hours: sum of duration (hora_fin - hora_inicio) in hours
    const hoursRes: any[] = await this.horarioRepo.manager.query(
      `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (h.hora_fin - h.hora_inicio))/3600),0) as hours
       FROM horarios h
       JOIN cursos_materias cm ON cm.id = h.curso_materia_id
       WHERE cm.profesor_vinculo_id = $1 AND h.activo = true`,
      [vinculoId],
    );
    const weeklyHours = parseFloat(String(hoursRes[0]?.hours ?? 0));

    // distinct courses count
    const coursesRes: any[] = await this.horarioRepo.manager.query(
      `SELECT COUNT(DISTINCT cm.curso_id)::int as count
       FROM horarios h
       JOIN cursos_materias cm ON cm.id = h.curso_materia_id
       WHERE cm.profesor_vinculo_id = $1 AND h.activo = true`,
      [vinculoId],
    );
    const distinctCourses = Number(coursesRes[0]?.count ?? 0);

    // count of distinct salas used (ignore usage frequency) — returns how many different rooms the teacher uses
    const salasRes: any[] = await this.horarioRepo.manager.query(
      `SELECT COUNT(DISTINCT s.id)::int as sala_count
       FROM horarios h
       JOIN cursos_materias cm ON cm.id = h.curso_materia_id
       LEFT JOIN salas s ON s.id = h.sala_id
       WHERE cm.profesor_vinculo_id = $1 AND h.activo = true`,
      [vinculoId],
    );
    const salaCount = Number(salasRes[0]?.sala_count ?? 0);

    return { totalHorarios, weeklyHours, distinctCourses, salaCount };
  }

  /**
   * Get student schedule for a given date by alumno vinculo id.
   * Finds student's cursos (alumnos_cursos) for the year and returns horarios matching those cursos.
   */
  async getStudentScheduleForDate(alumnoVinculoId: string, date: Date) {
    const year = date.getFullYear();
    // find enrolled cursos for this alumno
    const alumnosCursos = await this.vinculoRepo.manager.query(
      'SELECT curso_id FROM alumnos_cursos WHERE alumno_vinculo_id = $1 AND annio = $2',
      [alumnoVinculoId, year],
    );
    const cursoIds = alumnosCursos.map((r: any) => r.curso_id);
    if (cursoIds.length === 0) return [];

    const dow = date.getDay();
    const qb = this.horarioRepo
      .createQueryBuilder('h')
      .innerJoinAndSelect('h.cursoMateria', 'cm')
      .innerJoinAndSelect('cm.curso', 'c')
      .innerJoinAndSelect('cm.materia', 'm')
      .where('cm.curso_id IN (:...cursoIds)', { cursoIds })
      .andWhere('h.dia_semana = :dow', { dow })
      .andWhere('h.activo = true')
      .orderBy('h.hora_inicio', 'ASC');

    qb.andWhere('(h.fecha_inicio IS NULL OR h.fecha_inicio <= :date)', {
      date: date.toISOString().slice(0, 10),
    });
    qb.andWhere('(h.fecha_fin IS NULL OR h.fecha_fin >= :date)', {
      date: date.toISOString().slice(0, 10),
    });

    const horarios = await qb.getMany();

    return horarios.map((h) => ({
      horarioId: h.id,
      day: h.diaSemana,
      startTime: h.horaInicio,
      endTime: h.horaFin,
      courseId: h.cursoMateria?.cursoId ?? h.cursoMateriaId,
      courseName: h.cursoMateria?.curso?.nombre ?? '',
      subjectId: h.cursoMateria?.materiaId ?? '',
      subjectName: h.cursoMateria?.materia?.nombre ?? '',
      salaId: h.salaId ?? null,
    }));
  }

  /**
   * Compute statistics for a subject in a course.
   * Returns: studentsCount, attendanceAverage (percent), subjectAverage, distribution, approvedCount
   */
  async getSubjectCourseStatistics(subjectId: string, courseId: string) {
    // find the curso_materia entry
    const cm = await this.cursosMateriasRepo.findOne({
      where: { cursoId: courseId, materiaId: subjectId },
      relations: ['curso'],
    });
    if (!cm) {
      throw new NotFoundException('Course/subject assignment not found');
    }

    const cursoAnio = cm.curso?.anio ?? new Date().getFullYear();

    // 1) students count for the curso in the year
    const studentsRes: any[] = await this.cursosMateriasRepo.manager.query(
      'SELECT COUNT(*)::int as count FROM alumnos_cursos WHERE curso_id = $1 AND annio = $2',
      [courseId, cursoAnio],
    );
    const studentsCount = Number(studentsRes[0]?.count ?? 0);

    // 2) attendance: total records and present count using daily attendance model (asistencias_diarias)
    // We aggregate by curso_id because asistencias_diarias stores curso_id (not curso_materia_id).
    const attendanceRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT COUNT(*)::int as total,
              SUM(CASE WHEN ad.estado = 'presente' THEN 1 ELSE 0 END)::int as present
       FROM asistencias_diarias ad
       WHERE ad.curso_id = $1`,
      [cm.cursoId],
    );
    const totalAttendance = Number(attendanceRes[0]?.total ?? 0);
    const present = Number(attendanceRes[0]?.present ?? 0);
    const attendanceAverage =
      totalAttendance > 0 ? (present / totalAttendance) * 100 : null;

    // 3) subject average across all notas for evaluaciones in this curso_materia
    const avgRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT AVG(n.valor)::numeric(5,2) as avg
       FROM notas n
       JOIN evaluaciones e ON n.evaluacion_id = e.id
       WHERE e.curso_materia_id = $1`,
      [cm.id],
    );
    const subjectAverage =
      avgRes[0]?.avg !== null ? parseFloat(String(avgRes[0].avg)) : null;

    // 4) per-student averages to compute distribution and approved count
    const perStudent: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT n.alumno_vinculo_id, AVG(n.valor)::numeric(5,2) as avg
       FROM notas n
       JOIN evaluaciones e ON n.evaluacion_id = e.id
       WHERE e.curso_materia_id = $1
       GROUP BY n.alumno_vinculo_id`,
      [cm.id],
    );

    const distribution = {
      excellent: 0, // 6-7
      good: 0, // 5-5.9
      regular: 0, // 4-4.9
      insufficient: 0, // 1-3.9
    };
    let approvedCount = 0;

    for (const row of perStudent) {
      const avg = row?.avg !== null ? parseFloat(String(row.avg)) : null;
      if (avg === null || isNaN(avg)) continue;
      if (avg >= 6.0) distribution.excellent += 1;
      else if (avg >= 5.0) distribution.good += 1;
      else if (avg >= 4.0) distribution.regular += 1;
      else distribution.insufficient += 1;

      if (avg > 4.0) approvedCount += 1; // "arriba de 4"
    }

    return {
      subjectId,
      courseId,
      studentsCount,
      attendanceAverage,
      subjectAverage,
      distribution,
      approvedCount,
    };
  }

  /**
   * Return the requested exam statistics for a subject in a course.
   * Fields returned: courseAverage, highestStudentAverage, lowestStudentAverage, approvedCount, totalEvaluations
   */
  async getCourseSubjectExamStats(subjectId: string, courseId: string) {
    // find the curso_materia entry
    const cm = await this.cursosMateriasRepo.findOne({
      where: { cursoId: courseId, materiaId: subjectId },
      relations: ['curso'],
    });
    if (!cm) {
      throw new NotFoundException('Course/subject assignment not found');
    }
    // We compute per-student weighted averages taking into account a coefficient
    // derived from evaluacion.tipo: if tipo IN ('solemne','coef2') then coef=2 else coef=1.
    // Each evaluation contributes with weight = porcentaje * coef. The per-student
    // average is SUM(n.valor * weight) / SUM(weight). Then we compute course average
    // as the AVG of per-student averages, and highest/lowest/approved accordingly.

    // Since the DB schema no longer has a 'porcentaje' column, we treat each
    // evaluation as equal weight, but still apply a coefficient (2) for
    // tipo IN ('solemne','coef2'). The weight used per evaluation is therefore
    // (CASE WHEN tipo IN (...) THEN 2 ELSE 1 END).
    const perStudentQuery = `
      WITH per_student AS (
        SELECT n.alumno_vinculo_id,
               (SUM((n.valor::numeric) * (CASE WHEN e.tipo IN ('solemne','coef2') THEN 2 ELSE 1 END)) /
                NULLIF(SUM(CASE WHEN e.tipo IN ('solemne','coef2') THEN 2 ELSE 1 END),0)
               )::numeric(5,2) AS student_avg
        FROM notas n
        JOIN evaluaciones e ON n.evaluacion_id = e.id
        WHERE e.curso_materia_id = $1
        GROUP BY n.alumno_vinculo_id
      )
      SELECT
        (SELECT AVG(student_avg)::numeric(5,2) FROM per_student) as course_average,
        (SELECT MAX(student_avg)::numeric(5,2) FROM per_student) as highest_student_average,
        (SELECT MIN(student_avg)::numeric(5,2) FROM per_student) as lowest_student_average,
        (SELECT COUNT(*) FROM per_student WHERE student_avg > 4.0) as approved_count
    `;

    const statsRes: any[] = await this.cursosMateriasRepo.manager.query(
      perStudentQuery,
      [cm.id],
    );
    const courseAverage =
      statsRes[0]?.course_average !== null
        ? parseFloat(String(statsRes[0].course_average))
        : null;
    const highestStudentAverage =
      statsRes[0]?.highest_student_average !== null
        ? parseFloat(String(statsRes[0].highest_student_average))
        : null;
    const lowestStudentAverage =
      statsRes[0]?.lowest_student_average !== null
        ? parseFloat(String(statsRes[0].lowest_student_average))
        : null;
    const approvedCount = Number(statsRes[0]?.approved_count ?? 0);

    // total number of evaluations for this curso_materia
    const evalsRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT COUNT(*)::int as count FROM evaluaciones WHERE curso_materia_id = $1`,
      [cm.id],
    );
    const totalEvaluations = Number(evalsRes[0]?.count ?? 0);

    return {
      courseId,
      subjectId,
      courseAverage,
      highestStudentAverage,
      lowestStudentAverage,
      approvedCount,
      totalEvaluations,
    };
  }

  /**
   * For a given teacher (vinculoId) and subjectId, return statistics per course
   * where the teacher teaches that subject. This returns an array of the same
   * shape as getSubjectCourseStatistics but scoped to each course the teacher
   * actually teaches for that materia.
   */
  async getSubjectStatisticsForTeacher(vinculoId: string, subjectId: string) {
    // find cursos_materias where this teacher is assigned for the subject
    const cms = await this.cursosMateriasRepo.find({
      where: { profesorVinculoId: vinculoId, materiaId: subjectId },
      relations: ['curso'],
    });

    // if none found, return empty
    if (!cms || cms.length === 0) return [];

    const results = [] as any[];
    for (const cm of cms) {
      const courseId = cm.cursoId ?? (cm.curso ? cm.curso.id : undefined);
      if (!courseId) continue;
      try {
        const stats = await this.getSubjectCourseStatistics(
          subjectId,
          courseId,
        );
        // stats already contains courseId, include human-friendly courseName
        results.push({ courseName: cm.curso?.nombre ?? '', ...stats });
      } catch (_err) {
        // skip courses where stats calculation failed, but continue
        continue;
      }
    }

    return results;
  }

  /**
   * Debug helper: return cursos_materias rows for a given teacher and subject,
   * optionally filtered by courseId. Returns raw rows with course name.
   */
  async getCursosMateriasForTeacherAndSubject(
    vinculoId: string,
    subjectId: string,
    courseId?: string,
  ) {
    const params: any[] = [vinculoId, subjectId];
    let sql = `SELECT cm.id, cm.curso_id, cm.materia_id, cm.profesor_vinculo_id, c.nombre as course_name
                 FROM cursos_materias cm JOIN cursos c ON c.id = cm.curso_id
                 WHERE cm.profesor_vinculo_id = $1 AND cm.materia_id = $2`;
    if (courseId) {
      sql += ` AND cm.curso_id = $3`;
      params.push(courseId);
    }

    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      sql,
      params,
    );
    return rows;
  }

  /**
   * Return cursos_materias rows (id + materia info) for a given teacher and course.
   * Response items: { cursoMateriaId, subjectId, subjectName }
   */
  async getCursoMateriasForTeacher(vinculoId: string, courseId: string) {
    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT cm.id, cm.materia_id, m.nombre as materia_nombre
       FROM cursos_materias cm
       JOIN materias m ON m.id = cm.materia_id
       WHERE cm.profesor_vinculo_id = $1 AND cm.curso_id = $2
       ORDER BY m.nombre`,
      [vinculoId, courseId],
    );

    return rows.map((r: any) => ({
      cursoMateriaId: r.id,
      subjectId: r.materia_id,
      subjectName: r.materia_nombre,
    }));
  }

  /**
   * Given a curso_materia id, return its curso_id or null if not found.
   */
  async getCursoMateriaCourseId(cursoMateriaId: string) {
    if (!cursoMateriaId) return null;
    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT curso_id FROM cursos_materias WHERE id = $1 LIMIT 1`,
      [cursoMateriaId],
    );
    if (!rows || rows.length === 0) return null;
    return rows[0].curso_id ?? null;
  }

  /**
   * Return a summary for a course: total students and course average.
   * Only accessible by teachers who teach in the course or are jefe of the course.
   */
  async getCourseSummary(vinculoId: string, courseId: string) {
    // verify access: teacher must teach any materia in the course or be jefe
    const accessRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos_materias WHERE curso_id = $1 AND profesor_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    const jefeRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    if (accessRes.length === 0 && jefeRes.length === 0) {
      throw new NotFoundException(
        'You are not authorized to access this course',
      );
    }

    // determine course year
    const yearRes: any[] = await this.cursosMateriasRepo.manager.query(
      'SELECT annio FROM cursos WHERE id = $1',
      [courseId],
    );
    const cursoAnio =
      yearRes && yearRes[0] && yearRes[0].annio
        ? yearRes[0].annio
        : new Date().getFullYear();

    // total students enrolled for the course/year
    const studentsRes: any[] = await this.cursosMateriasRepo.manager.query(
      'SELECT COUNT(*)::int as count FROM alumnos_cursos WHERE curso_id = $1 AND annio = $2',
      [courseId, cursoAnio],
    );
    const studentsCount = Number(studentsRes[0]?.count ?? 0);

    // compute per-student weighted average across all evaluaciones in this course
    // We consider evaluations belonging to cursos_materias in this course. Coefficient logic: tipo IN ('solemne','coef2') => 2
    const perStudentQuery = `
      WITH per_student AS (
        SELECT n.alumno_vinculo_id,
               (SUM((n.valor::numeric) * (CASE WHEN e.tipo IN ('solemne','coef2') THEN 2 ELSE 1 END)) /
                NULLIF(SUM(CASE WHEN e.tipo IN ('solemne','coef2') THEN 2 ELSE 1 END),0)
               )::numeric(5,2) AS student_avg
        FROM notas n
        JOIN evaluaciones e ON n.evaluacion_id = e.id
        JOIN cursos_materias cm ON e.curso_materia_id = cm.id
        WHERE cm.curso_id = $1
        GROUP BY n.alumno_vinculo_id
      )
      SELECT AVG(student_avg)::numeric(5,2) as course_average FROM per_student
    `;

    const avgRes: any[] = await this.cursosMateriasRepo.manager.query(
      perStudentQuery,
      [courseId],
    );
    const courseAverage =
      avgRes[0]?.course_average !== null
        ? parseFloat(String(avgRes[0].course_average))
        : null;

    return { courseId, studentsCount, courseAverage };
  }

  /**
   * Find the course where the given vinculoId is jefe (profesor_jefe_vinculo_id).
   * If found, return the summary for that course using getCourseSummary.
   * If not found, return null.
   */
  async getCourseSummaryForHead(vinculoId: string) {
    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT id FROM cursos WHERE profesor_jefe_vinculo_id = $1 LIMIT 1`,
      [vinculoId],
    );
    if (!rows || rows.length === 0) return null;
    const courseId = rows[0].id as string;
    return this.getCourseSummary(vinculoId, courseId);
  }

  async isHeadOfCourse(vinculoId: string, courseId: string) {
    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    return rows.length > 0;
  }

  /**
   * Compute per-student analytics for the course where vinculoId is jefe.
   * Returns array of { alumnoVinculoId, rut, nombreCompleto, promedio, asistenciaPercent, riesgoPercent, riesgoCategoria, tendencia }
   */
  async getStudentsAnalyticsForHead(
    vinculoId: string,
  ): Promise<StudentsAnalyticsResponse> {
    // find curso where profesor_jefe_vinculo_id = vinculoId
    const crows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT id, annio FROM cursos WHERE profesor_jefe_vinculo_id = $1 LIMIT 1`,
      [vinculoId],
    );
    if (!crows || crows.length === 0) {
      return { students: [], mediumRiskCount: 0, criticalRiskCount: 0 };
    }
    const courseId = crows[0].id as string;
    const cursoAnio = crows[0].annio ?? new Date().getFullYear();

    const sql = `
      WITH students AS (
        SELECT ac.alumno_vinculo_id, v.id as vinculo_id, p.rut, p.nombre, p.apellido_paterno, p.apellido_materno
        FROM alumnos_cursos ac
        JOIN vinculos_institucionales v ON ac.alumno_vinculo_id = v.id
        LEFT JOIN personas p ON v.persona_id = p.id
        WHERE ac.curso_id = $1 AND ac.annio = $2
      ),
      averages AS (
        SELECT n.alumno_vinculo_id,
               (SUM((n.valor::numeric) * (CASE WHEN e.tipo IN ('solemne','coef2') THEN 2 ELSE 1 END)) /
                NULLIF(SUM(CASE WHEN e.tipo IN ('solemne','coef2') THEN 2 ELSE 1 END),0)
               )::numeric(5,2) AS promedio
        FROM notas n
        JOIN evaluaciones e ON n.evaluacion_id = e.id
        JOIN cursos_materias cm ON e.curso_materia_id = cm.id
        WHERE cm.curso_id = $1
        GROUP BY n.alumno_vinculo_id
      ),
      attendance AS (
        SELECT alumno_vinculo_id,
               COUNT(*)::int as total,
               SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END)::int as present
        FROM asistencias_diarias
        WHERE curso_id = $1
        GROUP BY alumno_vinculo_id
      )
      SELECT s.alumno_vinculo_id, s.rut, s.nombre, s.apellido_paterno, s.apellido_materno,
             a.promedio, at.total, at.present
      FROM students s
      LEFT JOIN averages a ON a.alumno_vinculo_id = s.alumno_vinculo_id
      LEFT JOIN attendance at ON at.alumno_vinculo_id = s.alumno_vinculo_id
      ORDER BY s.apellido_paterno, s.nombre
    `;

    const rows: any[] = await this.cursosMateriasRepo.manager.query(sql, [
      courseId,
      cursoAnio,
    ]);

    // get course average to use when a student has no grades
    const courseSummary: any = await this.getCourseSummary(
      vinculoId,
      courseId,
    ).catch(() => null);
    const courseAverageForFallback =
      courseSummary && courseSummary.courseAverage != null
        ? Number(courseSummary.courseAverage)
        : null;

    const result: StudentAnalyticsItem[] = rows.map((r: any) => {
      const nombreParts = [
        r.nombre,
        r.apellido_paterno,
        r.apellido_materno,
      ].filter((x: any) => x && String(x).trim() !== '');
      const nombreCompleto = nombreParts.join(' ').trim();

      const promedio =
        r.promedio !== null && r.promedio !== undefined
          ? Number(r.promedio)
          : null;

      const totalAttend = Number(r.total ?? 0);
      const present = Number(r.present ?? 0);
      const asistenciaPercent =
        totalAttend > 0 ? Math.round((present / totalAttend) * 100) : 0;

      // risk calculation:
      // - risk_from_avg: normalized so that avg 7 => 0 risk, avg 1 => 100 risk
      // - risk_from_att: 100 - asistenciaPercent
      // weights: avg 60%, attendance 40%
      const avgForCalc =
        promedio !== null
          ? promedio
          : courseAverageForFallback !== null
            ? courseAverageForFallback
            : 0;
      const riskFromAvg = ((7 - avgForCalc) / 6) * 100; // 0..100
      const riskFromAtt = 100 - asistenciaPercent; // 0..100
      const riesgoPercent = Math.round(0.6 * riskFromAvg + 0.4 * riskFromAtt);

      let riesgoCategoria: RiskCategory = 'bajo';
      if (riesgoPercent <= 25) riesgoCategoria = 'bajo';
      else if (riesgoPercent <= 60) riesgoCategoria = 'medio';
      else if (riesgoPercent <= 90) riesgoCategoria = 'alto';
      else riesgoCategoria = 'critico';

      // Business rule: if asistenciaPercent < 60%, elevate the riesgoCategoria by one level
      try {
        const categories: RiskCategory[] = ['bajo', 'medio', 'alto', 'critico'];
        if (asistenciaPercent < 60) {
          const idx = categories.indexOf(riesgoCategoria);
          const newIdx = Math.min(idx + 1, categories.length - 1);
          riesgoCategoria = categories[newIdx];
        }
      } catch (_e) {
        // ignore and keep original riesgoCategoria
      }
      return {
        alumnoVinculoId: r.alumno_vinculo_id,
        rut: r.rut ?? null,
        nombreCompleto,
        promedio: promedio !== null ? Number(promedio) : null,
        asistenciaPercent,
        riesgoPercent: riesgoPercent,
        riesgoCategoria,
      } as StudentAnalyticsItem;
    });

    const riskCounts = result.reduce(
      (acc, student) => {
        if (student.riesgoCategoria === 'medio') acc.medium += 1;
        if (student.riesgoCategoria === 'critico') acc.critical += 1;
        return acc;
      },
      { medium: 0, critical: 0 },
    );

    return {
      students: result,
      mediumRiskCount: riskCounts.medium,
      criticalRiskCount: riskCounts.critical,
    };
  }

  /**
   * Return evaluations for a given subject+course with grading info (how many notas recorded)
   * Ensures the requesting vinculoId is authorized (profesor on cursos_materias or jefe of course).
   */
  async getEvaluationsWithGradingInfo(
    vinculoId: string,
    subjectId: string,
    courseId: string,
  ) {
    // verify access via cursos_materias
    const cms = await this.getCursosMateriasForTeacherAndSubject(
      vinculoId,
      subjectId,
      courseId,
    );
    if (!cms || cms.length === 0) {
      const jefeCheck: any[] = await this.cursosMateriasRepo.manager.query(
        `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
        [courseId, vinculoId],
      );
      if (!jefeCheck || jefeCheck.length === 0) {
        throw new NotFoundException(
          'You are not assigned to this subject in the given course',
        );
      }
    }

    // find the curso_materia
    const cm = await this.cursosMateriasRepo.findOne({
      where: { cursoId: courseId, materiaId: subjectId },
      relations: ['curso', 'materia'],
    });
    if (!cm) throw new NotFoundException('Course/subject assignment not found');

    // total enrolled students for the course/year
    const year = cm.cursoId
      ? await this.cursosMateriasRepo.manager.query(
          'SELECT annio FROM cursos WHERE id = $1',
          [courseId],
        )
      : [];
    const cursoAnio =
      year && year[0] && year[0].annio
        ? year[0].annio
        : new Date().getFullYear();
    const studentsRes: any[] = await this.cursosMateriasRepo.manager.query(
      'SELECT COUNT(*)::int as count FROM alumnos_cursos WHERE curso_id = $1 AND annio = $2',
      [courseId, cursoAnio],
    );
    const totalStudents = Number(studentsRes[0]?.count ?? 0);

    // fetch evaluations with count of notas
    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT e.id, e.nombre, e.tipo, TO_CHAR(e.fecha,'YYYY-MM-DD') as fecha_iso, COUNT(n.id)::int as graded_count
       FROM evaluaciones e
       LEFT JOIN notas n ON n.evaluacion_id = e.id
       WHERE e.curso_materia_id = $1
       GROUP BY e.id, e.nombre, e.tipo, fecha_iso
       ORDER BY e.fecha DESC`,
      [cm.id],
    );

    return rows.map((r: any) => ({
      evaluationId: r.id,
      name: r.nombre,
      tipo: r.tipo ?? null,
      // porcentaje/percentage was removed from schema; keep date and counts
      date: r.fecha_iso ?? (r.fecha ? r.fecha.toString() : null),
      gradedCount: Number(r.graded_count ?? 0),
      totalStudents,
    }));
  }

  /**
   * Create a new evaluation for a given course + subject. The caller must be
   * authorized (profesor on cursos_materias or jefe on curso).
   * payload: { name, tipo, fecha }
   */
  async createEvaluation(
    vinculoId: string,
    courseId: string,
    subjectId: string,
    payload: { name: string; tipo?: string; fecha: string },
  ) {
    const { name, tipo, fecha } = payload as any;
    if (!name || !fecha)
      throw new NotFoundException('Missing required fields: name and fecha');

    // find curso_materia
    const cm = await this.cursosMateriasRepo.findOne({
      where: { cursoId: courseId, materiaId: subjectId },
      relations: ['curso', 'materia'],
    });
    if (!cm) throw new NotFoundException('Course/subject assignment not found');

    // verify access
    const accessRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos_materias WHERE curso_id = $1 AND profesor_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    const jefeRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    if (accessRes.length === 0 && jefeRes.length === 0) {
      throw new NotFoundException(
        'You are not authorized to create evaluations for this course',
      );
    }

    // Insert evaluation
    const insertRes: any[] = await this.cursosMateriasRepo.manager.query(
      `INSERT INTO evaluaciones (curso_materia_id, nombre, fecha, tipo) VALUES ($1, $2, $3, $4) RETURNING id, nombre, TO_CHAR(fecha,'YYYY-MM-DD') as fecha_iso, tipo`,
      [cm.id, name, fecha, tipo ?? 'prueba'],
    );
    const created = insertRes[0];

    // compute totalStudents for the course/year
    const yearRes: any[] = await this.cursosMateriasRepo.manager.query(
      'SELECT annio FROM cursos WHERE id = $1',
      [courseId],
    );
    const cursoAnio =
      yearRes && yearRes[0] && yearRes[0].annio
        ? yearRes[0].annio
        : new Date().getFullYear();
    const studentsRes: any[] = await this.cursosMateriasRepo.manager.query(
      'SELECT COUNT(*)::int as count FROM alumnos_cursos WHERE curso_id = $1 AND annio = $2',
      [courseId, cursoAnio],
    );
    const totalStudents = Number(studentsRes[0]?.count ?? 0);

    const colegioId = cm.curso?.colegioId;
    if (!colegioId) {
      throw new NotFoundException('El curso no tiene un colegio asociado');
    }

    const alumnoRows: any[] = await this.cursosMateriasRepo.manager.query(
      'SELECT alumno_vinculo_id FROM alumnos_cursos WHERE curso_id = $1 AND annio = $2',
      [courseId, cursoAnio],
    );
    const studentVinculoIds = Array.from(
      new Set(
        alumnoRows
          .map((r: any) => (typeof r === 'object' ? r.alumno_vinculo_id : r))
          .filter((id) => !!id),
      ),
    );

    const teacherName = await this.getTeacherFullName(vinculoId);
    await this.notifyStudentsAboutEvaluation({
      creatorVinculoId: vinculoId,
      courseId,
      courseName: cm.curso?.nombre ?? '',
      subjectName: cm.materia?.nombre ?? '',
      evaluationId: created.id,
      evaluationName: created.nombre,
      evaluationDate: created.fecha_iso ?? null,
      evaluationType: created.tipo ?? 'prueba',
      cursoMateriaId: cm.id,
      colegioId,
      teacherName,
      studentVinculoIds,
    });

    return {
      evaluationId: created.id,
      name: created.nombre,
      tipo: created.tipo ?? null,
      date: created.fecha_iso ?? null,
      gradedCount: 0,
      totalStudents,
    };
  }

  /**
   * Create or update a grade (nota) for a student in a given evaluation.
   * payload: { alumnoVinculoId, valor, retroalimentacion }
   */
  async upsertNote(
    vinculoId: string,
    evaluationId: string,
    payload: {
      alumnoVinculoId: string;
      nota: number;
      retroalimentacion?: string;
    },
  ) {
    // API accepts 'nota' (or 'calificacion' on the controller side). Internally the DB column remains 'valor'.
    const { alumnoVinculoId, nota, retroalimentacion } = payload as any;
    if (!alumnoVinculoId || nota == null)
      throw new NotFoundException('Missing alumnoVinculoId or nota');

    // find evaluation and its curso_materia -> curso
    const evalRows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT e.id, e.curso_materia_id, cm.curso_id
       FROM evaluaciones e JOIN cursos_materias cm ON cm.id = e.curso_materia_id
       WHERE e.id = $1 LIMIT 1`,
      [evaluationId],
    );
    if (!evalRows || evalRows.length === 0)
      throw new NotFoundException('Evaluation not found');
    const cursoMateriaId = evalRows[0].curso_materia_id;
    const cursoId = evalRows[0].curso_id;

    // verify access: professor assigned to curso_materia or jefe of curso
    const accessRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos_materias WHERE id = $1 AND profesor_vinculo_id = $2 LIMIT 1`,
      [cursoMateriaId, vinculoId],
    );
    const jefeRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [cursoId, vinculoId],
    );
    if (accessRes.length === 0 && jefeRes.length === 0) {
      throw new NotFoundException(
        'You are not authorized to grade this evaluation',
      );
    }

    // verify student enrolled in course for year
    const yearRes: any[] = await this.cursosMateriasRepo.manager.query(
      'SELECT annio FROM cursos WHERE id = $1',
      [cursoId],
    );
    const cursoAnio =
      yearRes && yearRes[0] && yearRes[0].annio
        ? yearRes[0].annio
        : new Date().getFullYear();
    const enrolled: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM alumnos_cursos WHERE curso_id = $1 AND annio = $2 AND alumno_vinculo_id = $3 LIMIT 1`,
      [cursoId, cursoAnio, alumnoVinculoId],
    );
    if (!enrolled || enrolled.length === 0) {
      throw new NotFoundException(
        'Student is not enrolled in this course for the year',
      );
    }

    // validate nota range (1.0 - 7.0)
    if (isNaN(Number(nota)) || Number(nota) < 1.0 || Number(nota) > 7.0) {
      throw new Error('nota must be a number between 1.0 and 7.0');
    }

    // upsert note
    const insertRes: any[] = await this.cursosMateriasRepo.manager.query(
      `INSERT INTO notas (evaluacion_id, alumno_vinculo_id, valor, retroalimentacion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (evaluacion_id, alumno_vinculo_id) DO UPDATE
         SET valor = EXCLUDED.valor, retroalimentacion = EXCLUDED.retroalimentacion
       RETURNING id, valor, retroalimentacion`,
      [evaluationId, alumnoVinculoId, nota, retroalimentacion ?? null],
    );

    const note = insertRes[0];

    return {
      noteId: note.id,
      evaluationId,
      alumnoVinculoId,
      nota: Number(note.valor),
      retroalimentacion: note.retroalimentacion ?? null,
    };
  }

  /**
   * Return the list of courses where the teacher has classes or is the head teacher.
   */
  async getCoursesForTeacher(vinculoId: string) {
    // Use UNION to include cursos where the teacher is jefe and cursos where they teach via cursos_materias
    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `
      SELECT DISTINCT c.id, c.nombre, c.annio as anio
      FROM cursos c
      JOIN cursos_materias cm ON cm.curso_id = c.id
      WHERE cm.profesor_vinculo_id = $1
      UNION
      SELECT c2.id, c2.nombre, c2.annio as anio
      FROM cursos c2
      WHERE c2.profesor_jefe_vinculo_id = $1
      ORDER BY nombre
      `,
      [vinculoId],
    );

    return rows.map((r) => ({ courseId: r.id, courseName: r.nombre }));
  }

  /**
   * Return students for a given course if the requesting teacher (vinculoId) has access.
   * Access: teacher is either profesor_jefe_vinculo_id on cursos or profesor_vinculo_id on cursos_materias.
   */
  async getStudentsForCourse(vinculoId: string, courseId: string) {
    // verify access
    const accessRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos_materias WHERE curso_id = $1 AND profesor_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );

    const jefeRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );

    if (accessRes.length === 0 && jefeRes.length === 0) {
      // not authorized to view this course's students
      return { count: 0, students: [] };
    }

    const year = new Date().getFullYear();
    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `
      SELECT v.id as vinculo_id, p.rut, p.nombre, p.apellido_paterno, p.apellido_materno
      FROM alumnos_cursos ac
      JOIN vinculos_institucionales v ON ac.alumno_vinculo_id = v.id
      LEFT JOIN personas p ON v.persona_id = p.id
      WHERE ac.curso_id = $1 AND ac.annio = $2
      ORDER BY p.apellido_paterno, p.nombre
      `,
      [courseId, year],
    );

    const students = rows.map(
      (r: {
        vinculo_id: string;
        rut: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string;
      }) => {
        const parts = [r.nombre, r.apellido_paterno, r.apellido_materno].filter(
          (x) => x && String(x).trim() !== '',
        );
        const nombreCompleto = parts.join(' ').trim();
        return {
          alumnoVinculoId: r.vinculo_id,
          rut: r.rut,
          nombre_completo: nombreCompleto,
        };
      },
    );

    return { count: students.length, students };
  }

  /**
   * Return students for a given course + subject including their recent evaluations (last 3),
   * a "+N" indicator when there are more evaluations, the subject average for each student
   * (weighted by evaluacion.tipo coefficients), and an estado string.
   */
  async getStudentsWithGrades(
    vinculoId: string,
    courseId: string,
    subjectId: string,
  ) {
    // verify access: teacher assigned to the subject in the course or jefe
    const cms = await this.getCursosMateriasForTeacherAndSubject(
      vinculoId,
      subjectId,
      courseId,
    );
    if (!cms || cms.length === 0) {
      const jefeCheck: any[] = await this.cursosMateriasRepo.manager.query(
        `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
        [courseId, vinculoId],
      );
      if (!jefeCheck || jefeCheck.length === 0) {
        throw new NotFoundException(
          'You are not assigned to this subject in the given course',
        );
      }
    }

    // find curso_materia
    const cm = await this.cursosMateriasRepo.findOne({
      where: { cursoId: courseId, materiaId: subjectId },
    });
    if (!cm) throw new NotFoundException('Course/subject assignment not found');

    // determine academic year
    const yearRes: any[] = await this.cursosMateriasRepo.manager.query(
      'SELECT annio FROM cursos WHERE id = $1',
      [courseId],
    );
    const year =
      yearRes && yearRes[0] && yearRes[0].annio
        ? yearRes[0].annio
        : new Date().getFullYear();

    // total evaluations for this curso_materia
    const totalEvalsRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT COUNT(*)::int as count FROM evaluaciones WHERE curso_materia_id = $1`,
      [cm.id],
    );
    const totalEvaluations = Number(totalEvalsRes[0]?.count ?? 0);

    // main query: students enrolled in course/year, per-student weighted average, and recent 3 evaluations with notas
    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `
      SELECT ac.alumno_vinculo_id,
             v.id as vinculo_id,
             p.rut,
             p.nombre,
             p.apellido_paterno,
             p.apellido_materno,
             COALESCE(ps.student_avg::numeric(5,2), NULL) as promedio,
             (
               -- collect the last 3 evaluations for which THIS student has a recorded nota (nota IS NOT NULL)
               SELECT COALESCE(jsonb_agg(jsonb_build_object('evaluationId', ev.id, 'name', ev.nombre, 'date', TO_CHAR(ev.fecha,'YYYY-MM-DD'), 'nota', n.valor::numeric(5,2))) , '[]'::jsonb)
               FROM (
                 SELECT e.id, e.nombre, e.fecha
                 FROM evaluaciones e
                 JOIN notas n2 ON n2.evaluacion_id = e.id AND n2.alumno_vinculo_id = ac.alumno_vinculo_id AND n2.valor IS NOT NULL
                 WHERE e.curso_materia_id = $1
                 ORDER BY e.fecha DESC
                 LIMIT 3
               ) ev
               JOIN notas n ON n.evaluacion_id = ev.id AND n.alumno_vinculo_id = ac.alumno_vinculo_id
             ) as recent_evals
      FROM alumnos_cursos ac
      JOIN vinculos_institucionales v ON ac.alumno_vinculo_id = v.id
      LEFT JOIN personas p ON v.persona_id = p.id
      LEFT JOIN (
        SELECT n.alumno_vinculo_id,
               (SUM((n.valor::numeric) * (CASE WHEN e.tipo IN ('solemne','coef2') THEN 2 ELSE 1 END)) /
                NULLIF(SUM(CASE WHEN e.tipo IN ('solemne','coef2') THEN 2 ELSE 1 END),0)
               )::numeric(5,2) AS student_avg
        FROM notas n
        JOIN evaluaciones e ON n.evaluacion_id = e.id
        WHERE e.curso_materia_id = $1
        GROUP BY n.alumno_vinculo_id
      ) ps ON ps.alumno_vinculo_id = ac.alumno_vinculo_id
      WHERE ac.curso_id = $2 AND ac.annio = $3
      ORDER BY p.apellido_paterno, p.nombre
      `,
      [cm.id, courseId, year],
    );

    // map rows to desired output shape
    const students = rows.map((r: any) => {
      const parts = [r.nombre, r.apellido_paterno, r.apellido_materno].filter(
        (x: any) => x && String(x).trim() !== '',
      );
      const nombreCompleto = parts.join(' ').trim();

      let recent: any[] = [];
      try {
        recent =
          typeof r.recent_evals === 'string'
            ? JSON.parse(r.recent_evals)
            : (r.recent_evals ?? []);
      } catch (_e) {
        recent = r.recent_evals ?? [];
      }

      const displayed = Array.isArray(recent) ? recent : [];
      const displayedCount = displayed.length;
      const remaining = totalEvaluations - displayedCount;
      const more = remaining > 0 ? `${remaining}+` : null;

      const promedio =
        r.promedio !== null && r.promedio !== undefined
          ? Number(r.promedio)
          : null;
      let estado = 'insuficiente';
      if (promedio !== null) {
        if (promedio >= 6.0) estado = 'excelente';
        else if (promedio >= 5.0) estado = 'bueno';
        else if (promedio >= 4.0) estado = 'regular';
        else estado = 'insuficiente';
      } else {
        // if no grades yet, mark as insuficiente
        estado = 'insuficiente';
      }

      return {
        alumnoVinculoId: r.alumno_vinculo_id,
        nombreCompleto,
        rut: r.rut ?? null,
        recentEvaluations: displayed.map((d: any) => ({
          evaluationId: d.evaluationId,
          name: d.name,
          date: d.date,
          // present a human-friendly string when nota is null
          nota:
            d.nota == null
              ? 'Sin calificar'
              : typeof d.nota === 'string'
                ? Number(d.nota)
                : d.nota,
        })),
        more, // e.g. '2+' or null
        promedio,
        estado,
      };
    });

    return {
      courseId,
      subjectId,
      totalEvaluations,
      count: students.length,
      students,
    };
  }

  /**
   * Return all observations created by a given teacher (profesor vinculo).
   * Response includes counts by tipo and a list of observations with title, student name, course, description, tipo and date.
   */
  async getObservationsForTeacher(
    vinculoId: string,
    tipo?: string,
    courseId?: string,
  ) {
    const allowed = new Set(['positiva', 'negativa', 'informativa']);
    if (tipo && !allowed.has(tipo)) {
      throw new BadRequestException(`Invalid tipo filter: ${tipo}`);
    }
    // main list
    const params: any[] = [vinculoId];
    let whereClause = `o.profesor_vinculo_id = $1`;
    if (tipo) {
      params.push(tipo);
      whereClause += ` AND o.tipo = $${params.length}`;
    }
    if (courseId) {
      params.push(courseId);
      whereClause += ` AND o.curso_id = $${params.length}`;
    }

    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT o.titulo, o.descripcion, o.tipo, o.fecha,
              v.id as alumno_vinculo_id, p.nombre, p.apellido_paterno, p.apellido_materno,
              c.nombre as curso_nombre,
              m.nombre as materia_nombre
       FROM observaciones o
       JOIN vinculos_institucionales v ON o.alumno_vinculo_id = v.id
       LEFT JOIN personas p ON v.persona_id = p.id
       LEFT JOIN cursos c ON o.curso_id = c.id
       LEFT JOIN cursos_materias cm ON o.curso_materia_id = cm.id
       LEFT JOIN materias m ON cm.materia_id = m.id
       WHERE ${whereClause}
       ORDER BY o.fecha DESC`,
      params,
    );

    const observations = rows.map((r: any) => {
      const parts = [r.nombre, r.apellido_paterno, r.apellido_materno].filter(
        (x: any) => x && String(x).trim() !== '',
      );
      const studentName = parts.join(' ').trim();

      // format date as DD/MM/YYYY
      let dateStr: string | null = null;
      if (r.fecha) {
        try {
          const d = typeof r.fecha === 'string' ? new Date(r.fecha) : r.fecha;
          if (!isNaN(d.getTime && d.getTime())) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            dateStr = `${dd}/${mm}/${yyyy}`;
          }
        } catch (_e) {
          dateStr = null;
        }
      }

      return {
        title: r.titulo,
        studentName,
        course: r.curso_nombre ?? null,
        subject: r.materia_nombre ?? null,
        description: r.descripcion,
        tipo: r.tipo,
        date: dateStr,
      };
    });

    // counts: return totals across all tipos but scoped to the given course when provided
    let countsRes: any[] = [];
    if (courseId) {
      countsRes = await this.cursosMateriasRepo.manager.query(
        `SELECT COUNT(*)::int as total,
                SUM(CASE WHEN tipo = 'positiva' THEN 1 ELSE 0 END)::int as positivas,
                SUM(CASE WHEN tipo = 'negativa' THEN 1 ELSE 0 END)::int as negativas,
                SUM(CASE WHEN tipo = 'informativa' THEN 1 ELSE 0 END)::int as informativas
         FROM observaciones
         WHERE profesor_vinculo_id = $1 AND curso_id = $2`,
        [vinculoId, courseId],
      );
    } else {
      countsRes = await this.cursosMateriasRepo.manager.query(
        `SELECT COUNT(*)::int as total,
                SUM(CASE WHEN tipo = 'positiva' THEN 1 ELSE 0 END)::int as positivas,
                SUM(CASE WHEN tipo = 'negativa' THEN 1 ELSE 0 END)::int as negativas,
                SUM(CASE WHEN tipo = 'informativa' THEN 1 ELSE 0 END)::int as informativas
         FROM observaciones
         WHERE profesor_vinculo_id = $1`,
        [vinculoId],
      );
    }

    const counts = countsRes[0] ?? {
      total: 0,
      positivas: 0,
      negativas: 0,
      informativas: 0,
    };

    return {
      total: Number(counts.total ?? 0),
      positivas: Number(counts.positivas ?? 0),
      negativas: Number(counts.negativas ?? 0),
      informativas: Number(counts.informativas ?? 0),
      observations,
    };
  }

  /**
   * Create a new observation record.
   * Ensures the requesting teacher (vinculoId) is authorized to create observations
   * for the given course (either profesor on cursos_materias or profesor_jefe on curso).
   * payload: { alumnoVinculoId, tipo, cursoMateriaId|null, titulo|null, descripcion }
   */
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
    const { alumnoVinculoId, tipo, cursoMateriaId, titulo, descripcion } =
      payload as any;
    const allowed = new Set(['positiva', 'negativa', 'informativa']);
    if (!allowed.has(tipo))
      throw new BadRequestException('Invalid tipo for observation');

    // verify teacher access to the course
    const accessRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos_materias WHERE curso_id = $1 AND profesor_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    const jefeRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    if (accessRes.length === 0 && jefeRes.length === 0) {
      throw new NotFoundException(
        'You are not authorized to create observations for this course',
      );
    }

    // verify student enrollment in the course for the course year
    const yearRes: any[] = await this.cursosMateriasRepo.manager.query(
      'SELECT annio FROM cursos WHERE id = $1',
      [courseId],
    );
    const cursoAnio =
      yearRes && yearRes[0] && yearRes[0].annio
        ? yearRes[0].annio
        : new Date().getFullYear();
    const enrolled: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM alumnos_cursos WHERE curso_id = $1 AND annio = $2 AND alumno_vinculo_id = $3 LIMIT 1`,
      [courseId, cursoAnio, alumnoVinculoId],
    );
    if (!enrolled || enrolled.length === 0) {
      throw new NotFoundException(
        'Student is not enrolled in this course for the year',
      );
    }

    // if cursoMateriaId is provided, ensure it belongs to the course
    if (cursoMateriaId) {
      const cmCheck: any[] = await this.cursosMateriasRepo.manager.query(
        `SELECT 1 FROM cursos_materias WHERE id = $1 AND curso_id = $2 LIMIT 1`,
        [cursoMateriaId, courseId],
      );
      if (!cmCheck || cmCheck.length === 0) {
        throw new BadRequestException(
          'cursoMateriaId does not belong to the provided course',
        );
      }
    }

    // insert observation
    const insertRes: any[] = await this.cursosMateriasRepo.manager.query(
      `INSERT INTO observaciones (alumno_vinculo_id, profesor_vinculo_id, curso_id, titulo, curso_materia_id, tipo, descripcion, fecha)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, TO_CHAR(fecha,'YYYY-MM-DD') as fecha_iso, titulo, descripcion, tipo, alumno_vinculo_id, curso_materia_id, curso_id, profesor_vinculo_id`,
      [
        alumnoVinculoId,
        vinculoId,
        courseId,
        titulo ?? null,
        cursoMateriaId ?? null,
        tipo,
        descripcion,
      ],
    );

    const created = insertRes[0];

    // format date as DD/MM/YYYY for client
    let dateStr: string | null = null;
    if (created && created.fecha_iso) {
      try {
        const d = new Date(created.fecha_iso);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        dateStr = `${dd}/${mm}/${yyyy}`;
      } catch (_e) {
        dateStr = null;
      }
    }

    return {
      observationId: created.id,
      alumnoVinculoId: created.alumno_vinculo_id,
      profesorVinculoId: created.profesor_vinculo_id,
      courseId: created.curso_id,
      cursoMateriaId: created.curso_materia_id ?? null,
      title: created.titulo ?? null,
      description: created.descripcion,
      tipo: created.tipo,
      date: dateStr,
    };
  }

  /**
   * Update a single attendance entry for a course and date.
   * Performs an upsert: updates if exists, inserts otherwise.
   */
  async updateAttendanceEntry(
    vinculoId: string,
    courseId: string,
    fecha: string,
    alumnoVinculoId: string,
    estado: 'presente' | 'ausente' | 'tardanza',
  ) {
    // verify access: teacher teaches in the course or is jefe
    const accessRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos_materias WHERE curso_id = $1 AND profesor_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    const jefeRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    if (accessRes.length === 0 && jefeRes.length === 0) {
      throw new Error(
        'teacher not authorized to update attendance for this course (not authorized)',
      );
    }

    const year = new Date(fecha).getFullYear();

    // check student enrollment
    const enrolledRows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT alumno_vinculo_id FROM alumnos_cursos WHERE curso_id = $1 AND annio = $2 AND alumno_vinculo_id = $3 LIMIT 1`,
      [courseId, year, alumnoVinculoId],
    );
    if (enrolledRows.length === 0) {
      throw new Error(
        `alumno ${alumnoVinculoId} not enrolled in course ${courseId} for year ${year}`,
      );
    }

    await this.cursosMateriasRepo.manager.query(
      `INSERT INTO asistencias_diarias (curso_id, alumno_vinculo_id, fecha, estado, registrador_vinculo_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (alumno_vinculo_id, curso_id, fecha) DO UPDATE
         SET estado = EXCLUDED.estado,
             registrador_vinculo_id = EXCLUDED.registrador_vinculo_id,
             updated_at = NOW();`,
      [courseId, alumnoVinculoId, fecha, estado, vinculoId],
    );

    return { courseId, fecha, alumnoVinculoId, estado };
  }

  /**
   * Bulk update attendance entries in a single transaction.
   * updates: Array<{ alumnoVinculoId, estado }>
   */
  async updateAttendanceEntries(
    vinculoId: string,
    courseId: string,
    fecha: string,
    updates: Array<{
      alumnoVinculoId: string;
      estado: 'presente' | 'ausente' | 'tardanza';
    }>,
  ) {
    // verify access: teacher teaches in the course or is jefe
    const accessRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos_materias WHERE curso_id = $1 AND profesor_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    const jefeRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    if (accessRes.length === 0 && jefeRes.length === 0) {
      throw new Error(
        'teacher not authorized to update attendance for this course (not authorized)',
      );
    }

    const year = new Date(fecha).getFullYear();

    // fetch enrolled alumnos for the course and year
    const enrolledRows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT alumno_vinculo_id FROM alumnos_cursos WHERE curso_id = $1 AND annio = $2`,
      [courseId, year],
    );
    const enrolledSet = new Set(
      enrolledRows.map((r: any) => r.alumno_vinculo_id),
    );

    // run all upserts in a single transaction
    await this.cursosMateriasRepo.manager.transaction(async (manager) => {
      for (const u of updates) {
        const alumnoId = u.alumnoVinculoId;
        if (!enrolledSet.has(alumnoId)) {
          throw new Error(
            `alumno ${alumnoId} not enrolled in course ${courseId} for year ${year}`,
          );
        }

        await manager.query(
          `INSERT INTO asistencias_diarias (curso_id, alumno_vinculo_id, fecha, estado, registrador_vinculo_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (alumno_vinculo_id, curso_id, fecha) DO UPDATE
             SET estado = EXCLUDED.estado,
                 registrador_vinculo_id = EXCLUDED.registrador_vinculo_id,
                 updated_at = NOW();`,
          [courseId, alumnoId, fecha, u.estado, vinculoId],
        );
      }
    });

    return { courseId, fecha, processed: updates.length };
  }

  /**
   * Record daily attendance for a course (upsert per alumno/curso/fecha).
   */
  async recordAttendance(
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
    const { cursoMateriaId, fecha, attendances } = payload as any;

    if (!fecha || !Array.isArray(attendances)) {
      throw new NotFoundException('Missing required fields for attendance');
    }

    // If a cursoMateriaId was provided, derive the courseId from it
    let targetCourseId = courseId;
    if (cursoMateriaId) {
      const cmRows: any[] = await this.cursosMateriasRepo.manager.query(
        'SELECT id, curso_id, profesor_vinculo_id FROM cursos_materias WHERE id = $1',
        [cursoMateriaId],
      );
      if (cmRows.length === 0)
        throw new NotFoundException('curso_materia not found');
      const cm = cmRows[0];
      // if a courseId was provided too, ensure they match
      if (courseId && cm.curso_id !== courseId) {
        throw new Error('curso_materia does not belong to provided course');
      }
      targetCourseId = cm.curso_id;
    }

    // verify teacher has access to the target course (either profesor on cursos_materias for that course or jefe on cursos)
    const accessRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos_materias WHERE curso_id = $1 AND profesor_vinculo_id = $2 LIMIT 1`,
      [targetCourseId, vinculoId],
    );
    const jefeRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [targetCourseId, vinculoId],
    );
    if (accessRes.length === 0 && jefeRes.length === 0) {
      throw new Error(
        'teacher not authorized to record attendance for this course (not authorized)',
      );
    }

    // determine year from fecha for enrollment validation
    const year = new Date(fecha).getFullYear();

    // fetch enrolled alumnos for the course and year
    const enrolledRows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT alumno_vinculo_id FROM alumnos_cursos WHERE curso_id = $1 AND annio = $2`,
      [targetCourseId, year],
    );
    const enrolledSet = new Set(
      enrolledRows.map((r: any) => r.alumno_vinculo_id),
    );

    const courseInfoRows = await this.cursosMateriasRepo.manager.query(
      'SELECT nombre, colegio_id FROM cursos WHERE id = $1 LIMIT 1',
      [targetCourseId],
    );
    const courseName = courseInfoRows[0]?.nombre ?? '';
    const colegioId = courseInfoRows[0]?.colegio_id ?? null;

    const absentStudents: Array<{ alumnoVinculoId: string; estado: string }> =
      [];
    const absentSet = new Set<string>();
    let processed = 0;
    for (const a of attendances) {
      const alumnoId = a.alumnoVinculoId;
      if (!enrolledSet.has(alumnoId)) {
        throw new NotFoundException(
          `alumno ${alumnoId} not enrolled in course ${targetCourseId} for year ${year}`,
        );
      }

      await this.cursosMateriasRepo.manager.query(
        `INSERT INTO asistencias_diarias (curso_id, alumno_vinculo_id, fecha, estado, registrador_vinculo_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (alumno_vinculo_id, curso_id, fecha) DO UPDATE
           SET estado = EXCLUDED.estado,
               registrador_vinculo_id = EXCLUDED.registrador_vinculo_id,
               updated_at = NOW();`,
        [targetCourseId, alumnoId, fecha, a.estado, vinculoId],
      );

      if (a.estado === 'ausente' && !absentSet.has(alumnoId)) {
        absentSet.add(alumnoId);
        absentStudents.push({ alumnoVinculoId: alumnoId, estado: a.estado });
      }

      processed += 1;
    }

    const teacherName = await this.getTeacherFullName(vinculoId);
    await Promise.all(
      absentStudents.map((student) =>
        this.notifyStudentAbsence({
          alumnoVinculoId: student.alumnoVinculoId,
          fecha,
          courseId: targetCourseId,
          courseName,
          colegioId,
          teacherVinculoId: vinculoId,
          teacherName,
        }),
      ),
    );

    return { courseId, fecha, processed };
  }

  /**
   * Get attendance for a course on a specific date. Returns { count, students: [...] }
   */
  async getAttendanceForCourseByDate(
    vinculoId: string,
    courseId: string,
    fecha: string,
  ) {
    // verify access: teacher teaches in the course or is jefe
    const accessRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos_materias WHERE curso_id = $1 AND profesor_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    const jefeRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    if (accessRes.length === 0 && jefeRes.length === 0) {
      throw new Error(
        'teacher not authorized to view attendance for this course (not authorized)',
      );
    }

    const year = new Date(fecha).getFullYear();

    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT v.id as alumno_vinculo_id, p.rut, p.nombre, p.apellido_paterno, p.apellido_materno, ad.estado
       FROM alumnos_cursos ac
       JOIN vinculos_institucionales v ON ac.alumno_vinculo_id = v.id
       LEFT JOIN personas p ON v.persona_id = p.id
       LEFT JOIN asistencias_diarias ad ON ad.alumno_vinculo_id = v.id AND ad.curso_id = ac.curso_id AND ad.fecha = $2
      WHERE ac.curso_id = $1 AND ac.annio = $3
       ORDER BY p.apellido_paterno, p.nombre`,
      [courseId, fecha, year],
    );

    const students = rows.map((r: any) => {
      const parts = [r.nombre, r.apellido_paterno, r.apellido_materno].filter(
        (x: any) => x && String(x).trim() !== '',
      );
      return {
        alumnoVinculoId: r.alumno_vinculo_id,
        rut: r.rut,
        nombre_completo: parts.join(' ').trim(),
        estado: r.estado ?? 'no_registrado',
      };
    });

    return { count: students.length, students };
  }

  async getNotificationsForTeacher(
    vinculoId: string,
    options?: { unreadOnly?: boolean },
  ) {
    const unreadCount = await this.notificacionDestinatarioRepo.count({
      where: { receptorVinculoId: vinculoId, leido: false },
    });

    const rows = this.notificacionDestinatarioRepo
      .createQueryBuilder('recipient')
      .innerJoinAndSelect('recipient.notificacion', 'notificacion')
      .where('recipient.receptor_vinculo_id = :vinculoId', { vinculoId })
      .orderBy('notificacion.created_at', 'DESC')
      .limit(5);

    if (options?.unreadOnly) {
      rows.andWhere('recipient.leido = false');
    }

    const items = await rows.getMany();
    return {
      unreadCount,
      items: items.map((recipient) => ({
        id: recipient.notificacionId,
        title: recipient.notificacion.titulo,
        description: recipient.notificacion.descripcion ?? null,
        type: recipient.notificacion.tipo,
        metadata: recipient.notificacion.metadata ?? null,
        courseId: recipient.notificacion.cursoId ?? null,
        subjectId: recipient.notificacion.cursoMateriaId ?? null,
        evaluationId: recipient.notificacion.evaluacionId ?? null,
        senderId: recipient.notificacion.emisorVinculoId,
        read: recipient.leido,
        readAt: recipient.leidoEn ?? null,
        createdAt: recipient.notificacion.createdAt,
      })),
    };
  }

  async markNotificationReadForTeacher(
    vinculoId: string,
    notificationId: string,
    read = true,
  ) {
    const recipient = await this.notificacionDestinatarioRepo.findOne({
      where: { notificacionId: notificationId, receptorVinculoId: vinculoId },
    });

    if (!recipient) {
      throw new NotFoundException('Notificación no encontrada');
    }

    recipient.leido = read;
    recipient.leidoEn = read ? new Date() : null;

    await this.notificacionDestinatarioRepo.save(recipient);

    return {
      id: recipient.notificacionId,
      read: recipient.leido,
      readAt: recipient.leidoEn ?? null,
    };
  }

  private async notifyStudentsAboutEvaluation(payload: {
    creatorVinculoId: string;
    courseId: string;
    courseName: string;
    subjectName: string;
    evaluationId: string;
    evaluationName: string;
    evaluationDate: string | null;
    evaluationType: string;
    cursoMateriaId: string;
    colegioId: string;
    teacherName: string | null;
    studentVinculoIds: string[];
  }) {
    const descriptionDate = payload.evaluationDate ?? 'pendiente';
    const teacherLabel = payload.teacherName
      ? `Profesor: ${payload.teacherName}.`
      : '';
    const notification = this.notificacionRepo.create({
      colegioId: payload.colegioId,
      emisorVinculoId: payload.creatorVinculoId,
      cursoId: payload.courseId,
      cursoMateriaId: payload.cursoMateriaId,
      evaluacionId: payload.evaluationId,
      tipo: 'evaluacion',
      titulo: 'Nueva evaluación',
      descripcion:
        `Se ha asignado una nueva evaluación '${payload.evaluationName}' para ${payload.subjectName} (${payload.courseName}). Fecha de entrega: ${descriptionDate}. ${teacherLabel}`.trim(),
      metadata: {
        subjectName: payload.subjectName,
        teacherName: payload.teacherName,
        evaluationType: payload.evaluationType,
      },
    });

    const savedNotification = await this.notificacionRepo.save(notification);
    const recipients = Array.from(new Set(payload.studentVinculoIds));
    if (recipients.length === 0) return;

    const recipientEntities = recipients.map((vinculoId) =>
      this.notificacionDestinatarioRepo.create({
        notificacionId: savedNotification.id,
        receptorVinculoId: vinculoId,
      }),
    );
    await this.notificacionDestinatarioRepo.save(recipientEntities);
  }

  private async notifyStudentAbsence(payload: {
    alumnoVinculoId: string;
    fecha: string;
    courseId: string;
    courseName: string;
    colegioId: string | null;
    teacherVinculoId: string;
    teacherName: string | null;
  }) {
    if (!payload.colegioId) return;

    const notification = this.notificacionRepo.create({
      colegioId: payload.colegioId,
      emisorVinculoId: payload.teacherVinculoId,
      cursoId: payload.courseId,
      tipo: 'asistencia',
      titulo: 'Asistencia registrada',
      descripcion: `Has quedado ausente el día ${payload.fecha}`,
      metadata: {
        courseName: payload.courseName,
        fecha: payload.fecha,
        teacherName: payload.teacherName,
      },
    });

    const savedNotification = await this.notificacionRepo.save(notification);
    await this.notificacionDestinatarioRepo.save(
      this.notificacionDestinatarioRepo.create({
        notificacionId: savedNotification.id,
        receptorVinculoId: payload.alumnoVinculoId,
      }),
    );
  }

  private async getTeacherFullName(vinculoId: string): Promise<string | null> {
    const rows: any[] = await this.vinculoRepo.manager.query(
      `SELECT p.nombre, p.apellido_paterno, p.apellido_materno
       FROM vinculos_institucionales v
       LEFT JOIN personas p ON p.id = v.persona_id
       WHERE v.id = $1
       LIMIT 1`,
      [vinculoId],
    );
    if (!rows || rows.length === 0) return null;

    const { nombre, apellido_paterno, apellido_materno } = rows[0];
    const parts = [nombre, apellido_paterno, apellido_materno].filter(
      (value: any) => value && String(value).trim() !== '',
    );
    return parts.join(' ').trim() || null;
  }

  async getCourseSubjectPairs(
    vinculoId: string,
  ): Promise<CourseSubjectFilterItem[]> {
    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT c.id as course_id, c.nombre as course_name, c.annio, m.id as subject_id, m.nombre as subject_name
       FROM cursos_materias cm
       JOIN cursos c ON c.id = cm.curso_id
       JOIN materias m ON m.id = cm.materia_id
       WHERE cm.profesor_vinculo_id = $1
       ORDER BY c.annio DESC, c.nombre, m.nombre`,
      [vinculoId],
    );

    const seen = new Set<string>();
    return rows
      .map((r) => {
        const key = `${r.course_id}::${r.subject_id}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const label = `${r.course_name} - ${r.subject_name}`;
        return {
          courseId: r.course_id,
          courseName: r.course_name,
          year: r.annio,
          subjectId: r.subject_id,
          subjectName: r.subject_name,
          label,
        };
      })
      .filter((item): item is CourseSubjectFilterItem => item !== null);
  }

  async getSubjectsForTeacherCourse(
    vinculoId: string,
    courseId: string,
  ): Promise<SubjectFilterItem[]> {
    const subjects = await this.getSubjectsForTeacherInCourse(
      vinculoId,
      courseId,
    );
    return subjects.map((s) => ({
      courseId: s.courseId ?? courseId,
      courseName: s.courseName,
      subjectId: s.subjectId,
      subjectName: s.subjectName,
    }));
  }

  async getCourseFilterItemsForTeacher(
    vinculoId: string,
  ): Promise<CourseFilterItem[]> {
    const rows: Array<any> = await this.cursosMateriasRepo.manager.query(
      `SELECT DISTINCT c.id, c.nombre, c.annio
       FROM cursos_materias cm
       JOIN cursos c ON c.id = cm.curso_id
       WHERE cm.profesor_vinculo_id = $1
       UNION
       SELECT co.id, co.nombre, co.annio
       FROM cursos co
       WHERE co.profesor_jefe_vinculo_id = $1
       ORDER BY annio DESC, nombre`,
      [vinculoId],
    );

    return rows.map((r) => ({
      courseId: r.id,
      courseName: r.nombre,
      year: r.annio,
    }));
  }

  async createCommunication(
    creatorVinculoId: string,
    payload: TeacherCommunicationPayload,
  ): Promise<{ notificationId: string; recipients: number }> {
    const sender = await this.vinculoRepo.findOne({
      where: { id: creatorVinculoId },
    });
    if (!sender) {
      throw new NotFoundException(
        'Vínculo institucional del emisor no encontrado',
      );
    }

    const colegioId = sender.colegioId;
    const recipients = await this.gatherCommunicationRecipients(payload);
    if (recipients.length === 0) {
      throw new BadRequestException(
        'Debe especificar al menos un destinatario',
      );
    }

    const notification = this.notificacionRepo.create({
      colegioId,
      emisorVinculoId: creatorVinculoId,
      cursoId: payload.cursoId,
      tipo: payload.tipo ?? 'comunicacion',
      titulo: payload.asunto,
      descripcion: payload.descripcion,
      metadata: {
        tipo: payload.tipo,
        cursoId: payload.cursoId,
      },
    });

    const savedNotification = await this.notificacionRepo.save(notification);
    const recipientEntities = recipients.map((receptorVinculoId) =>
      this.notificacionDestinatarioRepo.create({
        notificacionId: savedNotification.id,
        receptorVinculoId,
      }),
    );
    await this.notificacionDestinatarioRepo.save(recipientEntities);

    return {
      notificationId: savedNotification.id,
      recipients: recipients.length,
    };
  }

  async getCommunicationsForTeacher(
    creatorVinculoId: string,
    options?: { limit?: number },
  ): Promise<TeacherCommunicationsResponse> {
    const sanitizedLimit =
      options?.limit && Number.isFinite(options.limit) && options.limit > 0
        ? Math.floor(options.limit)
        : undefined;
    const limitClause = sanitizedLimit ? `\nLIMIT ${sanitizedLimit}` : '';

    const rows: any[] = await this.notificacionRepo.manager.query(
      `SELECT n.id, n.titulo, n.descripcion, n.tipo, n.metadata, n.curso_id, n.created_at,
              COUNT(nd.id) AS recipient_count,
              COALESCE(SUM(CASE WHEN nd.leido THEN 1 ELSE 0 END), 0) AS read_recipients
       FROM notificaciones n
       LEFT JOIN notificacion_destinatarios nd ON nd.notificacion_id = n.id
       WHERE n.emisor_vinculo_id = $1
       GROUP BY n.id
       ORDER BY n.created_at DESC
       ${limitClause}`,
      [creatorVinculoId],
    );

    const items: TeacherCommunicationItem[] = rows.map((row) => {
      let metadata = row.metadata ?? null;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch {
          metadata = null;
        }
      }
      return {
        id: row.id,
        title: row.titulo,
        description: row.descripcion ?? null,
        type: row.tipo,
        metadata,
        courseId: row.curso_id ?? null,
        createdAt: row.created_at,
        recipients: Number(row.recipient_count ?? 0),
        readRecipients: Number(row.read_recipients ?? 0),
      };
    });

    return {
      total: items.length,
      items,
    };
  }

  private async gatherCommunicationRecipients(
    payload: TeacherCommunicationPayload,
  ): Promise<string[]> {
    const recipients = new Set<string>();
    if (payload.cursoId) {
      const currentYear = new Date().getFullYear();
      const rows: Array<{ alumno_vinculo_id: string }> =
        await this.cursosMateriasRepo.manager.query(
          `SELECT alumno_vinculo_id
         FROM alumnos_cursos
         WHERE curso_id = $1 AND annio = $2`,
          [payload.cursoId, currentYear],
        );
      for (const row of rows) {
        if (row.alumno_vinculo_id) {
          recipients.add(row.alumno_vinculo_id);
        }
      }
    }

    for (const candidate of [
      payload.estudianteId,
      payload.profesorId,
      payload.administradorId,
    ]) {
      if (candidate) recipients.add(candidate);
    }

    return Array.from(recipients);
  }

  async getStudentFilterItemsForCourse(
    vinculoId: string,
    courseId: string,
  ): Promise<StudentFilterItem[]> {
    const accessRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos_materias WHERE curso_id = $1 AND profesor_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    const jefeRes: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_vinculo_id = $2 LIMIT 1`,
      [courseId, vinculoId],
    );
    if (accessRes.length === 0 && jefeRes.length === 0) {
      throw new NotFoundException('No autorizado para acceder a este curso');
    }

    const currentYear = new Date().getFullYear();
    const rows: any[] = await this.cursosMateriasRepo.manager.query(
      `SELECT v.id as alumno_vinculo_id, p.rut, p.nombre, p.apellido_paterno, p.apellido_materno
       FROM alumnos_cursos ac
       JOIN vinculos_institucionales v ON v.id = ac.alumno_vinculo_id
       LEFT JOIN personas p ON p.id = v.persona_id
       WHERE ac.curso_id = $1 AND ac.annio = $2
       ORDER BY p.apellido_paterno, p.nombre`,
      [courseId, currentYear],
    );

    return rows.map((r) => {
      const fullName = [r.nombre, r.apellido_paterno, r.apellido_materno]
        .filter((x: any) => x && String(x).trim() !== '')
        .join(' ')
        .trim();
      return {
        alumnoVinculoId: r.alumno_vinculo_id,
        rut: r.rut ?? null,
        nombreCompleto: fullName || null,
      };
    });
  }

  async getAdministratorFilterItemsForColegio(
    vinculoId: string,
  ): Promise<AdministratorFilterItem[]> {
    const currentVinculo = await this.vinculoRepo.findOne({
      where: { id: vinculoId },
    });
    if (!currentVinculo) {
      throw new NotFoundException('Vínculo institucional no encontrado');
    }

    const colegioId = currentVinculo.colegioId;
    const rows: any[] = await this.vinculoRepo.manager.query(
      `SELECT v.id as vinculo_id, v.colegio_id, p.nombre, p.apellido_paterno, p.apellido_materno, p.rut, c.email
       FROM vinculos_institucionales v
       LEFT JOIN personas p ON p.id = v.persona_id
       LEFT JOIN contactos c ON c.id = p.contacto_id
       LEFT JOIN roles r ON r.id = v.rol_id
       WHERE v.colegio_id = $1 AND r.nombre IN ('administrador','administrativo')
       ORDER BY p.apellido_paterno, p.nombre`,
      [colegioId],
    );

    return rows.map((r) => {
      const fullName = [r.nombre, r.apellido_paterno, r.apellido_materno]
        .filter((x: any) => x && String(x).trim() !== '')
        .join(' ')
        .trim();
      return {
        vinculoId: r.vinculo_id,
        colegioId: r.colegio_id ?? null,
        rut: r.rut ?? null,
        nombreCompleto: fullName || null,
        email: r.email ?? null,
      };
    });
  }
}

type CourseSubjectFilterItem = {
  courseId: string;
  courseName: string;
  year: number;
  subjectId: string;
  subjectName: string;
  label: string;
};

type CourseFilterItem = {
  courseId: string;
  courseName: string;
  year: number;
};

type SubjectFilterItem = {
  courseId: string;
  courseName: string;
  subjectId: string;
  subjectName: string;
};

type StudentFilterItem = {
  alumnoVinculoId: string;
  rut: string | null;
  nombreCompleto: string | null;
};

type AdministratorFilterItem = {
  vinculoId: string;
  colegioId: string | null;
  rut: string | null;
  nombreCompleto: string | null;
  email: string | null;
};
