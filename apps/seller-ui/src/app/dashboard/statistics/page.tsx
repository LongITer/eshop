'use client';
import CommerceStatistics from '@packages/components/commerce-statistics';
import useSeller from '../../../hooks/useSeller';
import axios from '../../../utils/axioInstance';

export default function SellerStatisticsPage() {
  const { seller } = useSeller();
  return <CommerceStatistics key={seller?.id || 'loading'} client={axios} endpoint="/product/api/seller-statistics" scope={`seller:${seller?.id}`} enabled={!!seller?.id} />;
}
