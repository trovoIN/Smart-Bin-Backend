import prisma from './src/lib/db/prisma';

// Update all existing payments with amount 100 to 150
async function updatePaymentAmounts() {
    try {
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

        console.log(`Updated ${result.count} payment records from ₹100 to ₹150`);
    } catch (error) {
        console.error('Error updating payment amounts:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updatePaymentAmounts();
