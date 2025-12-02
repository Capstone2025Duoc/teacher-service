import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vinculo } from './vinculo.entity';
import { Materia } from './materia.entity';

@Entity({ name: 'profesores_materias' })
export class ProfesorMateria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profesor_vinculo_id', type: 'uuid' })
  profesorVinculoId: string;

  @ManyToOne(() => Vinculo)
  @JoinColumn({ name: 'profesor_vinculo_id' })
  profesorVinculo: Vinculo;

  @Column({ name: 'materia_id', type: 'uuid' })
  materiaId: string;

  @ManyToOne(() => Materia)
  @JoinColumn({ name: 'materia_id' })
  materia: Materia;
}
