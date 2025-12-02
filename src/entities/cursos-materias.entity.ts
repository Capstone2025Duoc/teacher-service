import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Materia } from './materia.entity';
import { Curso } from './curso.entity';
import { Vinculo } from './vinculo.entity';

@Entity({ name: 'cursos_materias' })
export class CursosMaterias {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'curso_id', type: 'uuid' })
  cursoId: string;

  @ManyToOne(() => Curso)
  @JoinColumn({ name: 'curso_id' })
  curso: Curso;

  @Column({ name: 'materia_id', type: 'uuid' })
  materiaId: string;

  @ManyToOne(() => Materia)
  @JoinColumn({ name: 'materia_id' })
  materia: Materia;

  @Column({ name: 'profesor_vinculo_id', type: 'uuid' })
  profesorVinculoId: string;

  @ManyToOne(() => Vinculo)
  @JoinColumn({ name: 'profesor_vinculo_id' })
  profesorVinculo: Vinculo;
}
