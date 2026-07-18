import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlotService } from './time-slot.service';
import {
  Appointment,
  AppointmentStatus,
} from './entities/appointment.entity';
import { Service, ServiceCategory } from '../services/entities/service.entity';

describe('TimeSlotService', () => {
  let service: TimeSlotService;
  let repo: jest.Mocked<Repository<Appointment>>;

  const configMap: Record<string, any> = {
    'app.salon.openHour': 9,
    'app.salon.closeHour': 18,
    'app.salon.breakStartHour': 12,
    'app.salon.breakEndHour': 14,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeSlotService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => configMap[k],
            getOrThrow: (k: string) => {
              if (!(k in configMap)) throw new Error(`Missing config: ${k}`);
              return configMap[k];
            },
          },
        },
      ],
    }).compile();

    service = module.get<TimeSlotService>(TimeSlotService);
    repo = module.get(getRepositoryToken(Appointment));
  });

  const makeService = (minutes: number): Service =>
    ({
      id: 's1',
      name: 'Haircut',
      durationMinutes: minutes,
      category: ServiceCategory.HAIR,
      price: 25,
      isActive: true,
    }) as Service;

  describe('overlapsBreak', () => {
    it('returns true when slot sits fully inside the break', () => {
      const day = new Date('2030-06-01T00:00:00Z');
      const start = new Date('2030-06-01T12:30:00Z');
      const end = new Date('2030-06-01T13:00:00Z');
      expect(service.overlapsBreak(start, end, day, 12, 14)).toBe(true);
    });

    it('returns true when slot end bleeds into the break', () => {
      const day = new Date('2030-06-01T00:00:00Z');
      const start = new Date('2030-06-01T11:30:00Z');
      const end = new Date('2030-06-01T12:15:00Z');
      expect(service.overlapsBreak(start, end, day, 12, 14)).toBe(true);
    });

    it('returns false when slot ends exactly at break start', () => {
      const day = new Date('2030-06-01T00:00:00Z');
      const start = new Date('2030-06-01T11:00:00Z');
      const end = new Date('2030-06-01T12:00:00Z');
      expect(service.overlapsBreak(start, end, day, 12, 14)).toBe(false);
    });

    it('returns false when slot starts exactly at break end', () => {
      const day = new Date('2030-06-01T00:00:00Z');
      const start = new Date('2030-06-01T14:00:00Z');
      const end = new Date('2030-06-01T15:00:00Z');
      expect(service.overlapsBreak(start, end, day, 12, 14)).toBe(false);
    });
  });

  describe('hasConflict', () => {
    const existing: Appointment[] = [
      {
        id: 'a1',
        startTime: new Date('2030-06-01T10:00:00Z'),
        endTime: new Date('2030-06-01T10:30:00Z'),
      } as Appointment,
    ];

    it('detects a direct overlap', () => {
      const start = new Date('2030-06-01T10:15:00Z');
      const end = new Date('2030-06-01T10:45:00Z');
      expect(service.hasConflict(start, end, existing)).toBe(true);
    });

    it('allows a back-to-back slot', () => {
      const start = new Date('2030-06-01T10:30:00Z');
      const end = new Date('2030-06-01T11:00:00Z');
      expect(service.hasConflict(start, end, existing)).toBe(false);
    });

    it('excludes the appointment being rescheduled', () => {
      const start = new Date('2030-06-01T10:15:00Z');
      const end = new Date('2030-06-01T10:45:00Z');
      expect(service.hasConflict(start, end, existing, 'a1')).toBe(false);
    });
  });

  describe('validateSlot', () => {
    it('rejects appointments in the past', async () => {
      const result = await service.validateSlot(
        new Date('2020-01-01T10:00:00Z'),
        makeService(30),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('past');
    });

    it('rejects appointments before opening hours', async () => {
      const day = new Date();
      day.setFullYear(day.getFullYear() + 1);
      day.setHours(8, 0, 0, 0); // before 9am open
      const result = await service.validateSlot(day, makeService(30));
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('salon hours');
    });

    it('rejects appointments that cross the break', async () => {
      const day = new Date();
      day.setFullYear(day.getFullYear() + 1);
      day.setHours(11, 45, 0, 0); // 11:45 + 30min = 12:15, crosses 12pm
      const result = await service.validateSlot(day, makeService(30));
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('break');
    });

    it('accepts a valid morning slot', async () => {
      const day = new Date();
      day.setFullYear(day.getFullYear() + 1);
      day.setHours(10, 0, 0, 0);
      const result = await service.validateSlot(day, makeService(30));
      expect(result.valid).toBe(true);
    });

    it('rejects slots that conflict with existing appointments', async () => {
      const day = new Date();
      day.setFullYear(day.getFullYear() + 1);
      day.setHours(10, 0, 0, 0);

      const conflicting = {
        id: 'existing',
        startTime: new Date(day.getTime()),
        endTime: new Date(day.getTime() + 45 * 60_000),
        status: AppointmentStatus.CONFIRMED,
      } as Appointment;

      repo.find.mockResolvedValueOnce([conflicting]);

      const result = await service.validateSlot(
        new Date(day.getTime() + 10 * 60_000),
        makeService(30),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('conflicts');
    });
  });
});
