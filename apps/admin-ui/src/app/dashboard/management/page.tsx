'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@packages/components/language-switcher';
import axios from '../../../utils/axioInstance';
import { ErrorState, PageHeading, Panel } from '../../../shared/admin-ui';
import useAdmin from '../../hooks/useAdmin';

export default function Management() {
  const { language } = useLanguage(); const t = (a: string, b: string) => language === 'vi' ? a : b;
  const { admin } = useAdmin(); const client = useQueryClient();
  const [email, setEmail] = useState(''), [role, setRole] = useState('admin'), [adminRole, setAdminRole] = useState('operations'), [reason, setReason] = useState('');
  const query = useQuery({ queryKey: ['admin-team'], queryFn: async () => (await axios.get('/admin/get-all-admins')).data.admins });
  const mutation = useMutation({ mutationFn: () => axios.post('/admin/add-admin', { email, role, adminRole, reason }), onSuccess: () => { client.invalidateQueries({ queryKey: ['admin-team'] }); client.invalidateQueries({ queryKey: ['admin-catalog'] }); setEmail(''); setReason(''); } });
  const labels: Record<string, string> = { owner: t('Chủ quản trị — toàn quyền', 'Owner — full access'), operations: t('Vận hành — đơn hàng, sản phẩm, trả hàng', 'Operations — orders, catalog, returns'), support: t('Hỗ trợ — tài khoản, đơn hàng, trả hàng', 'Support — accounts, orders, returns'), finance: t('Thanh toán — báo cáo, hoàn tiền, xem đơn', 'Finance — payments, refunds, order viewing') };
  return <div className="admin-page"><PageHeading title={t('Quản lý đội ngũ', 'Team management')} description={t('Chỉ chủ quản trị được cấp hoặc thu hồi quyền. Không thể thay đổi quyền của chính mình.', 'Only owners can grant or revoke access. You cannot change your own access.')} />
    {query.isError ? <ErrorState retry={query.refetch} /> : <Panel title={t('Quản trị viên', 'Administrators')}><div className="overflow-x-auto"><table className="admin-table"><thead><tr><th>{t('Tên', 'Name')}</th><th>Email</th><th>{t('Quyền', 'Access')}</th><th /></tr></thead><tbody>{query.data?.map((row: any) => <tr key={row.id}><td>{row.name}</td><td>{row.email}</td><td>{labels[row.adminRole ?? 'owner']}</td><td><button className="text-blue-400 disabled:opacity-40" disabled={row.id === admin?.id} onClick={() => { setEmail(row.email); setAdminRole(row.adminRole ?? 'owner'); setRole('admin'); mutation.reset(); }}>{t('Chọn để chỉnh sửa', 'Select to edit')}</button></td></tr>)}</tbody></table></div></Panel>}
    <Panel title={t('Cấp / thay đổi / thu hồi quyền', 'Grant, change or revoke access')}><form className="space-y-4 p-5" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
      <label className="admin-label">Email<input required type="email" className="admin-control" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="admin-label">{t('Hành động', 'Action')}<select className="admin-control" value={role} onChange={e => setRole(e.target.value)}><option value="admin">{t('Cấp / cập nhật quyền admin', 'Grant / update admin access')}</option><option value="user">{t('Thu hồi quyền admin', 'Revoke admin access')}</option></select></label>
      {role === 'admin' && <label className="admin-label">{t('Phạm vi quyền', 'Access level')}<select className="admin-control" value={adminRole} onChange={e => setAdminRole(e.target.value)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      <label className="admin-label">{t('Lý do', 'Reason')}<textarea required maxLength={1000} className="admin-control" value={reason} onChange={e => setReason(e.target.value)} /></label>
      {mutation.isError && <p role="alert" className="text-red-400">{(mutation.error as any).response?.data?.message ?? 'Operation failed'}</p>}
      {mutation.isSuccess && <p role="status" className="text-emerald-400">{t('Đã cập nhật quyền.', 'Access updated.')}</p>}
      <button className="admin-primary" disabled={mutation.isPending || !reason.trim()}>{t('Xác nhận thay đổi quyền', 'Confirm access change')}</button>
    </form></Panel>
  </div>;
}
