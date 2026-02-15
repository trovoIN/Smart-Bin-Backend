const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAllPayments() {
    try {
        console.log('Updating ALL payment amounts from 100 to 150 (including verified)...\n');

        const result = await prisma.payment.updateMany({
            where: {
                amount: 100
            },
            data: {
                amount: 150
            }
        });

        console.log(`✅ Successfully updated ${result.count} payment records from ₹100 to ₹150\n`);

        // Verify the update
        const updatedPayments = await prisma.payment.findMany({
            select: {
                id: true,
                month: true,
                amount: true,
                status: true,
                unit: {
                    select: {
                        unitNumber: true
                    }
                }
            },
            orderBy: {
                id: 'desc'
            }
        });

        console.log('Updated payments:');
        console.table(updatedPayments.map(p => ({
            id: p.id,
            unit: p.unit?.unitNumber || 'N/A',
            month: p.month,
            amount: p.amount.toString(),
            status: p.status
        })));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateAllPayments();
