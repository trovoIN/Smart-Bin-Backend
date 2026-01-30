import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Generate a random seed token
const generateToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = 'SQR'; // Prefix
    for (let i = 0; i < 16; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
};

async function createNewQR() {
    try {
        const token = generateToken();
        const qr = await prisma.qRCode.create({
            data: {
                secureToken: token,
                status: 'UNASSIGNED',
            }
        });

        console.log('\n================================');
        console.log('✨ NEW UNASSIGNED QR CODE GENERATED:');
        console.log(qr.secureToken);
        console.log('Use this to demo "New Unit Registration" if needed.');
        console.log('================================\n');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

createNewQR();
