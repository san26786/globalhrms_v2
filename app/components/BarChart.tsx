"use client"
import React, { useState } from 'react';
import { SALARY_SLAB_DATA } from '@/data/mockData';

export default function BarChart() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const maxValue = 300; // max scale in the image X-axis

  // X-axis guide ticks
  const ticks = [0, 50, 100, 150, 200, 250, 300];

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-display font-semibold text-slate-800 text-base">
          Average Employee Count under Salary Slab
        </h3>
        <button className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
          View Details
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-between relative min-h-[220px]">
        {/* Background Vertical Gridlines */}
        <div className="absolute inset-0 left-[140px] right-[40px] top-0 bottom-6 flex justify-between pointer-events-none select-none">
          {ticks.map((_, i) => (
            <div key={i} className="h-full border-r border-slate-100 border-dashed first:border-solid" />
          ))}
        </div>

        {/* Chart Rows */}
        <div className="space-y-2.5 relative z-10 pr-10">
          {SALARY_SLAB_DATA.map((slab, index) => {
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
                <span className="w-[130px] pr-3 text-[11px] font-medium text-slate-500 font-mono text-left truncate">
                  {slab.range}
                </span>

                {/* Progress Bar Container */}
                <div className="flex-1 h-5 flex items-center relative">
                  <div
                    className={`h-3.5 rounded-full bg-blue-600 transition-all duration-500 ease-out relative cursor-pointer ${
                      isHovered ? 'shadow-md shadow-blue-200 brightness-110 h-4' : 'opacity-90'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                  {/* Floating Count Label */}
                  <span
                    className={`text-[11px] font-bold text-slate-700 font-mono ml-3 transition-transform duration-200 ${
                      isHovered ? 'scale-110 text-blue-600' : ''
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
        <div className="flex items-center pt-4 border-t border-slate-100 mt-2">
          {/* Spacing alignment matches label column */}
          <div className="w-[130px]" />
          <div className="flex-1 flex justify-between px-0.5 relative">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="text-[10px] font-bold text-slate-400 font-mono -translate-x-1/2"
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
