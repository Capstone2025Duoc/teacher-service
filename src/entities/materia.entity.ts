import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'materias' })
export class Materia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'colegio_id', type: 'uuid' })
  colegioId: string;

  @Column({ name: 'nombre' })
  nombre: string;

  @Column({ name: 'descripcion', nullable: true })
  descripcion: string;
}
