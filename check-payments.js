const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPayments() {
    try {
        console.log('Checking all payments...\n');

        const allPayments = await prisma.payment.findMany({
            select: {
                id: true,
                month: true,
                amount: true,
                status: true,
                unit: {
                    select: {
                        unitNumber: true,
                        residentName: true
                    }
                }
            },
            orderBy: {
                id: 'desc'
            },
            take: 20
        });

        console.log(`Total payments found: ${allPayments.length}\n`);
        console.table(allPayments.map(p => ({
            id: p.id,
            unit: p.unit?.unitNumber || 'N/A',
            resident: p.unit?.residentName || 'N/A',
            month: p.month,
            amount: p.amount.toString(),
            status: p.status
        })));

        // Count by amount
        const by100 = allPayments.filter(p => Number(p.amount) === 100).length;
        const by150 = allPayments.filter(p => Number(p.amount) === 150).length;

        console.log(`\n₹100 payments: ${by100}`);
        console.log(`₹150 payments: ${by150}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkPayments();
