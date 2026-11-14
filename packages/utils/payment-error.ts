// Provider messages can contain integration details. Keep customer copy stable and translatable.
const messages: Record<string, string> = {
  card_declined: 'Your card was declined. Try another card or contact your bank.',
  insufficient_funds: 'Your card has insufficient funds. Try another payment method.',
  expired_card: 'Your card has expired. Use a different card.',
  incorrect_number: 'Check your card number.',
  invalid_number: 'Check your card number.',
  incomplete_number: 'Complete your card number.',
  incorrect_cvc: 'Check your card security code.',
  invalid_cvc: 'Check your card security code.',
  incomplete_cvc: 'Complete your card security code.',
  invalid_expiry_month: 'Check your card expiration date.',
  invalid_expiry_year: 'Check your card expiration date.',
  invalid_expiry_year_past: 'Check your card expiration date.',
  incomplete_expiry: 'Complete your card expiration date.',
  payment_intent_authentication_failure: 'Card authentication failed. Try again or use another card.',
  authentication_required: 'Your bank requires authentication. Try again to complete verification.',
  processing_error: 'The payment could not be processed. Try again shortly.',
};

export function paymentErrorMessage(error: unknown, phase: 'load' | 'confirm' = 'confirm'): string {
  if (phase === 'load') return 'Unable to load payment form. Reload this page or return to your cart.';
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  for (const code of [value.decline_code, value.code]) {
    if (typeof code === 'string' && Object.hasOwn(messages, code)) return messages[code];
  }
  if (value.type === 'validation_error') return 'Check your payment details and complete all required fields.';
  return 'Payment could not be completed. Check your order history before trying again.';
}
