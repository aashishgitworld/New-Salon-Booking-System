import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { AppointmentStatus } from '../entities/appointment.entity';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Staff member UUID' })
  @IsUUID()
  staffId: string;

  @ApiProperty({
    type: [String],
    description: 'One or more service UUIDs to book in this appointment',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  serviceIds: string[];

  @ApiProperty({
    example: '2026-05-15',
    description: 'Appointment date (YYYY-MM-DD)',
  })
  @IsDateString()
  appointmentDate: string;

  @ApiProperty({
    example: '10:00',
    description: 'Appointment start time of day (HH:mm)',
  })
  @Matches(TIME_REGEX, { message: 'startTime must be a valid HH:mm time' })
  startTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}

export class GetAvailableSlotsDto {
  @ApiProperty({
    example: '2026-05-15',
    description: 'Date to fetch availability for (YYYY-MM-DD)',
  })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Service UUID' })
  @IsUUID()
  serviceId: string;

  @ApiPropertyOptional({ description: 'Optional staff UUID to filter by' })
  @IsOptional()
  @IsUUID()
  staffId?: string;
}

export class ListAppointmentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ description: 'Filter by staff UUID' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
