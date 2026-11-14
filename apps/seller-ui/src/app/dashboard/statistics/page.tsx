'use client';
import CommerceAnalytics from '@packages/components/commerce-analytics';
import useSeller from '../../../hooks/useSeller';
import axios from '../../../utils/axioInstance';

export default function SellerStatisticsPage() {
  const { seller } = useSeller();
  return <CommerceAnalytics key={seller?.id || 'loading'} client={axios} endpoint="/product/api/seller-analytics" customerEndpoint="/product/api/seller-statistics" scope={`seller:${seller?.id}`} enabled={!!seller?.id} />;
}
