
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const phone = '+919444444440';

    console.log(`Seeding Demo Collector: ${phone}`);

    // Check if exists
    const existing = await prisma.collector.findUnique({
        where: { phone }
    });

    if (existing) {
        console.log('Collector already exists. Deleting to reset...');
        await prisma.collector.delete({ where: { phone } });
    }

    // Create new collector with incomplete profile (no name)
    const collector = await prisma.collector.create({
        data: {
            phone,
            name: '', // Empty name triggers onboarding
            upiId: '',
            status: 'ACTIVE',
            assignedRoute: 'Demo Route'
        }
    });

    console.log(`✅ Created Demo Collector: ID ${collector.id}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
