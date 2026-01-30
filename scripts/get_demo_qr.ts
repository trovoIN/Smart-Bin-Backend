import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getDemoQR() {
    try {
        const qr = await prisma.qRCode.findFirst({
            where: { status: 'ACTIVE' },
            include: { unit: true }
        });

        if (qr) {
            console.log('\n================================');
            console.log('✅ VALID QR TOKEN FOR DEMO:');
            console.log(qr.secureToken);
            console.log(`🏠 Linked Unit: ${qr.unit?.unitNumber}`);
            console.log('================================\n');
        } else {
            console.log('No active QR codes found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

getDemoQR();
