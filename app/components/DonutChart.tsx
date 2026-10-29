"use client"
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { DEPT_ENGAGEMENT_DATA } from '@/data/mockData';

export interface DonutDatum {
  department: string;
  count: number;
  percentage: number;
  color: string;
}

interface DonutChartProps {
  /** Real data from lib/dashboard; falls back to the original mock data when omitted. */
  data?: DonutDatum[];
  title?: string;
}

export default function DonutChart({ data, title = 'Employee Engagement By Department' }: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = data && data.length > 0 ? data : DEPT_ENGAGEMENT_DATA;
  const totalEmployees = chartData.reduce((sum, d) => sum + d.count, 0);

  // SVG configuration
  const radius = 65;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const center = 100;

  // Compute start/end angles for segments
  let accumulatedPercentage = 0;
  const segments = chartData.map((item, index) => {
    const strokeDashoffset = circumference - (item.percentage / 100) * circumference;
    const rotation = (accumulatedPercentage / 100) * 360;
    accumulatedPercentage += item.percentage;
    return {
      ...item,
      strokeDashoffset,
      rotation,
      index
    };
  });

  const activeSegment = hoveredIndex !== null ? segments[hoveredIndex] : null;

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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center flex-1">
        {/* SVG Donut */}
        <div className="md:col-span-5 flex justify-center items-center relative min-h-[180px]">
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            className="transform -rotate-90 select-none drop-shadow-sm"
          >
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              className="stroke-[#f1f5f9] dark:stroke-white/10"
              strokeWidth={strokeWidth}
            />
            {segments.map((segment) => {
              const isHovered = hoveredIndex === segment.index;
              return (
                <motion.circle
                  key={`${segment.department ?? 'unknown'}-${segment.index}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: segment.strokeDashoffset }}
                  transition={{ duration: 1, delay: 0.15 + segment.index * 0.06, ease: [0.515, 0.147, 0.25, 1] }}
                  transform={`rotate(${segment.rotation} ${center} ${center})`}
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    transformOrigin: 'center',
                  }}
                  onMouseEnter={() => setHoveredIndex(segment.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-[#1a1818] dark:text-[#f1f3f8] tabular-nums">
              {activeSegment ? activeSegment.count : totalEmployees}
            </span>
            <span className="mt-1 text-[12px] font-medium text-[#535768] dark:text-[#aab3c5]">
              {activeSegment?.department
                ? activeSegment.department.substring(0, 15)
                : 'Total'}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="md:col-span-7 flex flex-col justify-center">
          <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-2">
            {segments.map((segment) => {
              const isHovered = hoveredIndex === segment.index;
              return (
                <div
                  key={segment.index}
                  className={`flex items-center justify-between p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                    isHovered ? 'bg-[#f6f7f9] dark:bg-[#0e1628] scale-[1.02]' : 'hover:bg-[#f6f7f9] dark:hover:bg-white/5'
                  }`}
                  onMouseEnter={() => setHoveredIndex(segment.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 transition-transform duration-200"
                      style={{
                        backgroundColor: segment.color,
                        transform: isHovered ? 'scale(1.2)' : 'none'
                      }}
                    />
                    <span className="text-[13px] text-[#323338] dark:text-[#d5dae4] truncate max-w-[130px] sm:max-w-none">
                      {segment.department}
                    </span>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums text-[#1a1818] dark:text-[#f1f3f8]">
                    {segment.percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
