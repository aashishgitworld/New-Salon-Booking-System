import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AppointmentService } from '../../appointments/entities/appointment_service.entity';
import { Expose } from 'class-transformer';

@Entity('services')
@Index('UQ_SERVICES_NAME', ['name'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Service extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Expose()
  get serviceId(): string {
    return this.guid;
  }

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Duration in minutes */
  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(
    () => AppointmentService,
    (appointmentService) => appointmentService.service,
  )
  appointmentServices: AppointmentService[];
}
