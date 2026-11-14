import { useQuery } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';
export default function useProductVariant(product: any, color: string, size: string) {
  const query = useQuery({ queryKey: ['product-variants', product.id], queryFn: async () => (await axios.get(`/product/api/variants/${product.id}`)).data.variants });
  const variants = query.data || [];
  const variant = variants.find((v: any) => v.color === color && v.size === size);
  return { ...product, variantId: variant?.id || null, sku: variant?.sku || null, regular_price: Math.max(variant?.price || 0, product.regular_price), sale_price: variant?.price ?? product.sale_price, stock: query.isLoading || query.isError || (variants.length && !variant) ? 0 : variant?.stock ?? product.stock };
}
