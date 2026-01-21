// ============================================
// Smart Bin - Database Seed Script
// ============================================
// This script creates test data for development
// Run: npx prisma db seed
// ============================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...\n');

    // ============================================
    // 1. Create Admin User
    // ============================================
    console.log('Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 12);

    const admin = await prisma.user.upsert({
        where: { phone: '+919000000000' },
        update: {},
        create: {
            name: 'Super Admin',
            phone: '+919000000000',
            email: 'admin@smartbin.com',
            role: 'ADMIN',
            passwordHash: adminPassword,
            isActive: true,
        },
    });
    console.log(`  ✅ Admin: ${admin.name} (${admin.phone})`);

    // ============================================
    // 2. Create Supervisor
    // ============================================
    console.log('Creating supervisor...');
    const supervisor = await prisma.user.upsert({
        where: { phone: '+919000000001' },
        update: {},
        create: {
            name: 'Ward 5 Supervisor',
            phone: '+919000000001',
            email: 'supervisor@smartbin.com',
            role: 'SUPERVISOR',
            assignedWard: 'Ward 5',
            isActive: true,
        },
    });
    console.log(`  ✅ Supervisor: ${supervisor.name} (${supervisor.phone})`);

    // ============================================
    // 3. Create Collectors
    // ============================================
    console.log('Creating collectors...');
    const collectors = await Promise.all([
        prisma.collector.upsert({
            where: { phone: '+919111111111' },
            update: {},
            create: {
                name: 'Ramesh Kumar',
                phone: '+919111111111',
                upiId: 'ramesh@upi',
                assignedRoute: 'Ward 5 - Area A',
                status: 'ACTIVE',
            },
        }),
        prisma.collector.upsert({
            where: { phone: '+919111111112' },
            update: {},
            create: {
                name: 'Suresh Patel',
                phone: '+919111111112',
                upiId: 'suresh@upi',
                assignedRoute: 'Ward 5 - Area B',
                status: 'ACTIVE',
            },
        }),
    ]);
    collectors.forEach(c => console.log(`  ✅ Collector: ${c.name} (${c.phone})`));

    // ============================================
    // 4. Create QR Codes
    // ============================================
    console.log('Creating QR codes...');
    const qrCodes = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
            prisma.qRCode.upsert({
                where: { secureToken: `SEED_QR_${String(i + 1).padStart(3, '0')}` },
                update: {},
                create: {
                    secureToken: `SEED_QR_${String(i + 1).padStart(3, '0')}`,
                    status: i < 5 ? 'ACTIVE' : 'UNASSIGNED', // First 5 active
                    activatedAt: i < 5 ? new Date() : null,
                },
            })
        )
    );
    console.log(`  ✅ Created ${qrCodes.length} QR codes (5 active, 5 unassigned)`);

    // ============================================
    // 5. Create Units (linked to active QRs)
    // ============================================
    console.log('Creating units...');
    const units = [];
    for (let i = 0; i < 5; i++) {
        const unit = await prisma.unit.upsert({
            where: { qrId: qrCodes[i].id },
            update: {},
            create: {
                unitNumber: `H-${100 + i}`,
                householdPhone: `+91922222220${i}`,
                ward: 'Ward 5',
                qrId: qrCodes[i].id,
                collectorId: collectors[i % 2].id, // Alternate between collectors
            },
        });
        units.push(unit);
        console.log(`  ✅ Unit: ${unit.unitNumber} → Collector ${collectors[i % 2].name}`);
    }

    // ============================================
    // 6. Create sample collections (last 7 days)
    // ============================================
    console.log('Creating sample collections...');
    const today = new Date();
    let collectionCount = 0;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const collectionDate = new Date(today);
        collectionDate.setDate(collectionDate.getDate() - dayOffset);
        collectionDate.setHours(8 + dayOffset % 3, 0, 0, 0); // Random morning time

        for (const unit of units) {
            // Randomly skip some collections (30% miss rate)
            if (Math.random() > 0.7) continue;

            try {
                await prisma.collection.create({
                    data: {
                        unitId: unit.id,
                        collectorId: unit.collectorId,
                        collectedAt: collectionDate,
                        latitude: 17.4239 + (Math.random() * 0.01),
                        longitude: 78.4738 + (Math.random() * 0.01),
                        syncedAt: collectionDate,
                    },
                });
                collectionCount++;
            } catch {
                // Ignore duplicate collection errors
            }
        }
    }
    console.log(`  ✅ Created ${collectionCount} collection records`);

    // ============================================
    // 7. Create current month payments
    // ============================================
    console.log('Creating payment records...');
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const paymentStatuses = ['UNPAID', 'CLAIMED', 'VERIFIED', 'DISPUTED', 'VERIFIED'];

    for (let i = 0; i < units.length; i++) {
        await prisma.payment.upsert({
            where: {
                unitId_month: {
                    unitId: units[i].id,
                    month: currentMonth,
                },
            },
            update: {},
            create: {
                unitId: units[i].id,
                month: currentMonth,
                amount: 100,
                status: paymentStatuses[i] as any,
                ...(paymentStatuses[i] === 'CLAIMED' && { claimedAt: new Date() }),
                ...(paymentStatuses[i] === 'VERIFIED' && {
                    claimedAt: new Date(),
                    verifiedAt: new Date(),
                    verifiedById: collectors[0].id,
                }),
                ...(paymentStatuses[i] === 'DISPUTED' && {
                    claimedAt: new Date(),
                    disputedAt: new Date(),
                    rejectionReason: 'Payment not received in UPI',
                }),
            },
        });
    }
    console.log(`  ✅ Created ${units.length} payment records for ${currentMonth}`);

    // ============================================
    // 8. Create sample complaints
    // ============================================
    console.log('Creating sample complaints...');

    await prisma.complaint.create({
        data: {
            unitId: units[0].id,
            complaintType: 'GARBAGE_NOT_COLLECTED',
            raisedBy: 'HOUSEHOLD',
            description: 'Garbage was not collected yesterday',
            status: 'OPEN',
        },
    });

    await prisma.complaint.create({
        data: {
            unitId: units[1].id,
            collectorId: collectors[0].id,
            complaintType: 'NON_PAYMENT',
            raisedBy: 'COLLECTOR',
            description: 'Household has not paid for 2 months',
            status: 'IN_REVIEW',
        },
    });

    console.log(`  ✅ Created 2 sample complaints`);

    // ============================================
    // Summary
    // ============================================
    console.log('\n✨ Seed completed successfully!\n');
    console.log('Test accounts:');
    console.log('  Admin:      +919000000000 (password: admin123)');
    console.log('  Supervisor: +919000000001 (OTP login)');
    console.log('  Collector:  +919111111111 (OTP login)');
    console.log('  Household:  +919222222200 (OTP login)');
    console.log('\nNote: In development, OTP is logged to console.');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
