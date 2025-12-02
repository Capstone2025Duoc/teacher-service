import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'salas' })
export class Sala {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'colegio_id', type: 'uuid' })
  colegioId: string;

  @Column({ type: 'varchar', length: 50 })
  nombre: string;

  @Column({ type: 'integer', nullable: true })
  capacidad: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ubicacion: string;
}
