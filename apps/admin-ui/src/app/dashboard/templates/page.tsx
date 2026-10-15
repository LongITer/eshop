'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@packages/components/language-switcher';
import axios from '../../../utils/axioInstance';
import { EmptyState, ErrorState, PageHeading, Panel } from '../../../shared/admin-ui';
const slots = ['cpu', 'gpu', 'ram', 'motherboard', 'storage', 'psu', 'case', 'cooler'];
const empty = { name: '', purpose: 'gaming', budgetMin: 0, budgetMax: 15000000, description: '', isActive: false, components: {} as Record<string, string>, productIds: [] as string[] };
export default function Templates() {
  const { language } = useLanguage(); const t = (a: string, b: string) => language === 'vi' ? a : b;
  const [page, setPage] = useState(1), [id, setId] = useState(''), [form, setForm] = useState(empty), [search, setSearch] = useState('');
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-templates', page], queryFn: async () => (await axios.get('/admin/templates', { params: { page } })).data });
  const catalog = useQuery({ queryKey: ['admin-template-products', search], queryFn: async () => (await axios.get('/admin/get-all-products', { params: { search, status: 'Active' } })).data.products, enabled: search.trim().length > 1 });
  const mutation = useMutation({ mutationFn: () => id ? axios.put(`/admin/templates/${id}`, form) : axios.post('/admin/templates', form), onSuccess: () => { client.invalidateQueries({ queryKey: ['admin-templates'] }); setId(''); setForm(empty); } });
  return <div className="admin-page"><PageHeading title={t('Mẫu cấu hình PC', 'PC build templates')} description={t('Quản lý mẫu tư vấn theo mục đích và ngân sách. Ngân sách dùng VND theo mẫu tư vấn hiện tại của chatbot.', 'Manage recommendations by purpose and budget. Budgets use VND, matching the chatbot consultation templates.')} />
    {query.isError ? <ErrorState retry={query.refetch} /> : <Panel title={t('Danh sách mẫu', 'Templates')}>{query.data?.rows.map((row: any) => <div className="flex justify-between gap-3 border-b border-gray-800 p-4" key={row.id}><div>{row.name}<p className="text-xs text-slate-400">{row.purpose} · {row.budgetMin.toLocaleString()}–{row.budgetMax.toLocaleString()} VND · {row.isActive ? 'Active' : 'Inactive'}</p></div><button className="text-blue-400" onClick={() => { setId(row.id); setForm({ ...row, description: row.description ?? '' }); mutation.reset(); }}>{t('Sửa', 'Edit')}</button></div>)}{query.data?.total === 0 && <EmptyState />}</Panel>}
    <div className="flex gap-3"><button className="admin-button" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('Trước', 'Previous')}</button><span>{page}</span><button className="admin-button" disabled={!query.data || page * 20 >= query.data.total} onClick={() => setPage(p => p + 1)}>{t('Sau', 'Next')}</button></div>
    <Panel title={id ? t('Chỉnh sửa mẫu', 'Edit template') : t('Tạo mẫu', 'Create template')}><form className="space-y-4 p-5" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
      <label className="admin-label">{t('Tên', 'Name')}<input className="admin-control" required maxLength={150} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label className="admin-label">{t('Mục đích', 'Purpose')}<select className="admin-control" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}>{['gaming','office','design','streaming','learning'].map(p => <option key={p}>{p}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2">{(['budgetMin','budgetMax'] as const).map(key => <label className="admin-label" key={key}>{key === 'budgetMin' ? t('Ngân sách từ (VND)', 'Minimum budget (VND)') : t('Ngân sách đến (VND)', 'Maximum budget (VND)')}<input type="number" min={0} step="0.01" required className="admin-control" value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} /></label>)}</div>
      <div className="grid gap-3 sm:grid-cols-2">{slots.map(slot => <label className="admin-label" key={slot}>{slot.toUpperCase()}<input className="admin-control" maxLength={300} value={form.components[slot] ?? ''} onChange={e => { const components = { ...form.components }; if (e.target.value) components[slot] = e.target.value; else delete components[slot]; setForm({ ...form, components }); }} /></label>)}</div>
      <label className="admin-label">{t('Mô tả', 'Description')}<textarea className="admin-control" maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <label className="admin-label">{t('Liên kết sản phẩm (tìm theo tên)', 'Link products (search by name)')}<input className="admin-control" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className="max-h-48 space-y-2 overflow-y-auto">{catalog.data?.filter((p: any) => !p.isDeleted).map((p: any) => <label className="flex gap-2 text-sm" key={p.id}><input type="checkbox" checked={form.productIds.includes(p.id)} onChange={e => setForm({ ...form, productIds: e.target.checked ? [...form.productIds, p.id] : form.productIds.filter(id => id !== p.id) })} />{p.title}</label>)}</div>
      <p className="text-xs text-slate-400">{form.productIds.length} {t('sản phẩm đã chọn', 'products linked')} <button type="button" className="text-blue-400" onClick={() => setForm({ ...form, productIds: [] })}>{t('Bỏ tất cả', 'Clear all')}</button></p>
      <label className="flex gap-2"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />{t('Cho phép chatbot sử dụng', 'Enable for chatbot')}</label>
      {mutation.isError && <p role="alert" className="text-red-400">{(mutation.error as any).response?.data?.message}</p>}{mutation.isSuccess && <p role="status" className="text-emerald-400">{t('Đã lưu mẫu.', 'Template saved.')}</p>}
      <div className="flex gap-3"><button className="admin-primary" disabled={mutation.isPending}>{t('Lưu mẫu', 'Save template')}</button><button type="button" className="admin-button" onClick={() => { setId(''); setForm(empty); }}>{t('Tạo mới', 'New template')}</button></div>
    </form></Panel>
  </div>;
}
