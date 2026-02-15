// ============================================
// Smart Bin - Prisma Client (Prisma 6)
// ============================================
// This file creates a singleton instance of Prisma Client
// to be used throughout the application.
//
// SINGLETON PATTERN:
// In development, Next.js hot-reloads on file changes.
// Without a singleton, this would create many database
// connections. We store the instance in globalThis to
// preserve it across hot-reloads.
// ============================================

import { PrismaClient } from '@prisma/client';

// Type declaration for global prisma instance
declare global {
    var prisma: PrismaClient | undefined;
}

/**
 * Create a Prisma client instance
 * In development, log queries for debugging
 */
const prisma =
    globalThis.prisma ??
    new PrismaClient({
        log:
            process.env.NODE_ENV === 'development'
                ? ['query', 'error', 'warn']
                : ['error'],
    });

// Store in globalThis in development to prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}

export default prisma;
