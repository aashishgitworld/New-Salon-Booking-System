import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
  } from 'typeorm';
  import { BaseEntity } from '../../common/entities/base.entity';
  import { Appointment } from '../../appointments/entities/appointment.entity';
  
  export enum PaymentStatus {
    UNPAID = 'unpaid',
    PARTIAL = 'partial',
    PAID = 'paid',
    REFUNDED = 'refunded',
  }
  
  export enum PaymentMethod {
    CASH = 'cash',
    CARD = 'card',
    ESEWA = 'esewa',
    KHALTI = 'khalti',
    BANK = 'bank',
  }
  
  @Entity('payments')
  export class Payment extends BaseEntity {
    @Column({ name: 'appointment_id', type: 'int' })
    appointmentId: number;
  
    @ManyToOne(() => Appointment, (appointment) => appointment.payments, {
      onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'appointment_id' })
    appointment: Appointment;
  
    @Column({
      name: 'total_amount',
      type: 'decimal',
      precision: 10,
      scale: 2,
    })
    totalAmount: number;
  
    @Column({
      type: 'decimal',
      precision: 10,
      scale: 2,
      default: 0,
    })
    discount: number;
  
    @Column({
      name: 'paid_amount',
      type: 'decimal',
      precision: 10,
      scale: 2,
      default: 0,
    })
    paidAmount: number;
  
    @Column({
      name: 'due_amount',
      type: 'decimal',
      precision: 10,
      scale: 2,
      default: 0,
    })
    dueAmount: number;
  
    @Column({
      type: 'enum',
      enum: PaymentMethod,
    })
    paymentMethod: PaymentMethod;
  
    @Column({
      type: 'enum',
      enum: PaymentStatus,
      default: PaymentStatus.UNPAID,
    })
    paymentStatus: PaymentStatus;
  
    @Column({
      name: 'paid_at',
      type: 'timestamptz',
      nullable: true,
    })
    paidAt: Date | null;
  }