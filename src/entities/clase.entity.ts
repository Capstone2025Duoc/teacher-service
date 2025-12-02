import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CursosMaterias } from './cursos-materias.entity';

@Entity({ name: 'clases' })
export class Clase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'curso_materia_id', type: 'uuid' })
  cursoMateriaId: string;

  @ManyToOne(() => CursosMaterias)
  @JoinColumn({ name: 'curso_materia_id' })
  cursoMateria: CursosMaterias;

  @Column({ name: 'fecha', type: 'date' })
  fecha: string; // YYYY-MM-DD

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin: string;

  @Column({ name: 'tema', nullable: true })
  tema: string;

  @Column({ name: 'observaciones', nullable: true })
  observaciones: string;
}
