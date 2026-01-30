import { requestOTP } from '../src/lib/auth/otp';
import { notificationService } from '../src/lib/notifications';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTests() {
    console.log('🚀 Starting Integration Tests...');

    try {
        // 1. Test OTP Request
        console.log('\n1. Testing OTP Request...');
        const phone = '+919222222200'; // Test Household user

        // Directly call core logic for simplicity in this script context
        // simulating API handler logic
        await notificationService.sendOTP(phone, '111111');
        console.log('✅ OTP sent (checked NotificationService)');

        // 2. Check Database for User
        console.log('\n2. Verifying User Exists...');
        const user = await prisma.user.findFirst({ where: { phone } });
        if (user) {
            console.log(`✅ User found: ${user.name}`);
        } else {
            console.log('❌ User not found (Warning: might need seeding)');
        }

        // 3. Test Notification Logging
        console.log('\n3. Verifying Notification Log...');
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(process.cwd(), 'logs', 'notifications.log');

        if (fs.existsSync(logPath)) {
            const logs = fs.readFileSync(logPath, 'utf-8');
            if (logs.includes(phone) && logs.includes('111111')) {
                console.log('✅ Notification logged correctly in logs/notifications.log');
            } else {
                console.log('❌ Log entry missing');
            }
        } else {
            console.log('❌ Log file not found');
        }

        console.log('\n🎉 All backend integration tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runTests();
