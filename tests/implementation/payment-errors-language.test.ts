import { paymentErrorMessage } from '@packages/utils/payment-error';
import { translateStorefront as t } from '@packages/utils/storefront-messages';

test('payment messages use stable codes and do not leak provider integration details', () => {
  const message = paymentErrorMessage({ code: 'card_declined', decline_code: 'insufficient_funds', message: 'raw card detail' });
  expect(message).toContain('insufficient funds');
  expect(t(message, 'vi')).toContain('không đủ số dư');
  const unknown = paymentErrorMessage({ message: 'secret abc', code: 'unknown' }, 'load');
  expect(unknown).not.toContain('secret');
  expect(t(unknown, 'vi')).toContain('Không tải được');
  expect(paymentErrorMessage({ code: 'toString' })).toContain('history');
});

test('dynamic compatibility and stock messages retain exact product and hardware values', () => {
  expect(t('Ryzen 7 9700X is out of stock', 'vi')).toBe('Ryzen 7 9700X đã hết hàng.');
  expect(t('CPU / motherboard socket mismatch: AM5 / LGA1700.', 'vi')).toContain('AM5 / LGA1700');
  expect(t('GPU recommends at least 750 W; selected PSU is 550 W.', 'vi')).toBe('GPU đề xuất nguồn tối thiểu 750 W; nguồn đã chọn là 550 W.');
  expect(t('Choose options for Tên sản phẩm', 'vi')).toBe('Hãy chọn tùy chọn cho Tên sản phẩm');
  expect(t('Ryzen 7 9700X', 'vi')).toBe('Ryzen 7 9700X');
});

test('known server failures translate in both directions without modifying API identifiers', () => {
  for (const original of ['A product or seller is unavailable', 'Image format does not match its contents', 'Only buyers with a delivered order can review this product']) {
    const vietnamese = t(original, 'vi');
    expect(vietnamese).not.toBe(original);
    expect(t(vietnamese, 'en')).toBe(original);
  }
  expect(t('payment_intent.succeeded', 'vi')).toBe('payment_intent.succeeded');
});
