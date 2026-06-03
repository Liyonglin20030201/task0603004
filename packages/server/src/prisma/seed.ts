import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@study-platform.com' },
    update: {},
    create: {
      email: 'admin@study-platform.com',
      passwordHash: adminPassword,
      nickname: '管理员',
      role: 'admin',
    },
  });

  // Create demo user
  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@study-platform.com' },
    update: {},
    create: {
      email: 'demo@study-platform.com',
      passwordHash: userPassword,
      nickname: '演示用户',
      role: 'user',
    },
  });

  // Create demo courses
  const mathCourse = await prisma.course.create({
    data: {
      userId: user.id,
      title: '高等数学',
      category: '数学',
      description: '微积分、线性代数基础',
    },
  });

  const engCourse = await prisma.course.create({
    data: {
      userId: user.id,
      title: '大学英语四级',
      category: '英语',
      description: 'CET-4 备考',
    },
  });

  // Create demo plan
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);

  await prisma.learningPlan.create({
    data: {
      userId: user.id,
      courseId: mathCourse.id,
      title: '第一章 极限与连续',
      startDate: today,
      endDate: endDate,
      originalEndDate: endDate,
      items: {
        create: Array.from({ length: 7 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() + i);
          return {
            title: `第${i + 1}节 学习任务`,
            scheduledDate: date,
            originalDate: date,
            sortOrder: i,
          };
        }),
      },
    },
  });

  console.log('Seed data created:');
  console.log(`  Admin: admin@study-platform.com / admin123`);
  console.log(`  User:  demo@study-platform.com / user123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
