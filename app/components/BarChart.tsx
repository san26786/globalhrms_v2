"use client"
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SALARY_SLAB_DATA } from '@/data/mockData';

export interface SalarySlabDatum {
  range: string;
  count: number;
}

interface BarChartProps {
  /** Real data from lib/dashboard; falls back to the original mock data when omitted. */
  data?: SalarySlabDatum[];
  title?: string;
}

export default function BarChart({ data, title = 'Average Employee Count under Salary Slab' }: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = data && data.length > 0 ? data : SALARY_SLAB_DATA;

  // Scale to the highest count in the data (rounded up to a clean multiple of 50),
  // same minimum ceiling (300) the original mock-data chart used.
  const rawMax = Math.max(0, ...chartData.map((d) => d.count));
  const maxValue = Math.max(300, Math.ceil((rawMax + 1) / 50) * 50);
  const tickStep = maxValue / 6;
  const ticks = Array.from({ length: 7 }, (_, i) => Math.round(i * tickStep));

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white dark:bg-[#111a2e] p-6 ring-1 ring-slate-200 dark:ring-white/10 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(6,27,49,0.3)]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[15px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">
          {title}
        </h3>
        <button className="rounded-full bg-[#e3edf9] dark:bg-[#16233d] px-3.5 py-1.5 text-[13px] font-medium text-[#083f72] dark:text-[#cfe1fa] transition-colors duration-200 hover:bg-[#d3e3f6] dark:hover:bg-[#1d2d4d] cursor-pointer">
          View Details
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-between relative min-h-[220px]">
        {/* Background Vertical Gridlines */}
        <div className="absolute inset-0 left-[140px] right-[40px] top-0 bottom-6 flex justify-between pointer-events-none select-none">
          {ticks.map((_, i) => (
            <div key={i} className="h-full border-r border-slate-100 dark:border-white/10 border-dashed first:border-solid" />
          ))}
        </div>

        {/* Chart Rows */}
        <div className="space-y-2.5 relative z-10 pr-10">
          {chartData.map((slab, index) => {
            const percentage = (slab.count / maxValue) * 100;
            const isHovered = hoveredIndex === index;
            
            return (
              <div
                key={slab.range}
                className="flex items-center"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Y-Axis Label */}
                <span className="w-[130px] pr-3 text-[12px] tabular-nums text-[#535768] dark:text-[#aab3c5] text-left truncate">
                  {slab.range}
                </span>

                {/* Progress Bar Container */}
                <div className="flex-1 h-5 flex items-center relative">
                  <motion.div
                    className={`h-3.5 rounded-full bg-gradient-to-r transition-[background-color,box-shadow,height] duration-300 relative cursor-pointer ${
                      isHovered ? 'from-[#da5427] to-[#f08a5d] shadow-[0_6px_14px_-6px_rgba(218,84,39,0.7)] h-4' : 'from-[#0b5394] to-[#3b82f6]'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(percentage, 100)}%` }}
                    transition={{ duration: 0.9, delay: 0.15 + index * 0.06, ease: [0.515, 0.147, 0.25, 1] }}
                  />
                  {/* Floating Count Label */}
                  <span
                    className={`text-[12px] font-semibold tabular-nums text-[#1a1818] dark:text-[#f1f3f8] ml-3 transition-transform duration-200 ${
                      isHovered ? 'scale-110 text-[#7a2e12] dark:text-[#f8d3c3]' : ''
                    }`}
                  >
                    {slab.count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* X-Axis Labels */}
        <div className="flex items-center pt-4 border-t border-slate-100 dark:border-white/10 mt-2">
          {/* Spacing alignment matches label column */}
          <div className="w-[130px]" />
          <div className="flex-1 flex justify-between px-0.5 relative">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="text-[11px] font-medium tabular-nums text-[#535768] dark:text-[#aab3c5] -translate-x-1/2"
              >
                {tick}
              </span>
            ))}
          </div>
          {/* Spacing alignment for count numbers on the right */}
          <div className="w-10" />
        </div>
      </div>
    </div>
  );
}
