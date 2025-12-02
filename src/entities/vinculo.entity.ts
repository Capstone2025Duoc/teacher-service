import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'vinculos_institucionales' })
export class Vinculo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'persona_id', type: 'uuid' })
  personaId: string;

  @Column({ name: 'colegio_id', type: 'uuid' })
  colegioId: string;

  @Column({ name: 'rol_id', type: 'uuid' })
  rolId: string;

  @Column({ name: 'email_institucional', nullable: true })
  emailInstitucional: string;

  @Column({ name: 'estado', nullable: true })
  estado: string;
}
