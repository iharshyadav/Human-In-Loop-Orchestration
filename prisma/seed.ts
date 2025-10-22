import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding users...');

  const users = [
    {
      email: 'admin@company.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      department: 'operations',
      permissions: ['approve_all', 'view_workflows', 'create_workflows', 'manage_users'],
    },
    {
      email: 'finance@company.com',
      username: 'finance_manager',
      firstName: 'Finance',
      lastName: 'Manager',
      role: 'finance_manager',
      department: 'finance',
      permissions: ['approve_purchase', 'view_workflows', 'approve_budget'],
    },
    {
      email: 'john.doe@company.com',
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      role: 'approver',
      department: 'it',
      permissions: ['approve_purchase', 'view_workflows'],
    },
    {
      email: 'jane.smith@company.com',
      username: 'janesmith',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'user',
      department: 'hr',
      permissions: ['view_workflows'],
    },
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: userData,
      create: userData,
    });
    console.log(`Created/Updated user: ${user.email} (${user.role})`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });