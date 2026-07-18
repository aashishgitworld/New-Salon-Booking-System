import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
@UseGuards(RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all salon services' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  async list(@Query('activeOnly') activeOnly?: string) {
    const onlyActive = activeOnly === 'true';
    const data = await this.servicesService.findAll(onlyActive);
    return { message: 'Services fetched', data };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single service' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.servicesService.findById(id);
    return { message: 'Service fetched', data };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create a new service (admin/staff)' })
  async create(@Body() dto: CreateServiceDto) {
    const data = await this.servicesService.create(dto);
    return { message: 'Service created', data };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Update a service (admin/staff)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    const data = await this.servicesService.update(id, dto);
    return { message: 'Service updated', data };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a service (admin)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.servicesService.remove(id);
    return { message: 'Service deleted', data: null };
  }
}
