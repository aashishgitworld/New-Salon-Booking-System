import { Entity, Column, Index } from 'typeorm';
import { Expose } from 'class-transformer';
import { BaseEntity } from '../../common/entities/base.entity';

export enum StaffType {
    FULL_TIME = 'full_time',
    CONTRACT = 'contract',
    TRAINEE = 'trainee'
}

@Entity('staffs')
@Index('UQ_STAFF_EMAIL_ACTIVE', ['email'], {
    unique: true,
    where: '"deleted_at" IS NULL',
  })
export class Staff extends BaseEntity {
    @Column({ type: 'varchar', length: 255 })
    email: string;

    @Expose()
    get staffId(): string {
        return this.guid;
    }

    @Column({ name: 'first_name', type: 'varchar', length: 100 })
    firstName: string;

    @Column({ name: 'last_name', type: 'varchar', length: 100 })
    lastName: string;

    @Column({ name: 'middle_name', type: 'varchar', length: 100, nullable: true })
    middleName: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string | null;

    @Column({
        type: 'enum',
        enum: StaffType,
        default: StaffType.FULL_TIME,
    })
    type: StaffType;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    get fullName(): string {
        return `${this.firstName} ${this.middleName ?? ''} ${this.lastName}`.trim();
    }
}
