import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { storefrontMessages, translateStorefront as t } from '../../packages/utils/storefront-messages';
import { StorefrontLanguageProvider, StorefrontLanguageSwitcher, StorefrontText } from '../../packages/components/storefront-language';

describe('storefront language', () => {
  it('provides both languages for every static message', () => {
    for (const [vi, en] of storefrontMessages) {
      expect(vi.trim()).not.toBe('');
      expect(en.trim()).not.toBe('');
      expect(t(en, 'vi')).not.toBe('');
      expect(t(vi, 'en')).not.toBe('');
    }
  });
  it('translates display labels without changing API identifiers', () => {
    expect(t('Cart', 'vi')).toBe('Giỏ hàng');
    expect(t('Giỏ hàng', 'en')).toBe('Cart');
    expect(t('Pending', 'vi')).toBe('Chờ xác nhận');
    expect(t('Pending', 'en')).toBe('Pending');
    expect(t('/profile?active=My+Orders', 'vi')).toBe('/profile?active=My+Orders');
  });
  it('keeps unknown content and surrounding whitespace', () => {
    expect(t('Ryzen Gaming CPU', 'vi')).toBe('Ryzen Gaming CPU');
    expect(t('Giỏ hàng ', 'en')).toBe('Cart ');
    expect(t(' Cart', 'vi')).toBe(' Giỏ hàng');
    expect(t('', 'en')).toBe('');
  });
  it('retains the server stock quantity in translated errors', () => {
    expect(t('Chỉ còn tối đa 3 sản phẩm cho lựa chọn này', 'en')).toBe('Only 3 items available for this option');
    expect(t('Chỉ còn tối đa 0 sản phẩm cho lựa chọn này', 'vi')).toBe('Chỉ còn tối đa 0 sản phẩm cho lựa chọn này');
  });
  it('renders Vietnamese consistently before reading browser storage', () => {
    const html = renderToStaticMarkup(createElement(StorefrontLanguageProvider, null,
      createElement(StorefrontLanguageSwitcher), createElement(StorefrontText, { children: 'Cart' })));
    expect(html).toContain('Giỏ hàng');
    expect(html).toContain('value="vi" selected=""');
    expect(html).toContain('Ngôn ngữ / Language');
  });
  it('leaves shared seller components in English outside the user provider', () => {
    expect(renderToStaticMarkup(createElement(StorefrontText, { children: 'Messages' }))).toBe('Messages');
  });
});
