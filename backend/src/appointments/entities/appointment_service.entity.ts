import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
  } from 'typeorm';
  import { BaseEntity } from '../../common/entities/base.entity';
  import { Appointment } from './appointment.entity';
  import { Service } from '../../services/entities/service.entity';
  
  @Entity('appointment_services')
  @Index('UQ_APPOINTMENT_SERVICE', ['appointmentId', 'serviceId'], {
    unique: true,
  })
  export class AppointmentService extends BaseEntity {
    @Column({ name: 'appointment_id', type: 'int' })
    appointmentId: number;
  
    @ManyToOne(() => Appointment, (appointment) => appointment.services, {
      onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'appointment_id' })
    appointment: Appointment;
  
    @Column({ name: 'service_id', type: 'int' })
    serviceId: number;
  
    @ManyToOne(() => Service, {
      onDelete: 'RESTRICT',
    })
    @JoinColumn({ name: 'service_id' })
    service: Service;
  
    @Column({
      type: 'decimal',
      precision: 10,
      scale: 2,
    })
    price: number;
  
    @Column({
      name: 'duration_minutes',
      type: 'int',
    })
    durationMinutes: number;
  }