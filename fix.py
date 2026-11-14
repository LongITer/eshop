import os

file_path = "d:/Eshop/apps/seller-ui/src/app/dashboard/orders/[id]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

import re

new_select = """          <select
            value={order.status}
            onChange={(event) => updateStatusMutation.mutate(event.target.value)}
            disabled={updateStatusMutation.isPending}
            className="min-w-[108px] rounded-md border border-slate-500 bg-[#111827] px-3 py-1.5 text-white outline-none transition focus:border-blue-400"
          >
            {["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Refunded"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>"""

content = re.sub(r'<select[^>]*>[\s\S]*?</select>', new_select, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
