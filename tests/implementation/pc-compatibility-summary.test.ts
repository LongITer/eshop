import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PcBuildSummary from '../../apps/user-ui/src/shared/components/pc-builder/build-summary';
import { StorefrontLanguageProvider } from '@packages/components/storefront-language';
import { assessCompatibility, PC_MANUAL_CHECK_NOTE } from '@packages/utils/pc-build';
import type { PcSelection } from '@packages/utils/pc-build-selection';

const selections: PcSelection[] = [
  { slot: 'cpu', id: '111111111111111111111111', selectedOptions: { color: '', size: '' } },
  { slot: 'motherboard', id: '222222222222222222222222', selectedOptions: { color: '', size: '' } },
];
const parts = selections.map((selection, index) => ({ ...selection, title: index ? 'Mainboard sample' : 'CPU sample', sale_price: 100, stock: 5, custom_specification: { socket: 'AM5' } }));

function quoteFor(value = parts) {
  const { checks, issues, notes } = assessCompatibility(Object.fromEntries(value.map(part => [part.slot, part])));
  return { parts: value, compatibility: { checks, notes }, issues, total: 200, canAddToCart: !issues.some(issue => issue.level === 'error') };
}
function render(quote: any, language: 'vi' | 'en' = 'en') {
  const element = createElement(PcBuildSummary, {
    selections, quote, quoteLoading: false, quoteError: null, adding: false,
    onSelectSlot: jest.fn(), onRemove: jest.fn(), onAdd: jest.fn(), onRetry: jest.fn(),
  });
  return renderToStaticMarkup(language === 'vi' ? createElement(StorefrontLanguageProvider, null, element) : element);
}
function cartButton(html: string) {
  return html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes('Add components to cart'));
}

test('known matching specs show factual checks and a separate neutral manual reminder', () => {
  const html = render(quoteFor());
  expect(html).toContain('Checked specifications');
  expect(html).toContain('CPU / motherboard socket');
  expect(html).toContain('AM5');
  expect(html).toContain('Additional checks before ordering');
  expect(html).toContain(PC_MANUAL_CHECK_NOTE);
  expect(html).not.toContain('Needs product specifications');
  expect(html).not.toContain('border-amber');
  expect(cartButton(html)).not.toContain('disabled=""');
});

test('unknown specs identify field and missing component in Vietnamese without repeating the generic warning', () => {
  const quote = quoteFor(parts.map(part => part.slot === 'cpu' ? { ...part, custom_specification: {} } : part));
  const html = render(quote, 'vi');
  expect(html).toContain('Cần bổ sung thông số sản phẩm');
  expect(html).toContain('Socket CPU / bo mạch chủ');
  expect(html).toContain('Socket: CPU / Bộ xử lý');
  expect(html).not.toContain('Không thể xác minh');
  expect(html).not.toContain('Thông số đã kiểm tra');
});

test('confirmed hardware conflict remains an alert and disables adding components', () => {
  const html = render(quoteFor(parts.map(part => part.slot === 'motherboard' ? { ...part, custom_specification: { socket: 'LGA1700' } } : part)));
  expect(html).toContain('role="alert"');
  expect(html).toContain('AM5 / LGA1700');
  expect(cartButton(html)).toContain('disabled=""');
});

test('a stale quote cannot display obsolete passed checks or enable adding components', () => {
  const quote = quoteFor();
  quote.parts = quote.parts.map(part => ({ ...part, id: '333333333333333333333333' }));
  const html = render(quote);
  expect(html).not.toContain('Checked specifications');
  expect(html).toContain('Waiting for a current price check.');
  expect(cartButton(html)).toContain('disabled=""');
});

test('legacy responses retain missing-data warnings but separate the generic manual note', () => {
  const quote: any = quoteFor();
  delete quote.compatibility;
  quote.issues = [{ level: 'warning', message: 'Cannot verify CPU / motherboard socket: specifications are missing.' }, { level: 'warning', message: PC_MANUAL_CHECK_NOTE }];
  const html = render(quote);
  expect(html).toContain('Specifications to review');
  expect(html).toContain('Cannot verify CPU / motherboard socket');
  expect(html.split(PC_MANUAL_CHECK_NOTE)).toHaveLength(2);
});
