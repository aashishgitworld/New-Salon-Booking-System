import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
  ) {}

  create(dto: CreateServiceDto): Promise<Service> {
    const entity = this.serviceRepository.create(dto);
    return this.serviceRepository.save(entity);
  }

  findAll(onlyActive = false): Promise<Service[]> {
    return this.serviceRepository.find({
      where: onlyActive ? { isActive: true } : {},
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    await this.findById(id);
    await this.serviceRepository.update(id, dto);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    const service = await this.findById(id);
    await this.serviceRepository.softRemove(service);
  }
}
