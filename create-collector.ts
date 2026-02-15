import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createCollector() {
    try {
        const collector = await prisma.collector.upsert({
            where: { phone: '+919988776655' },
            update: {
                status: 'ACTIVE',
                updatedAt: new Date()
            },
            create: {
                phone: '+919988776655',
                name: 'Ramesh Kumar',
                upiId: 'ramesh@upi',
                status: 'ACTIVE',
            }
        });

        console.log('✅ Collector created/updated successfully:');
        console.log(JSON.stringify(collector, null, 2));
    } catch (error) {
        console.error('❌ Error creating collector:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

createCollector();
