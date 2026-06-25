import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@animestream.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: adminEmail }, { username: 'admin' }] },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: adminEmail,
        username: 'admin',
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Updated admin user: ${adminEmail}`);
    return;
  }

  await prisma.user.create({
    data: {
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
