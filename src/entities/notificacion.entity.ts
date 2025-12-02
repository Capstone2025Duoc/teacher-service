import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity({ name: 'notificaciones' })
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'colegio_id', type: 'uuid' })
  colegioId: string;

  @Column({ name: 'emisor_vinculo_id', type: 'uuid' })
  emisorVinculoId: string;

  @Column({ name: 'curso_id', type: 'uuid', nullable: true })
  cursoId?: string;

  @Column({ name: 'curso_materia_id', type: 'uuid', nullable: true })
  cursoMateriaId?: string;

  @Column({ name: 'evaluacion_id', type: 'uuid', nullable: true })
  evaluacionId?: string;

  @Column({ length: 50, default: 'general' })
  tipo: string;

  @Column({ length: 200 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @OneToMany(() => NotificacionDestinatario, (dest) => dest.notificacion)
  destinatarios: NotificacionDestinatario[];
}

@Entity({ name: 'notificacion_destinatarios' })
export class NotificacionDestinatario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notificacion_id', type: 'uuid' })
  notificacionId: string;

  @Column({ name: 'receptor_vinculo_id', type: 'uuid' })
  receptorVinculoId: string;

  @Column({ name: 'leido', type: 'boolean', default: false })
  leido: boolean;

  @Column({ name: 'leido_en', type: 'timestamptz', nullable: true })
  leidoEn?: Date | null;

  @ManyToOne(() => Notificacion, (notificacion) => notificacion.destinatarios)
  @JoinColumn({ name: 'notificacion_id' })
  notificacion: Notificacion;
}
