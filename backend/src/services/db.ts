import { PrismaClient } from '@prisma/client';

/**
 * Database connection utility.
 *
 * Exposes a single shared PrismaClient plus connect/disconnect helpers.
 * The instance is cached on `globalThis` so that hot-reload / `tsx watch`
 * restarts reuse one client instead of exhausting the connection pool.
 */

// BigInt (our `time` columns are unix-ms BigInt) is not serializable by
// JSON.stringify out of the box. Teach it to emit a Number so Express
// `res.json(...)` works on tick rows without manual mapping everywhere.
// (Safe: unix-ms stays well within Number.MAX_SAFE_INTEGER until year 287396.)
declare global {
    interface BigInt {
        toJSON(): number;
    }
}

if (typeof BigInt.prototype.toJSON !== 'function') {
    BigInt.prototype.toJSON = function toJSON(this: bigint): number {
        return Number(this);
    };
}

const globalForPrisma = globalThis as typeof globalThis & {
    __dsePrisma?: PrismaClient;
};

export const prisma: PrismaClient =
    globalForPrisma.__dsePrisma ??
    new PrismaClient({
        log:
            process.env.NODE_ENV === 'production'
                ? ['error']
                : ['warn', 'error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__dsePrisma = prisma;
}

/** Verify connectivity at startup; throws if the database is unreachable. */
export async function connectDb(): Promise<void> {
    await prisma.$connect();
    console.log('[db] connected');
}

/** Close the pool on graceful shutdown. */
export async function disconnectDb(): Promise<void> {
    await prisma.$disconnect();
    console.log('[db] disconnected');
}
