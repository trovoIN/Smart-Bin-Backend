import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed collection data for all units
 * This creates historical collection records for the past 30 days
 */
async function seedCollections() {
    console.log('🌱 Seeding collection data...');

    try {
        // Get all units with assigned collectors
        const units = await prisma.unit.findMany({
            where: {
                collectorId: { not: null },
            },
            include: {
                collector: true,
            },
        });

        console.log(`Found ${units.length} units with assigned collectors`);

        if (units.length === 0) {
            console.log('⚠️  No units with collectors found. Please assign collectors to units first.');
            return;
        }

        // Generate collections for the past 30 days
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let totalCollections = 0;

        for (const unit of units) {
            console.log(`\nProcessing Unit ${unit.unitNumber}...`);

            // Create collections for the past 30 days
            // Simulate realistic collection pattern: collected 5 days a week, missed on weekends
            for (let i = 0; i < 30; i++) {
                const collectionDate = new Date(today);
                collectionDate.setDate(collectionDate.getDate() - i);

                const dayOfWeek = collectionDate.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6

                // Skip weekends (simulate no collection on weekends)
                if (isWeekend) {
                    continue;
                }

                // Random chance of missing collection (10% chance)
                const isMissed = Math.random() < 0.1;

                if (!isMissed) {
                    // Check if collection already exists for this date
                    const tomorrow = new Date(collectionDate);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    const existingCollection = await prisma.collection.findFirst({
                        where: {
                            unitId: unit.id,
                            collectedAt: {
                                gte: collectionDate,
                                lt: tomorrow,
                            },
                        },
                    });

                    if (!existingCollection) {
                        // Create collection record
                        // Set time to a random hour between 8 AM and 6 PM
                        const hour = Math.floor(Math.random() * 10) + 8; // 8-17
                        const minute = Math.floor(Math.random() * 60);
                        collectionDate.setHours(hour, minute, 0, 0);

                        await prisma.collection.create({
                            data: {
                                unitId: unit.id,
                                collectorId: unit.collectorId!,
                                collectedAt: collectionDate,
                                latitude: unit.latitude || 17.4239 + (Math.random() - 0.5) * 0.01,
                                longitude: unit.longitude || 78.4738 + (Math.random() - 0.5) * 0.01,
                                syncedAt: new Date(),
                            },
                        });

                        totalCollections++;
                        console.log(`  ✓ Created collection for ${collectionDate.toLocaleDateString()}`);
                    }
                }
            }
        }

        console.log(`\n✅ Successfully created ${totalCollections} collection records!`);
        console.log('\n📊 Summary:');
        console.log(`   - Units processed: ${units.length}`);
        console.log(`   - Collections created: ${totalCollections}`);
        console.log(`   - Average collections per unit: ${(totalCollections / units.length).toFixed(1)}`);

    } catch (error) {
        console.error('❌ Error seeding collections:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seed function
seedCollections()
    .then(() => {
        console.log('\n🎉 Collection seeding completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Failed to seed collections:', error);
        process.exit(1);
    });
