'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Range } from 'react-range';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useStorefrontText } from '@packages/components/storefront-language';
import axios from '@/utils/axioInstance';
import ProductCard from '@/shared/cards/product-card';

const colors = [
  { name: 'Black', code: '#000000', aliases: ['Black', '#000', '#000000'] },
  { name: 'Red', code: '#ff0000', aliases: ['Red', '#f00', '#ff0000'] },
  { name: 'Green', code: '#00ff00', aliases: ['Green', '#0f0', '#00ff00'] },
  { name: 'Blue', code: '#0000ff', aliases: ['Blue', '#00f', '#0000ff'] },
  { name: 'Yellow', code: '#ffff00', aliases: ['Yellow', '#ff0', '#ffff00'] },
  { name: 'Magenta', code: '#ff00ff', aliases: ['Magenta', '#f0f', '#ff00ff'] },
  { name: 'Cyan', code: '#00ffff', aliases: ['Cyan', '#0ff', '#00ffff'] },
];
const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const filterHeading = 'text-xl font-Poppins font-medium border-b border-b-slate-300 pb-1';

function PriceFilter({ minimum, maximum, bound, onApply }: { minimum: string; maximum: string; bound: number; onApply: (min: string, max: string) => void }) {
  const { t } = useStorefrontText();
  const [min, setMin] = useState(minimum), [max, setMax] = useState(maximum);
  const number = (value: string, fallback: number) => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;
  const ceiling = Math.max(1, Math.ceil(bound), number(min, 0), number(max, 0));
  const high = Math.min(ceiling, number(max, ceiling));
  const low = Math.min(high, number(min, 0));
  return <form onSubmit={event => { event.preventDefault(); onApply(min, max); }}>
    <h2 className="text-xl font-Poppins font-medium">{t('Price Filter')}</h2>
    <div className="mx-2 mb-5 mt-6">
      <Range step={0.01} min={0} max={ceiling} values={[low, high]} onChange={values => { setMin(String(values[0])); setMax(String(values[1])); }}
        renderTrack={({ props, children }) => <div {...props} className="relative h-[6px] rounded-full bg-blue-200" style={props.style}><div className="absolute h-full rounded-full bg-blue-600" style={{ left: `${low / ceiling * 100}%`, width: `${(high - low) / ceiling * 100}%` }} />{children}</div>}
        renderThumb={({ props, index }) => { const { key, ...rest } = props; return <div key={key} {...rest} aria-label={t(index ? 'Maximum price (USD)' : 'Minimum price (USD)')} className="h-4 w-4 rounded-full bg-blue-600 shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" />; }} />
    </div>
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <label className="min-w-0 flex-1"><span className="sr-only">{t('Minimum price (USD)')}</span><input aria-label={t('Minimum price (USD)')} type="number" min="0" max={max || undefined} step="0.01" value={min} placeholder="0" onChange={e => setMin(e.target.value)} className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 outline-none focus:border-blue-500" /></label><span>–</span>
      <label className="min-w-0 flex-1"><span className="sr-only">{t('Maximum price (USD)')}</span><input aria-label={t('Maximum price (USD)')} type="number" min={min || '0'} step="0.01" value={max} placeholder={String(ceiling)} onChange={e => setMax(e.target.value)} className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 outline-none focus:border-blue-500" /></label><span className="text-xs">USD</span>
    </div>
    <button className="mt-3 rounded-full bg-gray-200 px-4 py-1.5 text-sm transition hover:bg-blue-600 hover:text-white">{t('Apply')}</button>
  </form>;
}

