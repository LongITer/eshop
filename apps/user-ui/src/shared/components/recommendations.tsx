'use client';
import { useQuery } from '@tanstack/react-query';
import useUser from '@/hooks/useUser';
import axios from '@/utils/axioInstance';
import ProductCard from '@/shared/cards/product-card';
export default function Recommendations({ productId }: { productId?: string }) {
  const { user } = useUser();
  const query = useQuery({
    queryKey: ['recommendations', productId, user?.id],
    queryFn: async () => (await axios.get(productId ? `/recommendation/api/similar-products/${productId}` : user ? `/recommendation/api/recommendations/${user.id}` : '/recommendation/api/trending-products')).data.products,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  if (!query.data?.length) return null;
  return <section className="max-w-7xl mx-auto px-4 py-8"><h2 className="text-2xl font-semibold mb-5">{productId ? 'Similar products' : user ? 'Recommended for you' : 'Trending products'}</h2><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{query.data.map((p: any) => <ProductCard key={p.id} product={p} />)}</div></section>;
}
