import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateCollectorPhone() {
    try {
        const updated = await prisma.collector.update({
            where: { phone: '9988776655' },
            data: { phone: '+919988776655' }
        });
        console.log('✅ Collector phone updated successfully:');
        console.log(JSON.stringify(updated, null, 2));
    } catch (error) {
        console.error('❌ Error updating collector:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateCollectorPhone();
