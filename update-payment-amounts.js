const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updatePaymentAmounts() {
    try {
        console.log('Updating payment amounts from 100 to 150...');

        const result = await prisma.payment.updateMany({
            where: {
                amount: 100,
                status: {
                    in: ['UNPAID', 'CLAIMED']
                }
            },
            data: {
                amount: 150
            }
        });

        console.log(`✅ Successfully updated ${result.count} payment records from ₹100 to ₹150`);

        // Also show current payments
        const payments = await prisma.payment.findMany({
            where: {
                status: {
                    in: ['UNPAID', 'CLAIMED']
                }
            },
            select: {
                id: true,
                month: true,
                amount: true,
                status: true
            },
            take: 10
        });

        console.log('\nCurrent payments:');
        console.table(payments);

    } catch (error) {
        console.error('❌ Error updating payment amounts:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updatePaymentAmounts();