function Catalog() {
  const { t } = useStorefrontText();
  const router = useRouter(), params = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const queryString = params.toString();
  const query = useQuery({
    queryKey: ['catalog', queryString],
    queryFn: async ({ signal }) => {
      const requestParams = new URLSearchParams(queryString); requestParams.set('limit', '12');
      return (await axios.get(`/product/api/get-filtered-products?${requestParams}`, { signal })).data;
    },
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await axios.get('/product/api/get-categories')).data });
  const selected = (key: string) => params.getAll(key).flatMap(value => value.split(',')).filter(Boolean);
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(queryString);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.delete('page');
    router.push(`/products?${next}`, { scroll: false });
  };
  const toggle = (key: string, values: string[]) => {
    const next = new URLSearchParams(queryString), current = selected(key);
    const active = values.some(value => current.includes(value));
    next.delete(key);
    (active ? current.filter(value => !values.includes(value)) : [...new Set([...current, ...values])]).forEach(value => next.append(key, value));
    next.delete('page');
    if (key === 'categories') next.delete('subCategories');
    router.push(`/products?${next}`, { scroll: false });
  };
  const applyPrice = (min: string, max: string) => {
    const next = new URLSearchParams(queryString); next.delete('priceRange'); next.delete('page');
    min ? next.set('minPrice', min) : next.delete('minPrice'); max ? next.set('maxPrice', max) : next.delete('maxPrice');
    router.push(`/products?${next}`, { scroll: false });
  };
  const minimum = params.get('minPrice') ?? params.get('priceRange')?.split(',')[0] ?? '';
  const maximum = params.get('maxPrice') ?? params.get('priceRange')?.split(',')[1] ?? '';
  const pagination = query.data?.pagination, page = pagination?.page ?? 1, totalPages = pagination?.totalPages ?? 1;
  const pageNumbers = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  const subCategories = [...new Set<string>(Object.entries(categories.data?.subCategories ?? {}).filter(([key]) => !selected('categories').length || selected('categories').includes(key)).flatMap(([, values]) => values as string[]))];
  const extraColors = selected('colors').filter(value => !colors.some(color => color.aliases.includes(value)));

  return <main className="w-full bg-[#f5f5f5] pb-10">
    <div className="mx-auto w-[90%] lg:w-[80%]">
      <div className="pb-[50px] pt-8 md:pt-[40px]">
        <h1 className="mb-[14px] font-jost text-[44px] font-medium leading-tight">{t('All Products')}</h1>
        <Link href="/" className="text-[#55585b] hover:underline">{t('Home')}</Link><span className="mx-1 inline-block rounded-full bg-[#a8acb0] p-[1.5px]" /><span className="text-[#55585b]">{t('All Products')}</span>
      </div>
      <button className="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm lg:hidden" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16} />{t('Bộ lọc')}</button>
      <div className="flex w-full flex-col items-start gap-8 lg:flex-row">
        <aside id="catalog-filters" className={`${filtersOpen ? 'block' : 'hidden'} w-full shrink-0 space-y-6 rounded-3xl bg-white p-4 shadow-md lg:block lg:w-[270px]`}>
          <PriceFilter key={`${minimum}-${maximum}-${query.data?.priceBounds.max ?? 0}`} minimum={minimum} maximum={maximum} bound={query.data?.priceBounds.max ?? 0} onApply={applyPrice} />
          {categories.isLoading && <p role="status" className="text-sm text-gray-500">{t('Đang tải…')}</p>}
          {categories.isError && <button className="text-sm text-red-600 underline" onClick={() => categories.refetch()}>{t('Tải lại danh mục')}</button>}
          <fieldset><legend className={`${filterHeading} mb-3 w-full`}>{t('Categories')}</legend><div className="space-y-2">{categories.data?.categories?.map((category: string) => <label key={category} className="flex items-center gap-3 text-sm text-gray-700"><input type="checkbox" className="accent-blue-600" checked={selected('categories').includes(category)} onChange={() => toggle('categories', [category])} />{category}</label>)}</div></fieldset>
          <fieldset><legend className={`${filterHeading} mb-3 w-full`}>{t('Danh mục con')}</legend><div className="space-y-2">{subCategories.map(category => <label key={category} className="flex items-center gap-3 text-sm text-gray-700"><input type="checkbox" className="accent-blue-600" checked={selected('subCategories').includes(category)} onChange={() => toggle('subCategories', [category])} />{category}</label>)}</div></fieldset>
          <fieldset><legend className={`${filterHeading} mb-3 w-full`}>{t('Colors')}</legend><div className="space-y-2">{colors.map(color => <label key={color.name} className="flex items-center gap-3 text-sm text-gray-700"><input type="checkbox" className="accent-blue-600" checked={color.aliases.some(value => selected('colors').includes(value))} onChange={() => toggle('colors', color.aliases)} /><span className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: color.code }} />{t(color.name)}</label>)}{extraColors.map(color => <label key={color} className="flex items-center gap-3 text-sm text-gray-700"><input type="checkbox" className="accent-blue-600" checked onChange={() => toggle('colors', [color])} />{color}</label>)}</div></fieldset>
          <fieldset><legend className={`${filterHeading} mb-3 w-full`}>{t('Sizes')}</legend><div className="space-y-2">{[...new Set([...sizes, ...selected('sizes')])].map(size => <label key={size} className="flex items-center gap-3 text-sm text-gray-700"><input type="checkbox" className="accent-blue-600" checked={selected('sizes').includes(size)} onChange={() => toggle('sizes', [size])} />{size}</label>)}</div></fieldset>
          <div className="space-y-4 border-t border-gray-200 pt-4"><label className="flex items-center gap-3 text-sm text-gray-700"><input type="checkbox" className="accent-blue-600" checked={params.get('inStock') === 'true'} onChange={event => change('inStock', event.target.checked ? 'true' : '')} />{t('Chỉ còn hàng')}</label><button className="text-sm font-medium text-blue-600 hover:underline" onClick={() => router.push('/products', { scroll: false })}>{t('Xóa bộ lọc')}</button></div>
        </aside>
        <section className="min-w-0 flex-1 px-2 lg:px-3" aria-busy={query.isFetching}>
          <form key={params.get('q') || ''} className="relative mb-4" onSubmit={event => { event.preventDefault(); change('q', String(new FormData(event.currentTarget).get('q') || '').trim()); }}><input name="q" aria-label={t('Tên sản phẩm hoặc thương hiệu')} placeholder={t('Tên sản phẩm hoặc thương hiệu…')} defaultValue={params.get('q') || ''} className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-4 pr-12 text-sm outline-none focus:border-blue-500" /><button type="submit" aria-label={t('Tìm kiếm')} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50"><Search size={19} /></button></form>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600"><p role="status">{query.isFetching ? t('Đang tải sản phẩm…') : pagination ? `${pagination.total} ${t('products')}` : ''}</p><label className="flex items-center gap-2">{t('Sắp xếp')}<select value={params.get('sort') || 'newest'} onChange={event => change('sort', event.target.value)} className="max-w-full rounded-md border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-500">{[['newest', 'Mới nhất'], ['priceAsc', 'Giá tăng dần'], ['priceDesc', 'Giá giảm dần'], ['popular', 'Bán chạy'], ['rating', 'Đánh giá cao']].map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label></div>
          {query.isLoading ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label={t('Đang tải sản phẩm…')}>{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[350px] animate-pulse rounded-xl bg-gray-200" />)}</div> : query.isError ? <div role="alert" className="rounded-lg border border-red-100 bg-white p-6 text-sm text-red-600"><p>{t('Không tải được sản phẩm. Kiểm tra khoảng giá hoặc thử lại.')}</p><button className="mt-3 font-medium underline" onClick={() => query.refetch()}>{t('Thử lại')}</button></div> : query.data?.products.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{query.data.products.map((product: any) => <ProductCard key={product.id} product={product} />)}</div> : <p className="rounded-lg bg-white p-6 text-sm text-gray-500">{t('Không có sản phẩm phù hợp. Thử đổi bộ lọc.')}</p>}
          {totalPages > 1 && !query.isError && <nav aria-label={t('Page')} className="mt-8 flex flex-wrap justify-center gap-2">{pageNumbers.map((number, index) => <span key={number} className="inline-flex items-center gap-2">{index > 0 && number - pageNumbers[index - 1] > 1 && <span aria-hidden="true">…</span>}<button disabled={query.isPlaceholderData} aria-current={page === number ? 'page' : undefined} aria-label={`${t('Page')} ${number}`} onClick={() => change('page', String(number))} className={`rounded-full border border-gray-200 px-3 py-1 text-sm disabled:opacity-50 ${page === number ? 'bg-blue-600 text-white' : 'bg-white text-black hover:border-blue-400'}`}>{number}</button></span>)}</nav>}
        </section>
      </div>
    </div>
  </main>;
}

export default function Products() {
  const { t } = useStorefrontText();
  return <Suspense fallback={<p className="p-8">{t('Đang tải…')}</p>}><Catalog /></Suspense>;
}
