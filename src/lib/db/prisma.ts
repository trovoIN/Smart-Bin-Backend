// ============================================
// Smart Bin - Prisma Database Client
// ============================================
// This file creates and exports a singleton Prisma client.
// We use a singleton to prevent multiple database connections
// during development hot-reloads.
// ============================================

import { PrismaClient } from '@prisma/client';

// Extend the global type to include our Prisma client
declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

/**
 * Create Prisma client with logging configuration
 * In development: Log queries, errors, and warnings
 * In production: Log only errors
 */
const prismaClientSingleton = () => {
    return new PrismaClient({
        log:
            process.env.NODE_ENV === 'development'
                ? ['query', 'error', 'warn']
                : ['error'],
    });
};

/**
 * Singleton Prisma client instance
 * In development, we store the client in globalThis to prevent
 * multiple instances during hot-reloads
 */
const prisma = globalThis.prisma ?? prismaClientSingleton();

// In development, save to global to reuse across hot-reloads
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}

export default prisma;

// Export commonly used Prisma types for convenience
export { Prisma } from '@prisma/client';
