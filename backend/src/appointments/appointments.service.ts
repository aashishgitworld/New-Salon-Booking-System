import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  Appointment,
  AppointmentStatus,
} from './entities/appointment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ServicesService } from '../services/services.service';
import { TimeSlotService } from './time-slot.service';
import {
  CreateAppointmentDto,
  ListAppointmentsDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';
import { PaginatedResponse } from '../common/dto/pagination.dto';
import { AppointmentsGateway } from './appointments.gateway';
import { SOCKET_EVENTS } from '../common/constants';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly servicesService: ServicesService,
    private readonly timeSlotService: TimeSlotService,
    private readonly appointmentsGateway: AppointmentsGateway,
  ) {}

  async create(dto: CreateAppointmentDto, user: User): Promise<Appointment> {
    const service = await this.servicesService.findById(dto.serviceId);
    if (!service.isActive) {
      throw new BadRequestException('Service is not available');
    }

    const startTime = new Date(dto.startTime);
    const validation = await this.timeSlotService.validateSlot(
      startTime,
      service,
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.reason);
    }

    const endTime = new Date(
      startTime.getTime() + service.durationMinutes * 60_000,
    );

    const appointment = this.appointmentRepository.create({
      customerId: user.id,
      serviceId: service.id,
      startTime,
      endTime,
      status: AppointmentStatus.PENDING,
      notes: dto.notes,
      customerName: dto.customerName ?? user.fullName,
      customerEmail: dto.customerEmail ?? user.email,
      customerPhone: dto.customerPhone ?? user.phone,
    });

    const saved = await this.appointmentRepository.save(appointment);
    const full = await this.findById(saved.id);

    this.appointmentsGateway.emitToAll(
      SOCKET_EVENTS.APPOINTMENT_CREATED,
      full,
    );

    return full;
  }

  async list(
    query: ListAppointmentsDto,
    user: User,
  ): Promise<PaginatedResponse<Appointment>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.service', 'service')
      .leftJoinAndSelect('appointment.customer', 'customer')
      .orderBy('appointment.startTime', 'DESC');

    // Customers only see their own; staff/admin see all
    if (user.role === UserRole.CUSTOMER) {
      qb.andWhere('appointment.customerId = :uid', { uid: user.id });
    }

    if (query.status) {
      qb.andWhere('appointment.status = :status', { status: query.status });
    }
    if (query.serviceId) {
      qb.andWhere('appointment.serviceId = :sid', { sid: query.serviceId });
    }
    if (query.from) {
      qb.andWhere('appointment.startTime >= :from', {
        from: new Date(query.from),
      });
    }
    if (query.to) {
      qb.andWhere('appointment.startTime <= :to', { to: new Date(query.to) });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponse(data, total, page, limit);
  }

  async findById(id: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['service', 'customer'],
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    user: User,
  ): Promise<Appointment> {
    const appointment = await this.findById(id);
    this.assertCanModify(appointment, user);

    let service = appointment.service;
    if (dto.serviceId && dto.serviceId !== appointment.serviceId) {
      service = await this.servicesService.findById(dto.serviceId);
    }

    const newStart = dto.startTime
      ? new Date(dto.startTime)
      : appointment.startTime;

    // Revalidate if time or service changed
    if (dto.startTime || dto.serviceId) {
      const validation = await this.timeSlotService.validateSlot(
        newStart,
        service,
        appointment.id,
      );
      if (!validation.valid) {
        throw new BadRequestException(validation.reason);
      }
    }

    const newEnd = new Date(
      newStart.getTime() + service.durationMinutes * 60_000,
    );

    Object.assign(appointment, {
      serviceId: service.id,
      startTime: newStart,
      endTime: newEnd,
      notes: dto.notes ?? appointment.notes,
      customerName: dto.customerName ?? appointment.customerName,
      customerEmail: dto.customerEmail ?? appointment.customerEmail,
      customerPhone: dto.customerPhone ?? appointment.customerPhone,
      status: dto.status ?? appointment.status,
    });

    await this.appointmentRepository.save(appointment);
    const updated = await this.findById(id);
    this.appointmentsGateway.emitToAll(
      SOCKET_EVENTS.APPOINTMENT_UPDATED,
      updated,
    );
    return updated;
  }

  async cancel(id: string, user: User): Promise<Appointment> {
    const appointment = await this.findById(id);
    this.assertCanModify(appointment, user);
    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepository.save(appointment);
    const updated = await this.findById(id);
    this.appointmentsGateway.emitToAll(
      SOCKET_EVENTS.APPOINTMENT_UPDATED,
      updated,
    );
    return updated;
  }

  /** Used by the bulk import flow. Skips the "cannot book in the past" check. */
  async createInternal(params: {
    serviceId: string;
    startTime: Date;
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    notes?: string;
  }): Promise<Appointment> {
    const service = await this.servicesService.findById(params.serviceId);
    const endTime = new Date(
      params.startTime.getTime() + service.durationMinutes * 60_000,
    );

    // Still check break and conflicts
    const validation = await this.timeSlotService.validateSlot(
      params.startTime,
      service,
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.reason);
    }

    const appointment = this.appointmentRepository.create({
      customerId: params.customerId,
      serviceId: service.id,
      startTime: params.startTime,
      endTime,
      status: AppointmentStatus.CONFIRMED,
      notes: params.notes,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
    });
    return this.appointmentRepository.save(appointment);
  }

  private assertCanModify(appointment: Appointment, user: User): void {
    if (
      user.role === UserRole.CUSTOMER &&
      appointment.customerId !== user.id
    ) {
      throw new ForbiddenException(
        'You may only modify your own appointments',
      );
    }
  }
}
