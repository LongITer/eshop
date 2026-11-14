import SellerRevenue from "apps/seller-ui/src/shared/components/charts/seller-revenue";
export default function Reports() {
  return <main className="w-full min-w-0 min-h-screen bg-[#080d1a] p-4 text-slate-100 sm:p-6 lg:p-8 print:bg-white print:text-black">
    <div className="w-full min-w-0 space-y-8"><header><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">Analytics</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Revenue report</h1><p className="mt-2 text-sm text-slate-400">Understand your sales, best-selling products and coupon performance.</p></header><SellerRevenue detailed /></div>
  </main>;
}
