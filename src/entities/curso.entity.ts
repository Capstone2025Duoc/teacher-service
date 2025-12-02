import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'cursos' })
export class Curso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'colegio_id', type: 'uuid' })
  colegioId: string;

  @Column({ name: 'nombre' })
  nombre: string;

  @Column({ name: 'nivel', nullable: true })
  nivel: string;

  // DB column is "annio"; map to 'anio' (property stays 'anio')
  @Column({ name: 'annio', type: 'integer' })
  anio: number;
}
