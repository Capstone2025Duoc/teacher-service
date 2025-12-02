import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CursosMaterias } from './cursos-materias.entity';
import { Sala } from './sala.entity';

@Entity({ name: 'horarios' })
export class Horario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'curso_materia_id', type: 'uuid' })
  cursoMateriaId: string;

  @ManyToOne(() => CursosMaterias)
  @JoinColumn({ name: 'curso_materia_id' })
  cursoMateria: CursosMaterias;

  // 0 = Sunday .. 6 = Saturday
  @Column({ name: 'dia_semana', type: 'smallint' })
  diaSemana: number;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin: string;

  @Column({ name: 'sala_id', type: 'uuid', nullable: true })
  salaId?: string;

  @ManyToOne(() => Sala, { nullable: true })
  @JoinColumn({ name: 'sala_id' })
  sala?: Sala;

  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fechaInicio?: string;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin?: string;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;
}
