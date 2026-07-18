import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Appointment } from './entities/appointment.entity';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
  ) {}

  // --- Write operations (wrapped in a DB transaction) ---

  async create(dto: CreatePaymentDto): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.resolveAppointment(
        manager,
        dto.appointmentId,
      );

      const paymentRepo = manager.getRepository(Payment);
      const discount = dto.discount ?? 0;
      const paidAmount = dto.paidAmount ?? 0;

      const payment = paymentRepo.create({
        appointmentId: Number(appointment.id),
        totalAmount: dto.totalAmount,
        discount,
        paidAmount,
        dueAmount: this.computeDue(dto.totalAmount, discount, paidAmount),
        paymentMethod: dto.paymentMethod,
        paymentStatus: dto.paymentStatus ?? PaymentStatus.UNPAID,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : null,
      });

      const saved = await paymentRepo.save(payment);
      return this.findByIdWithManager(manager, saved.guid);
    });
  }

  async update(id: string, dto: UpdatePaymentDto): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const payment = await paymentRepo.findOne({ where: { guid: id } });
      if (!payment) throw new NotFoundException('Payment not found');

      if (dto.appointmentId) {
        const appointment = await this.resolveAppointment(
          manager,
          dto.appointmentId,
        );
        payment.appointmentId = Number(appointment.id);
      }

      if (dto.totalAmount !== undefined) payment.totalAmount = dto.totalAmount;
      if (dto.discount !== undefined) payment.discount = dto.discount;
      if (dto.paidAmount !== undefined) payment.paidAmount = dto.paidAmount;
      if (dto.paymentMethod !== undefined)
        payment.paymentMethod = dto.paymentMethod;
      if (dto.paymentStatus !== undefined)
        payment.paymentStatus = dto.paymentStatus;
      if (dto.paidAt !== undefined)
        payment.paidAt = dto.paidAt ? new Date(dto.paidAt) : null;

      payment.dueAmount = this.computeDue(
        Number(payment.totalAmount),
        Number(payment.discount),
        Number(payment.paidAmount),
      );

      await paymentRepo.save(payment);
      return this.findByIdWithManager(manager, payment.guid);
    });
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const payment = await paymentRepo.findOne({ where: { guid: id } });
      if (!payment) throw new NotFoundException('Payment not found');
      await paymentRepo.softRemove(payment);
    });
  }

  // --- Read operations (no transaction) ---

  async findAll(appointmentGuid?: string): Promise<Payment[]> {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.appointment', 'appointment')
      .orderBy('payment.createdAt', 'DESC');

    if (appointmentGuid) {
      qb.andWhere('appointment.guid = :guid', { guid: appointmentGuid });
    }
    return qb.getMany();
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { guid: id },
      relations: ['appointment'],
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  // --- Helpers ---

  private computeDue(
    totalAmount: number,
    discount: number,
    paidAmount: number,
  ): number {
    const due = Number(totalAmount) - Number(discount) - Number(paidAmount);
    return due > 0 ? due : 0;
  }

  private async resolveAppointment(
    manager: EntityManager,
    appointmentGuid: string,
  ): Promise<Appointment> {
    const appointment = await manager
      .getRepository(Appointment)
      .findOne({ where: { guid: appointmentGuid } });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  private async findByIdWithManager(
    manager: EntityManager,
    guid: string,
  ): Promise<Payment> {
    const payment = await manager
      .getRepository(Payment)
      .findOne({ where: { guid }, relations: ['appointment'] });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
}
