export class SubjectDto {
  courseId: string | null;
  courseName: string;
  subjectId: string;
  subjectName: string;
}

export class LastClassDto {
  classId: string;
  date: string; // ISO date YYYY-MM-DD
  courseId: string;
  courseName: string;
  subjectId: string;
  subjectName: string;
  startTime?: string; // HH:MM:SS
  endTime?: string; // HH:MM:SS
  topic?: string;
  observations?: string;
}

export class TeacherMainOverviewDto {
  vinculoId: string; // teacher link id (vinculo_institucional)
  subjects: SubjectDto[];
  lastClass?: LastClassDto;
}
