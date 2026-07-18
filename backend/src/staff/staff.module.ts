import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Staff } from './entities/staff.entity';
import { StaffService } from './entities/staff_service.entity';
import { StaffsService } from './staff.service';
import { StaffController } from './staff.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Staff, StaffService])],
  controllers: [StaffController],
  providers: [StaffsService],
  exports: [StaffsService],
})
export class StaffModule {}
