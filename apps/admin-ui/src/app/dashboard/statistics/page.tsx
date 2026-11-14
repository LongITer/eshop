'use client';
import { useState } from 'react';
import CommerceAnalytics from '@packages/components/commerce-analytics';
import { useLanguage } from '@packages/components/language-switcher';
import { canAdmin } from '@packages/utils/admin-access';
import useAdmin from '../../hooks/useAdmin';
import { Lookup } from '../../../shared/work-management';
import axios from '../../../utils/axioInstance';

export default function AdminStatisticsPage() {
  const { admin } = useAdmin();
  const [shopId, setShopId] = useState('');
  const { language } = useLanguage();
  return <CommerceAnalytics key={admin?.id || 'loading'} client={axios} endpoint="/admin/analytics" scope={`admin:${admin?.id}`} enabled={canAdmin(admin, 'overview')} admin shopId={shopId} onClearShop={() => setShopId('')} onSelectShop={setShopId} extraFilters={<Lookup kind="shops" label={language === 'vi' ? 'Cửa hàng' : 'Shop'} value={shopId} onChange={setShopId} />} />;
}
