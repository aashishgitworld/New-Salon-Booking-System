import * as dotenv from 'dotenv';
import {hash} from 'bcryptjs';
import dataSource from '../../config/data-source';
import { User, UserRole } from '../../users/entities/user.entity';

dotenv.config();

async function seedAdmin() {
  const repo = dataSource.getRepository(User);
  const adminEmail = 'admin@salon.local';
  const existing = await repo.findOne({ where: { email: adminEmail } });

  if (existing) {
    console.log(`  - Admin exists: ${adminEmail}`);
    return;
  }

  const password = await hash('Admin@123', 12);
  await repo.save(
    repo.create({
      email: adminEmail,
      firstName: 'Salon',
      lastName: 'Admin',
      password,
      role: UserRole.ADMIN,
      isEmailVerified: true,
      isActive: true,
    }),
  );
  console.log(`  ✓ Admin seeded: ${adminEmail} / Admin@123`);
}

async function run() {
  console.log('🌱 Seeding database...');
  await dataSource.initialize();
  console.log('\nAdmin user:');
  await seedAdmin();
  await dataSource.destroy();
  console.log('\n✅ Seeding complete.');
}

run().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
