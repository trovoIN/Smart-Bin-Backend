
import { PrismaClient } from '@prisma/client';
import { registerUnitWithLocation, registerUnit } from './src/services/unit.service';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Demo Verification...\n');

    let createdUnitId: number | null = null;
    let createdQrToken: string | null = null;
    let createdCollectorId: number | null = null;

    try {
        // ==========================================
        // 1. HOUSEHOLD SELF-REGISTRATION
        // ==========================================
        console.log('1. Testing Household Self-Registration...');

        const uniqueNum = Math.floor(Math.random() * 100000);
        // Add random offset to location to avoid collisions
        const randomLat = 12.9716 + (Math.random() * 0.01);
        const randomLng = 77.5946 + (Math.random() * 0.01);

        const householdData = {
            unitNumber: `DEMO-${uniqueNum}`,
            householdPhone: `99999${uniqueNum}`,
            residentName: 'Test Resident',
            latitude: randomLat,
            longitude: randomLng
        };

        const { unit, qrToken } = await registerUnitWithLocation(householdData);

        createdUnitId = unit.id;
        createdQrToken = qrToken;

        console.log(`   -> Registered Unit ID: ${unit.id}`);
        console.log(`   -> QR Token: ${qrToken}`);

        // Check if residentName exists on the unit object
        const residentName = (unit as any).residentName;
        console.log(`   -> Resident Name: ${residentName}`);

        if (residentName !== 'Test Resident') throw new Error(`Resident Name mismatched! Got: ${residentName}`);
        if (unit.collectorId !== null) throw new Error('New unit should be unassigned!');

        console.log('   ✅ Registration Verified\n');

        // ==========================================
        // 2. COLLECTOR PROFILE UPDATE
        // ==========================================
        console.log('2. Testing Collector Profile Update...');

        // Create a dummy collector
        const collectorPhone = `88888${uniqueNum}`;
        const collector = await prisma.collector.create({
            data: {
                name: 'Old Name',
                phone: collectorPhone,
                upiId: 'old@upi',
                status: 'ACTIVE'
            }
        });
        createdCollectorId = collector.id;

        // Update Logic (Simulating PUT /profile)
        const updates = {
            name: 'Updated Collector Name',
            upiId: 'new@upi',
            assignedRoute: 'Van-101'
        };

        const updatedCollector = await prisma.collector.update({
            where: { id: collector.id },
            data: updates
        });

        console.log(`   -> Original Name: Old Name, New Name: ${updatedCollector.name}`);
        console.log(`   -> Original UPI: old@upi, New UPI: ${updatedCollector.upiId}`);

        if (updatedCollector.name !== 'Updated Collector Name') throw new Error('Name update failed');
        if (updatedCollector.upiId !== 'new@upi') throw new Error('UPI update failed');

        console.log('   ✅ Profile Update Verified\n');

        // ==========================================
        // 3. COLLECTOR TAKE UP
        // ==========================================
        console.log('3. Testing Collector "Take Up"...');

        const takenUnit = await registerUnit(collector.id, {
            qrToken: qrToken,
            unitNumber: unit.unitNumber, // Should be ignored or matched
            householdPhone: unit.householdPhone
        });

        console.log(`   -> Unit ${takenUnit.id} Collector ID: ${takenUnit.collectorId}`);

        if (takenUnit.collectorId !== collector.id) throw new Error('Take Up Failed: Collector ID mismatch');

        console.log('   ✅ Take Up Verified\n');

        console.log('🎉 ALL DEMO FEATURES VERIFIED SUCCESSFULLY!');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exitCode = 1;
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        if (createdUnitId) {
            try { await prisma.unit.delete({ where: { id: createdUnitId } }); } catch (e) { console.error('Cleanup Unit failed', e); }
        }
        if (createdQrToken) {
            try { await prisma.qRCode.delete({ where: { secureToken: createdQrToken } }); } catch (e) { console.error('Cleanup QR failed', e); }
        }
        if (createdCollectorId) {
            try { await prisma.collector.delete({ where: { id: createdCollectorId } }); } catch (e) { console.error('Cleanup Collector failed', e); }
        }
        await prisma.$disconnect();
    }
}

main();
