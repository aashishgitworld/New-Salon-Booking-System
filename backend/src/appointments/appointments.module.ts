import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { TimeSlotService } from './time-slot.service';
import { AppointmentsGateway } from './appointments.gateway';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment]), ServicesModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, TimeSlotService, AppointmentsGateway],
  exports: [AppointmentsService, TimeSlotService],
})
export class AppointmentsModule {}
