import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCollector() {
    try {
        const collector = await prisma.collector.findUnique({
            where: { phone: '9988776655' }
        });

        if (collector) {
            console.log('✅ Collector found:');
            console.log(JSON.stringify(collector, null, 2));
        } else {
            console.log('❌ Collector NOT found with phone: 9988776655');

            // Check all collectors
            const allCollectors = await prisma.collector.findMany();
            console.log('\nAll collectors in database:');
            allCollectors.forEach(c => {
                console.log(`- ID: ${c.id}, Name: ${c.name}, Phone: ${c.phone}`);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkCollector();
