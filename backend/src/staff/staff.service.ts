import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Staff } from './entities/staff.entity';
import { StaffService as StaffServiceEntity } from './entities/staff_service.entity';
import { Service } from '../services/entities/service.entity';
import { CreateStaffDto, UpdateStaffDto } from './staff.dto';

@Injectable()
export class StaffsService {
  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(StaffServiceEntity)
    private readonly staffServiceRepository: Repository<StaffServiceEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // --- Write operations (wrapped in a DB transaction) ---

  async create(dto: CreateStaffDto): Promise<Staff> {
    return this.dataSource.transaction(async (manager) => {
      const staffRepo = manager.getRepository(Staff);
      const { serviceIds, ...staffData } = dto;
      const staff = staffRepo.create(staffData);
      const saved = await staffRepo.save(staff);

      if (serviceIds?.length) {
        await this.syncServices(manager, saved.id, serviceIds);
      }

      return this.findByIdWithManager(manager, saved.id);
    });
  }

  async update(id: string, dto: UpdateStaffDto): Promise<Staff> {
    return this.dataSource.transaction(async (manager) => {
      const staffRepo = manager.getRepository(Staff);
      const staff = await staffRepo.findOne({ where: { id } });
      if (!staff) throw new NotFoundException('Staff not found');

      const { serviceIds, ...staffData } = dto;
      Object.assign(staff, staffData);
      await staffRepo.save(staff);

      if (serviceIds) {
        await this.syncServices(manager, staff.id, serviceIds);
      }

      return this.findByIdWithManager(manager, staff.id);
    });
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const staffRepo = manager.getRepository(Staff);
      const joinRepo = manager.getRepository(StaffServiceEntity);

      const staff = await staffRepo.findOne({ where: { id } });
      if (!staff) throw new NotFoundException('Staff not found');

      await joinRepo.delete({ staffId: Number(staff.id) });
      await staffRepo.softRemove(staff);
    });
  }

  // --- Read operations (no transaction) ---

  async findAll(onlyActive = false): Promise<Staff[]> {
    const staffList = await this.staffRepository.find({
      where: onlyActive ? { isActive: true } : {},
      order: { firstName: 'ASC' },
    });

    for (const staff of staffList) {
      await this.attachServices(staff);
    }
    return staffList;
  }

  async findById(id: string): Promise<Staff> {
    const staff = await this.staffRepository.findOne({ where: { id } });
    if (!staff) throw new NotFoundException('Staff not found');
    await this.attachServices(staff);
    return staff;
  }

  // --- Helpers ---

  private async attachServices(staff: Staff): Promise<void> {
    const links = await this.staffServiceRepository.find({
      where: { staffId: Number(staff.id) },
    });
    (staff as Staff & { services: Service[] }).services = links.map(
      (link) => link.service,
    );
  }

  private async findByIdWithManager(
    manager: EntityManager,
    id: string,
  ): Promise<Staff> {
    const staff = await manager
      .getRepository(Staff)
      .findOne({ where: { id } });
    if (!staff) throw new NotFoundException('Staff not found');

    const links = await manager
      .getRepository(StaffServiceEntity)
      .find({ where: { staffId: Number(staff.id) } });
    (staff as Staff & { services: Service[] }).services = links.map(
      (link) => link.service,
    );
    return staff;
  }

  private async syncServices(
    manager: EntityManager,
    staffId: string,
    serviceIds: string[],
  ): Promise<void> {
    const joinRepo = manager.getRepository(StaffServiceEntity);

    // Clear existing assignments first so update is idempotent.
    await joinRepo.delete({ staffId: Number(staffId) });

    if (!serviceIds.length) return;

    const services = await manager.getRepository(Service).find({
      where: { guid: In(serviceIds) },
    });
    if (services.length !== serviceIds.length) {
      throw new BadRequestException('One or more services were not found');
    }

    const links = services.map((service) =>
      joinRepo.create({
        staffId: Number(staffId),
        serviceId: Number(service.id),
      }),
    );
    await joinRepo.save(links);
  }
}
