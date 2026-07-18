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
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  GetAvailableSlotsDto,
  ListAppointmentsDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
@UseGuards(RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new appointment' })
  async create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.appointmentsService.create(dto, user);
    return { message: 'Appointment created', data };
  }

  @Get()
  @ApiOperation({ summary: 'List appointments (filterable)' })
  async list(
    @Query() query: ListAppointmentsDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.appointmentsService.list(query, user);
    return { message: 'Appointments fetched', data };
  }

  @Get('available-slots')
  @ApiOperation({
    summary: 'Get available time slots for a given date and service',
  })
  @ApiQuery({ name: 'date', example: '2026-05-15' })
  @ApiQuery({ name: 'serviceId' })
  @ApiQuery({ name: 'staffId', required: false })
  async availableSlots(@Query() query: GetAvailableSlotsDto) {
    const data = await this.appointmentsService.getAvailableSlots(query);
    return { message: 'Available slots fetched', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an appointment by id' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.appointmentsService.findById(id);
    return { message: 'Appointment fetched', data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an appointment' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.appointmentsService.update(id, dto, user);
    return { message: 'Appointment updated', data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel an appointment' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const data = await this.appointmentsService.cancel(id, user);
    return { message: 'Appointment cancelled', data };
  }

  @Delete(':id/hard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Permanently delete an appointment (admin)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.appointmentsService.remove(id);
    return { message: 'Appointment deleted', data: null };
  }
}
