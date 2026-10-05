export const stripe = {
  paymentIntents: { create: jest.fn(), retrieve: jest.fn(), list: jest.fn() },
  refunds: { create: jest.fn(), retrieve: jest.fn(), list: jest.fn(() => ({ async *[Symbol.asyncIterator]() {} })) },
  webhooks: { constructEvent: jest.fn() },
};
export default jest.fn(() => stripe);
