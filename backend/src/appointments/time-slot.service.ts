import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import {
  Appointment,
  AppointmentStatus,
} from './entities/appointment.entity';
import { Service } from '../services/entities/service.entity';
import { TIME_SLOT_INTERVAL_MINUTES } from '../common/constants';

export interface TimeSlot {
  startTime: string; // ISO
  endTime: string; // ISO
  available: boolean;
  reason?: 'break' | 'booked' | 'past' | 'closed';
}

/**
 * Responsible for computing available time slots for booking.
 * Encapsulates business rules: business hours, break periods, overlap detection.
 */
@Injectable()
export class TimeSlotService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate all potential time slots for a given date & service duration,
   * marking each as available or not based on break time and existing bookings.
   */
  async getAvailableSlots(
    date: Date,
    service: Service,
  ): Promise<TimeSlot[]> {
    const openHour = this.configService.getOrThrow<number>('app.salon.openHour');
    const closeHour = this.configService.getOrThrow<number>('app.salon.closeHour');
    const breakStart = this.configService.getOrThrow<number>('app.salon.breakStartHour');
    const breakEnd = this.configService.getOrThrow<number>('app.salon.breakEndHour');

    const day = new Date(date);
    day.setHours(0, 0, 0, 0);

    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    // Fetch same-day active appointments once
    const existingAppointments = await this.appointmentRepository.find({
      where: {
        startTime: MoreThan(day),
        endTime: LessThan(dayEnd),
        status: Not(AppointmentStatus.CANCELLED),
      },
      order: { startTime: 'ASC' },
    });

    const slots: TimeSlot[] = [];
    const now = new Date();

    const openTime = new Date(day);
    openTime.setHours(openHour, 0, 0, 0);
    const closeTime = new Date(day);
    closeTime.setHours(closeHour, 0, 0, 0);

    let cursor = new Date(openTime);
    while (cursor < closeTime) {
      const slotEnd = new Date(
        cursor.getTime() + service.durationMinutes * 60_000,
      );

      if (slotEnd > closeTime) break;

      const slot: TimeSlot = {
        startTime: cursor.toISOString(),
        endTime: slotEnd.toISOString(),
        available: true,
      };

      if (cursor < now) {
        slot.available = false;
        slot.reason = 'past';
      } else if (
        this.overlapsBreak(cursor, slotEnd, day, breakStart, breakEnd)
      ) {
        slot.available = false;
        slot.reason = 'break';
      } else if (this.hasConflict(cursor, slotEnd, existingAppointments)) {
        slot.available = false;
        slot.reason = 'booked';
      }

      slots.push(slot);
      cursor = new Date(
        cursor.getTime() + TIME_SLOT_INTERVAL_MINUTES * 60_000,
      );
    }

    return slots;
  }

  /**
   * Check whether a proposed booking overlaps the daily break period.
   */
  overlapsBreak(
    start: Date,
    end: Date,
    day: Date,
    breakStartHour: number,
    breakEndHour: number,
  ): boolean {
    const breakStart = new Date(day);
    breakStart.setHours(breakStartHour, 0, 0, 0);
    const breakEnd = new Date(day);
    breakEnd.setHours(breakEndHour, 0, 0, 0);
    return start < breakEnd && end > breakStart;
  }

  /**
   * Check whether a proposed slot conflicts with any existing appointment.
   * Two intervals [a1, a2) and [b1, b2) overlap iff a1 < b2 && b1 < a2.
   */
  hasConflict(
    start: Date,
    end: Date,
    existing: Appointment[],
    excludeAppointmentId?: string,
  ): boolean {
    return existing.some((a) => {
      if (excludeAppointmentId && a.id === excludeAppointmentId) return false;
      return start < a.endTime && a.startTime < end;
    });
  }

  /**
   * Validate a proposed slot against ALL business rules.
   * Throws nothing — returns a validation result.
   */
  async validateSlot(
    startTime: Date,
    service: Service,
    excludeAppointmentId?: string,
  ): Promise<{ valid: boolean; reason?: string }> {
    const openHour = this.configService.getOrThrow<number>('app.salon.openHour');
    const closeHour = this.configService.getOrThrow<number>('app.salon.closeHour');
    const breakStart = this.configService.getOrThrow<number>('app.salon.breakStartHour');
    const breakEnd = this.configService.getOrThrow<number>('app.salon.breakEndHour');

    const endTime = new Date(
      startTime.getTime() + service.durationMinutes * 60_000,
    );

    if (startTime < new Date()) {
      return { valid: false, reason: 'Cannot book an appointment in the past' };
    }

    const day = new Date(startTime);
    day.setHours(0, 0, 0, 0);

    const openTime = new Date(day);
    openTime.setHours(openHour, 0, 0, 0);
    const closeTime = new Date(day);
    closeTime.setHours(closeHour, 0, 0, 0);

    if (startTime < openTime || endTime > closeTime) {
      return {
        valid: false,
        reason: `Appointment must be within salon hours (${openHour}:00 - ${closeHour}:00)`,
      };
    }

    if (this.overlapsBreak(startTime, endTime, day, breakStart, breakEnd)) {
      return {
        valid: false,
        reason: `Appointment overlaps with break period (${breakStart}:00 - ${breakEnd}:00)`,
      };
    }

    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await this.appointmentRepository.find({
      where: {
        startTime: MoreThan(day),
        endTime: LessThan(dayEnd),
        status: Not(AppointmentStatus.CANCELLED),
      },
    });

    if (this.hasConflict(startTime, endTime, existing, excludeAppointmentId)) {
      return {
        valid: false,
        reason: 'Time slot conflicts with an existing appointment',
      };
    }

    return { valid: true };
  }
}
