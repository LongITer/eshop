import SellerRevenue from "apps/seller-ui/src/shared/components/charts/seller-revenue";
export default function Reports() {
  return <main className="p-6 text-white space-y-6 print:text-black">
    <h1 className="text-2xl font-bold">Revenue report</h1>
    <SellerRevenue detailed />
  </main>;
}
