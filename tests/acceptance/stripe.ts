// Deterministic provider double. Used only by the local acceptance harness.
const refunds = new Map<string, any>();
export default class Stripe {
  paymentIntents = {
    list: async () => ({ data: [{ id: 'pi_acceptance', amount: 32000, currency: 'usd', status: 'succeeded', created: Math.floor(Date.now() / 1000) }], has_more: false }),
    retrieve: async () => ({ id: 'pi_acceptance', transfer_data: null }),
    create: async () => ({ client_secret: 'acceptance_no_real_payment' }),
  };
  refunds = {
    list: () => ({ async *[Symbol.asyncIterator]() { for (const refund of refunds.values()) yield refund; } }),
    retrieve: async (id: string) => refunds.get(id),
    create: async (data: any) => { const result = { id: `re_${data.metadata.orderId}`, status: 'succeeded', ...data }; refunds.set(result.id, result); return result; },
  };
}
