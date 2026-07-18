import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { AppointmentService } from './entities/appointment_service.entity';
import { Payment } from './entities/payment.entity';
import { Staff } from '../staff/entities/staff.entity';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { TimeSlotService } from './time-slot.service';
import { AppointmentsGateway } from './appointments.gateway';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, AppointmentService, Payment, Staff]),
    ServicesModule,
  ],
  controllers: [AppointmentsController, PaymentsController],
  providers: [
    AppointmentsService,
    PaymentsService,
    TimeSlotService,
    AppointmentsGateway,
  ],
  exports: [AppointmentsService, PaymentsService, TimeSlotService],
})
export class AppointmentsModule {}
