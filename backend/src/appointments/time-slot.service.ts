import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import {
  Appointment,
  AppointmentStatus,
} from './entities/appointment.entity';
import { TIME_SLOT_INTERVAL_MINUTES } from '../common/constants';

export interface TimeSlot {
  startTime: string; // HH:mm:ss
  endTime: string; // HH:mm:ss
  available: boolean;
  reason?: 'break' | 'booked' | 'past' | 'closed';
}

/**
 * Responsible for computing available time slots for booking.
 * Encapsulates business rules: business hours, break periods, overlap detection.
 *
 * The appointment entity stores an `appointmentDate` (date) plus `startTime` /
 * `endTime` (time-of-day strings), so all helpers here operate on a date-only
 * value combined with `HH:mm:ss` time strings.
 */
@Injectable()
export class TimeSlotService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly configService: ConfigService,
  ) {}

  /** Convert a `HH:mm(:ss)` time string on a given date into a Date. */
  private combine(dateStr: string, timeStr: string): Date {
    const normalized = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    return new Date(`${dateStr}T${normalized}`);
  }

  /** Format a Date into a `HH:mm:ss` time-of-day string. */
  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 8);
  }

  /** Format a Date into a `YYYY-MM-DD` date string. */
  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Generate all potential time slots for a given date & service duration,
   * marking each as available or not based on break time and existing bookings.
   */
  async getAvailableSlots(
    date: Date,
    durationMinutes: number,
    staffId?: number,
  ): Promise<TimeSlot[]> {
    const openHour = this.configService.getOrThrow<number>('app.salon.openHour');
    const closeHour = this.configService.getOrThrow<number>('app.salon.closeHour');
    const breakStart = this.configService.getOrThrow<number>('app.salon.breakStartHour');
    const breakEnd = this.configService.getOrThrow<number>('app.salon.breakEndHour');

    const dateStr = this.formatDate(date);

    const existingAppointments = await this.appointmentRepository.find({
      where: {
        appointmentDate: dateStr as unknown as Date,
        status: Not(AppointmentStatus.CANCELLED),
        ...(staffId ? { staffId } : {}),
      },
      order: { startTime: 'ASC' },
    });

    const day = new Date(`${dateStr}T00:00:00`);
    const slots: TimeSlot[] = [];
    const now = new Date();

    const openTime = new Date(day);
    openTime.setHours(openHour, 0, 0, 0);
    const closeTime = new Date(day);
    closeTime.setHours(closeHour, 0, 0, 0);

    let cursor = new Date(openTime);
    while (cursor < closeTime) {
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
      if (slotEnd > closeTime) break;

      const slot: TimeSlot = {
        startTime: this.formatTime(cursor),
        endTime: this.formatTime(slotEnd),
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
      } else if (
        this.hasConflict(cursor, slotEnd, dateStr, existingAppointments)
      ) {
        slot.available = false;
        slot.reason = 'booked';
      }

      slots.push(slot);
      cursor = new Date(cursor.getTime() + TIME_SLOT_INTERVAL_MINUTES * 60_000);
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
    dateStr: string,
    existing: Appointment[],
    excludeAppointmentId?: string,
  ): boolean {
    return existing.some((a) => {
      if (excludeAppointmentId && a.guid === excludeAppointmentId) return false;
      const aStart = this.combine(dateStr, a.startTime);
      const aEnd = this.combine(dateStr, a.endTime);
      return start < aEnd && aStart < end;
    });
  }

  /**
   * Validate a proposed slot against ALL business rules.
   * Throws nothing — returns a validation result.
   */
  async validateSlot(
    appointmentDate: string,
    startTime: string,
    durationMinutes: number,
    staffId: number,
    excludeAppointmentId?: string,
  ): Promise<{ valid: boolean; reason?: string; endTime?: string }> {
    const openHour = this.configService.getOrThrow<number>('app.salon.openHour');
    const closeHour = this.configService.getOrThrow<number>('app.salon.closeHour');
    const breakStart = this.configService.getOrThrow<number>('app.salon.breakStartHour');
    const breakEnd = this.configService.getOrThrow<number>('app.salon.breakEndHour');

    const start = this.combine(appointmentDate, startTime);
    if (Number.isNaN(start.getTime())) {
      return { valid: false, reason: 'Invalid appointment date or time' };
    }

    const end = new Date(start.getTime() + durationMinutes * 60_000);

    if (start < new Date()) {
      return { valid: false, reason: 'Cannot book an appointment in the past' };
    }

    const day = new Date(`${appointmentDate}T00:00:00`);
    const openTime = new Date(day);
    openTime.setHours(openHour, 0, 0, 0);
    const closeTime = new Date(day);
    closeTime.setHours(closeHour, 0, 0, 0);

    if (start < openTime || end > closeTime) {
      return {
        valid: false,
        reason: `Appointment must be within salon hours (${openHour}:00 - ${closeHour}:00)`,
      };
    }

    if (this.overlapsBreak(start, end, day, breakStart, breakEnd)) {
      return {
        valid: false,
        reason: `Appointment overlaps with break period (${breakStart}:00 - ${breakEnd}:00)`,
      };
    }

    const existing = await this.appointmentRepository.find({
      where: {
        appointmentDate: appointmentDate as unknown as Date,
        staffId,
        status: Not(AppointmentStatus.CANCELLED),
      },
    });

    if (
      this.hasConflict(start, end, appointmentDate, existing, excludeAppointmentId)
    ) {
      return {
        valid: false,
        reason: 'Time slot conflicts with an existing appointment',
      };
    }

    return { valid: true, endTime: this.formatTime(end) };
  }
}
