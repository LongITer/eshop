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
      <div className="relative flex h-52 items-end gap-1 border-b border-slate-700 bg-[linear-gradient(to_top,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[length:100%_25%]">
        {data.map((point, index) => {
          const heightPct = (point.revenue / max) * 100;
          const isActive = activeIndex === index;
          return (
            <div
              key={point.date}
              className="relative min-w-0 flex-1 h-full flex flex-col justify-end cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              tabIndex={0}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              aria-label={`${formatDate(point.date)}: $${point.revenue.toFixed(2)}, ${point.orders} paid orders`}
            >
              {isActive && (
                <div className={`absolute z-10 -top-16 max-w-[240px] rounded-xl bg-slate-800 px-3 py-2 text-xs text-white shadow-lg ring-1 ring-slate-700 pointer-events-none ${index < data.length / 2 ? "left-0" : "right-0"}`}>
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
                    ? "bg-blue-400"
                    : point.revenue > 0
                      ? "bg-blue-500/80"
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

      <div className="relative mt-3 h-5 text-[10px] text-slate-500">
        {data.filter((_, index) => index === 0 || index === data.length - 1 || (data.length > 2 && index === Math.floor(data.length / 2))).map((point, index, labels) => <span key={point.date} className={`absolute ${index === 0 ? 'left-0' : index === labels.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>{formatDate(point.date)}</span>)}
      </div>
    </div>
  );
};

export default RevenueChart;
