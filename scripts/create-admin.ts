import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createAdminUser() {
    try {
        const user = await prisma.user.create({
            data: {
                name: 'Admin User',
                phone: '+919876543210',
                role: 'GOVT',
                isActive: true,
            },
        });
        console.log('✅ Admin user created:', user);
    } catch (error) {
        console.error('Error creating user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdminUser();
