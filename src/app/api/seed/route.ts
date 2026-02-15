// Complete database reset and seed fresh demo data
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { hashPassword } from '@/lib/security';

export async function POST() {
    try {
        // Only allow in development
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
        }

        console.log('🔄 Starting FULL database reset...');

        // Delete ALL data in correct order (respecting foreign keys)
        console.log('🗑️ Deleting all collections...');
        await prisma.collection.deleteMany({});

        console.log('🗑️ Deleting all payments...');
        await prisma.payment.deleteMany({});

        console.log('🗑️ Deleting all complaints...');
        await prisma.complaint.deleteMany({});

        console.log('🗑️ Deleting all OTP records...');
        await prisma.oTP.deleteMany({});

        console.log('🗑️ Deleting all audit logs...');
        await prisma.auditLog.deleteMany({});

        console.log('🗑️ Deleting all units...');
        await prisma.unit.deleteMany({});

        console.log('🗑️ Deleting all QR codes...');
        await prisma.qRCode.deleteMany({});

        console.log('🗑️ Deleting all collectors...');
        await prisma.collector.deleteMany({});

        console.log('🗑️ Deleting all users...');
        await prisma.user.deleteMany({});

        console.log('✅ All data deleted!');

        // Create fresh credentials
        const results = {
            admins: [] as any[],
            collectors: [] as any[],
        };

        // Create GOVT Admin User
        console.log('👤 Creating GOVT Admin...');
        const adminPassword = await hashPassword('admin@123');
        const admin = await prisma.user.create({
            data: {
                name: 'GHMC Admin',
                phone: '+919876543210',
                email: 'admin@ghmc.gov.in',
                role: 'GOVT',
                passwordHash: adminPassword,
                isActive: true,
            },
        });
        results.admins.push({
            name: admin.name,
            phone: '9876543210',
            role: 'GOVT (Full Access)',
            otp: '123456'
        });

        // Create Supervisor User
        console.log('👤 Creating Supervisor...');
        const supervisorPassword = await hashPassword('super@123');
        const supervisor = await prisma.user.create({
            data: {
                name: 'Ward Supervisor',
                phone: '+919876543211',
                email: 'supervisor@ghmc.gov.in',
                role: 'SUPERVISOR',
                passwordHash: supervisorPassword,
                isActive: true,
                assignedWard: 'Ward 1',
            },
        });
        results.admins.push({
            name: supervisor.name,
            phone: '9876543211',
            role: 'SUPERVISOR (Limited)',
            otp: '123456'
        });

        // Create Collector 1
        console.log('🚛 Creating Collector 1...');
        const collector1 = await prisma.collector.create({
            data: {
                name: 'Ramesh Kumar',
                phone: '+919988776655',
                upiId: 'ramesh@upi',
                assignedRoute: 'Secunderabad Zone A',
                status: 'ACTIVE',
            },
        });
        results.collectors.push({
            name: collector1.name,
            phone: '9988776655',
            route: collector1.assignedRoute,
            otp: '123456'
        });

        // Create Collector 2
        console.log('🚛 Creating Collector 2...');
        const collector2 = await prisma.collector.create({
            data: {
                name: 'Suresh Babu',
                phone: '+919988776644',
                upiId: 'suresh@upi',
                assignedRoute: 'Secunderabad Zone B',
                status: 'ACTIVE',
            },
        });
        results.collectors.push({
            name: collector2.name,
            phone: '9988776644',
            route: collector2.assignedRoute,
            otp: '123456'
        });

        console.log('✅ All credentials created!');

        return NextResponse.json({
            success: true,
            message: '🎉 Database reset complete! Fresh credentials created.',
            credentials: {
                note: 'Use OTP: 123456 for all logins',
                admins: results.admins,
                collectors: results.collectors,
            }
        });
    } catch (error) {
        console.error('❌ Seed error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Seed failed',
        }, { status: 500 });
    }
}
