import { Prisma } from '@prisma/client';
import prisma from '@packages/libs/prisma';

/** Retry only database serialization conflicts. Never repeat external side effects here. */
export async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>, options?: { timeout?: number }): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, options); }
    catch (error: any) {
      if (error?.code !== 'P2034' || attempt >= 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}
