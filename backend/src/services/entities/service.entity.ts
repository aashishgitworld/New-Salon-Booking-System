import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';

export enum ServiceCategory {
  HAIR = 'hair',
  NAILS = 'nails',
  MASSAGE = 'massage',
  SPA = 'spa',
  FACIAL = 'facial',
  OTHER = 'other',
}

@Entity('services')
export class Service extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ServiceCategory,
    default: ServiceCategory.OTHER,
  })
  category: ServiceCategory;

  /** Duration in minutes */
  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Appointment, (appointment) => appointment.service)
  appointments: Appointment[];
}
