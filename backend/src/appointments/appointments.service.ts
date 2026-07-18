import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  Appointment,
  AppointmentStatus,
} from './entities/appointment.entity';
import { AppointmentService } from './entities/appointment_service.entity';
import { Service } from '../services/entities/service.entity';
import { Staff } from '../staff/entities/staff.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { TimeSlot, TimeSlotService } from './time-slot.service';
import {
  CreateAppointmentDto,
  GetAvailableSlotsDto,
  ListAppointmentsDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';
import { PaginatedResponse } from '../common/dto/pagination.dto';
import { AppointmentsGateway } from './appointments.gateway';
import { SOCKET_EVENTS } from '../common/constants';

const APPOINTMENT_RELATIONS = [
  'user',
  'staff',
  'services',
  'services.service',
  'payments',
];

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly timeSlotService: TimeSlotService,
    private readonly appointmentsGateway: AppointmentsGateway,
    private readonly dataSource: DataSource,
  ) {}

  // --- Write operations (wrapped in a DB transaction) ---

  async create(dto: CreateAppointmentDto, user: User): Promise<Appointment> {
    const appointment = await this.dataSource.transaction(async (manager) => {
      const staff = await this.resolveStaff(manager, dto.staffId);
      const services = await this.resolveServices(manager, dto.serviceIds);

      const durationMinutes = services.reduce(
        (sum, s) => sum + s.durationMinutes,
        0,
      );

      const validation = await this.timeSlotService.validateSlot(
        dto.appointmentDate,
        dto.startTime,
        durationMinutes,
        Number(staff.id),
      );
      if (!validation.valid) {
        throw new BadRequestException(validation.reason);
      }

      const appointmentRepo = manager.getRepository(Appointment);
      const appointment = appointmentRepo.create({
        userId: Number(user.id),
        staffId: Number(staff.id),
        appointmentDate: dto.appointmentDate as unknown as Date,
        startTime: this.normalizeTime(dto.startTime),
        endTime: validation.endTime!,
        status: AppointmentStatus.PENDING,
        notes: dto.notes ?? null,
      });
      const saved = await appointmentRepo.save(appointment);

      await this.replaceServices(manager, Number(saved.id), services);

      return this.findByIdWithManager(manager, saved.guid);
    });

    this.appointmentsGateway.emitToAll(
      SOCKET_EVENTS.APPOINTMENT_CREATED,
      appointment,
    );
    return appointment;
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    user: User,
  ): Promise<Appointment> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const appointmentRepo = manager.getRepository(Appointment);
      const appointment = await appointmentRepo.findOne({
        where: { guid: id },
        relations: ['services', 'services.service'],
      });
      if (!appointment) throw new NotFoundException('Appointment not found');
      this.assertCanModify(appointment, user);

      let staffId = appointment.staffId;
      if (dto.staffId) {
        const staff = await this.resolveStaff(manager, dto.staffId);
        staffId = Number(staff.id);
      }

      let services: Service[] | null = null;
      if (dto.serviceIds) {
        services = await this.resolveServices(manager, dto.serviceIds);
      }

      const durationMinutes = (services ?? appointment.services.map((s) => s.service)).reduce(
        (sum, s) => sum + s.durationMinutes,
        0,
      );

      const appointmentDate =
        dto.appointmentDate ??
        (appointment.appointmentDate as unknown as string);
      const startTime = dto.startTime
        ? this.normalizeTime(dto.startTime)
        : appointment.startTime;

      // Revalidate when timing, staff, or services change.
      if (dto.appointmentDate || dto.startTime || dto.staffId || dto.serviceIds) {
        const validation = await this.timeSlotService.validateSlot(
          appointmentDate,
          startTime,
          durationMinutes,
          staffId,
          appointment.guid,
        );
        if (!validation.valid) {
          throw new BadRequestException(validation.reason);
        }
        appointment.endTime = validation.endTime!;
      }

      appointment.staffId = staffId;
      appointment.appointmentDate = appointmentDate as unknown as Date;
      appointment.startTime = startTime;
      appointment.notes = dto.notes ?? appointment.notes;
      appointment.status = dto.status ?? appointment.status;

      await appointmentRepo.save(appointment);

      if (services) {
        await this.replaceServices(manager, Number(appointment.id), services);
      }

      return this.findByIdWithManager(manager, appointment.guid);
    });

    this.appointmentsGateway.emitToAll(
      SOCKET_EVENTS.APPOINTMENT_UPDATED,
      updated,
    );
    return updated;
  }

  async cancel(id: string, user: User): Promise<Appointment> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const appointmentRepo = manager.getRepository(Appointment);
      const appointment = await appointmentRepo.findOne({
        where: { guid: id },
      });
      if (!appointment) throw new NotFoundException('Appointment not found');
      this.assertCanModify(appointment, user);

      appointment.status = AppointmentStatus.CANCELLED;
      await appointmentRepo.save(appointment);
      return this.findByIdWithManager(manager, appointment.guid);
    });

    this.appointmentsGateway.emitToAll(
      SOCKET_EVENTS.APPOINTMENT_UPDATED,
      updated,
    );
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const appointmentRepo = manager.getRepository(Appointment);
      const appointment = await appointmentRepo.findOne({
        where: { guid: id },
      });
      if (!appointment) throw new NotFoundException('Appointment not found');

      await manager
        .getRepository(AppointmentService)
        .delete({ appointmentId: Number(appointment.id) });
      await appointmentRepo.softRemove(appointment);
    });
  }

  // --- Read operations (no transaction) ---

  async list(
    query: ListAppointmentsDto,
    user: User,
  ): Promise<PaginatedResponse<Appointment>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.staff', 'staff')
      .leftJoinAndSelect('appointment.user', 'user')
      .leftJoinAndSelect('appointment.services', 'appointmentService')
      .leftJoinAndSelect('appointmentService.service', 'service')
      .leftJoinAndSelect('appointment.payments', 'payment')
      .orderBy('appointment.appointmentDate', 'DESC')
      .addOrderBy('appointment.startTime', 'DESC');

    // Customers only see their own; staff/admin see all
    if (user.role === UserRole.CUSTOMER) {
      qb.andWhere('appointment.userId = :uid', { uid: Number(user.id) });
    }

    if (query.status) {
      qb.andWhere('appointment.status = :status', { status: query.status });
    }
    if (query.staffId) {
      qb.andWhere('staff.guid = :staffGuid', { staffGuid: query.staffId });
    }
    if (query.from) {
      qb.andWhere('appointment.appointmentDate >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('appointment.appointmentDate <= :to', { to: query.to });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponse(data, total, page, limit);
  }

  async findById(id: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { guid: id },
      relations: APPOINTMENT_RELATIONS,
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async getAvailableSlots(dto: GetAvailableSlotsDto): Promise<{
    date: string;
    service: { id: string; name: string; durationMinutes: number };
    slots: TimeSlot[];
  }> {
    const service = await this.dataSource
      .getRepository(Service)
      .findOne({ where: { guid: dto.serviceId } });
    if (!service) throw new NotFoundException('Service not found');

    let staffId: number | undefined;
    if (dto.staffId) {
      const staff = await this.dataSource
        .getRepository(Staff)
        .findOne({ where: { guid: dto.staffId } });
      if (!staff) throw new NotFoundException('Staff not found');
      staffId = Number(staff.id);
    }

    const slots = await this.timeSlotService.getAvailableSlots(
      new Date(dto.date),
      service.durationMinutes,
      staffId,
    );

    return {
      date: dto.date,
      service: {
        id: service.guid,
        name: service.name,
        durationMinutes: service.durationMinutes,
      },
      slots,
    };
  }

  // --- Helpers ---

  private normalizeTime(time: string): string {
    return time.length === 5 ? `${time}:00` : time;
  }

  private async resolveStaff(
    manager: EntityManager,
    staffGuid: string,
  ): Promise<Staff> {
    const staff = await manager
      .getRepository(Staff)
      .findOne({ where: { guid: staffGuid } });
    if (!staff) throw new NotFoundException('Staff not found');
    if (!staff.isActive) {
      throw new BadRequestException('Staff member is not available');
    }
    return staff;
  }

  private async resolveServices(
    manager: EntityManager,
    serviceGuids: string[],
  ): Promise<Service[]> {
    const services = await manager
      .getRepository(Service)
      .find({ where: { guid: In(serviceGuids) } });

    if (services.length !== serviceGuids.length) {
      throw new BadRequestException('One or more services were not found');
    }
    const inactive = services.find((s) => !s.isActive);
    if (inactive) {
      throw new BadRequestException(`Service "${inactive.name}" is not available`);
    }
    return services;
  }

  private async replaceServices(
    manager: EntityManager,
    appointmentId: number,
    services: Service[],
  ): Promise<void> {
    const joinRepo = manager.getRepository(AppointmentService);
    await joinRepo.delete({ appointmentId });

    const links = services.map((service) =>
      joinRepo.create({
        appointmentId,
        serviceId: Number(service.id),
        price: service.price,
        durationMinutes: service.durationMinutes,
      }),
    );
    await joinRepo.save(links);
  }

  private async findByIdWithManager(
    manager: EntityManager,
    guid: string,
  ): Promise<Appointment> {
    const appointment = await manager.getRepository(Appointment).findOne({
      where: { guid },
      relations: APPOINTMENT_RELATIONS,
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  private assertCanModify(appointment: Appointment, user: User): void {
    if (
      user.role === UserRole.CUSTOMER &&
      appointment.userId !== Number(user.id)
    ) {
      throw new ForbiddenException('You may only modify your own appointments');
    }
  }
}
