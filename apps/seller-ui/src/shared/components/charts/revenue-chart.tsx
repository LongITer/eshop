"use client";

import { useState } from "react";

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

const RevenueChart = ({ data, monthly = false }: { data: RevenuePoint[]; monthly?: boolean }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.revenue), 1);
  const hasData = data.some((d) => d.revenue > 0);

  const formatDate = (date: string) => {
    const d = new Date(`${date.length === 7 ? `${date}-01` : date}T00:00:00`);
    return d.toLocaleDateString("en-US", monthly ? { month: "short" } : { month: "short", day: "numeric" });
  };

  return (
    <div className="w-full relative">
      <div className="flex items-end gap-[3px] h-48">
        {data.map((point, index) => {
          const heightPct = (point.revenue / max) * 100;
          const isActive = activeIndex === index;
          return (
            <div
              key={point.date}
              className="relative flex-1 h-full flex flex-col justify-end cursor-pointer"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              tabIndex={0}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              aria-label={`${formatDate(point.date)}: $${point.revenue.toFixed(2)}, ${point.orders} paid orders`}
            >
              {isActive && (
                <div className="absolute z-10 -translate-x-1/2 -top-16 left-1/2 whitespace-nowrap bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-white shadow-lg pointer-events-none">
                  <span className="text-gray-400">
                    {formatDate(point.date)}
                  </span>
                  <span className="ml-2 font-semibold">
                    ${point.revenue.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="ml-2 text-gray-400">
                    {point.orders} order{point.orders !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div
                className={`w-full rounded-t transition-colors ${
                  isActive
                    ? "bg-emerald-400"
                    : point.revenue > 0
                      ? "bg-emerald-500/80"
                      : "bg-gray-800"
                }`}
                style={{
                  height: point.revenue > 0 ? `${Math.max(heightPct, 2)}%` : "2px",
                }}
              />
            </div>
          );
        })}
      </div>

      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-gray-500">No revenue recorded in this period</p>
        </div>
      )}

      <div className="flex gap-[3px] mt-2">
        {data.map((point, index) => (
          <div
            key={point.date}
            className={`flex-1 text-center text-[10px] ${
              monthly || index % 5 === 0 ? "text-gray-400" : "text-transparent"
            }`}
          >
            {formatDate(point.date)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RevenueChart;
