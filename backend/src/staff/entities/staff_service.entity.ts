import {
    Entity,
    ManyToOne,
    JoinColumn,
    Column,
    Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { Service } from '../../services/entities/service.entity';

@Entity('staff_services')
@Index('UQ_STAFF_SERVICE', ['staffId', 'serviceId'], { unique: true })
export class StaffService extends BaseEntity {
    @Column({ name: 'staff_id', type: 'int' })
    staffId: number;

    @ManyToOne(() => Staff, {
        onDelete: 'CASCADE',
        eager: true
    })
    @JoinColumn({ name: 'staff_id' })
    staff: Staff;

    @Column({ name: 'service_id', type: 'int' })
    serviceId: number;

    @ManyToOne(() => Service, {
        onDelete: 'CASCADE',
        eager: true
    })
    @JoinColumn({ name: 'service_id' })
    service: Service;
}