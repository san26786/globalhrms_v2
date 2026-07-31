"use client"
import React, { useState } from 'react';
import { DEPT_ENGAGEMENT_DATA } from '@/data/mockData';

export default function DonutChart() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const totalEmployees = 152;
  
  // SVG configuration
  const radius = 65;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const center = 100;

  // Compute start/end angles for segments
  let accumulatedPercentage = 0;
  const segments = DEPT_ENGAGEMENT_DATA.map((item, index) => {
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
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-display font-semibold text-slate-800 text-base">
          Employee Engagement By Department
        </h3>
        <button className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
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
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />
            {segments.map((segment) => {
              const isHovered = hoveredIndex === segment.index;
              return (
                <circle
                  key={segment.department}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={segment.strokeDashoffset}
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
            <span className="text-2xl font-display font-black text-slate-800 leading-none">
              {activeSegment ? activeSegment.count : totalEmployees}
            </span>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-1">
              {activeSegment ? activeSegment.department.substring(0, 15) : 'Total'}
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
                  key={segment.department}
                  className={`flex items-center justify-between p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                    isHovered ? 'bg-slate-50 scale-[1.02]' : 'hover:bg-slate-50/50'
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
                    <span className="text-xs font-medium text-slate-600 truncate max-w-[130px] sm:max-w-none">
                      {segment.department}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">
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
