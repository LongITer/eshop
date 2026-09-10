import GeographicalMap from "../shared/component/charts/geographicalMap";
import SaleChart from "../shared/component/charts/sale-chart";

const deviceData = [
  { label: "Phone", value: 55, color: "#20dc69" },
  { label: "Tablet", value: 25, color: "#ffbd1f" },
  { label: "Computer", value: 20, color: "#4285f4" },
];

const orders = [
  ["ORD-001", "John Doe", "$250", "Paid"],
  ["ORD-002", "Jane Smith", "$180", "Pending"],
  ["ORD-003", "Alice Johnson", "$340", "Paid"],
  ["ORD-004", "Bob Lee", "$90", "Failed"],
  ["ORD-005", "Bob Lee", "$90", "Failed"],
  ["ORD-006", "Bob Lee", "$90", "Failed"],
];

const statusColor: Record<string, string> = {
  Paid: "text-[#36db76]",
  Pending: "text-[#f3c52c]",
  Failed: "text-[#f05d68]",
};

const DashboardPage = () => {
  return (
    <main className="min-h-screen bg-[#050607] px-5 py-6 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          <section>
            <h1 className="text-lg font-semibold tracking-tight">Revenue</h1>
            <p className="mt-1 text-sm text-[#7f899b]">Last 6 months performance</p>
            <div className="mt-5">
              <SaleChart
                data={[
                  { label: "Jan", value: 34 },
                  { label: "Feb", value: 46 },
                  { label: "Mar", value: 29 },
                  { label: "Apr", value: 61 },
                  { label: "May", value: 47 },
                  { label: "Jun", value: 109 },
                  { label: "Jul", value: 96 },
                ]}
                height={300}
              />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Device Usage</h2>
            <p className="mt-1 text-sm text-[#7f899b]">How users access your platform</p>
            <div className="mt-6 flex flex-col items-center">
              <div
                className="relative h-36 w-36 rounded-full"
                style={{ background: "conic-gradient(#20dc69 0 55%, #ffbd1f 55% 80%, #4285f4 80% 100%)" }}
              >
                <div className="absolute inset-[22px] rounded-full bg-[#050607]" />
              </div>
              <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-[#b8bfcc]">
                {deviceData.map((device) => (
                  <span className="flex items-center gap-1.5" key={device.label}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: device.color }} />
                    {device.label}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-9 grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section>
            <h2 className="text-lg font-semibold tracking-tight">User &amp; Seller Distribution</h2>
            <p className="mt-1 text-sm text-[#7f899b]">Visual breakdown of global user &amp; seller activity.</p>
            <div className="mt-4 rounded border border-[#111a28] bg-[#050607] p-2 sm:p-4">
              <GeographicalMap />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Recent Orders</h2>
            <p className="mt-1 text-sm text-[#7f899b]">A quick snapshot of your latest transactions.</p>
            <div className="mt-4 overflow-x-auto rounded border border-[#283142]">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead className="bg-[#111827] text-[#aeb8c9]">
                  <tr>
                    {['Order ID', 'Customer', 'Amount', 'Status'].map((heading) => (
                      <th className="px-3 py-3 font-semibold" key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(([id, customer, amount, status]) => (
                    <tr className="border-t border-[#202938] text-[#d6dbe4]" key={id}>
                      <td className="px-3 py-2.5">{id}</td>
                      <td className="px-3 py-2.5">{customer}</td>
                      <td className="px-3 py-2.5">{amount}</td>
                      <td className={`px-3 py-2.5 ${statusColor[status]}`}>{status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default DashboardPage;
