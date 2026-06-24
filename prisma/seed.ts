import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@animestream.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: 'admin',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded admin user: ${adminEmail}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
