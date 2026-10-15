import { Prisma } from '@prisma/client';
export function audit(tx: Prisma.TransactionClient, actorId: string, action: string, targetId: string, reason: string, before?: unknown, after?: unknown) {
  const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value ?? {}));
  return tx.adminAudit.create({ data: { actorId, action, targetId, reason, before: json(before), after: json(after) } });
}
