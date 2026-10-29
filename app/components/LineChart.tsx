"use client"
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { JOINING_TREND_DATA } from '../data/mockData';

export interface JoiningTrendDatum {
  year: number;
  count: number;
}

interface LineChartProps {
  /** Real data from lib/dashboard; falls back to the original mock data when omitted. */
  data?: JoiningTrendDatum[];
}

export default function LineChart({ data: dataProp }: LineChartProps = {}) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 180 });

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        // Keep height proportional
        setDimensions({ width: width || 500, height: 180 });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const data = dataProp && dataProp.length > 0 ? dataProp : JOINING_TREND_DATA;
  // Y axis maximum: scale to the real data (rounded up to a clean multiple of 50),
  // keeping the original mock chart's ceiling (200) as the minimum.
  const maxVal = Math.max(200, Math.ceil((Math.max(0, ...data.map((d) => d.count)) + 1) / 50) * 50);

  const paddingLeft = 35;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = dimensions.width - paddingLeft - paddingRight;
  const chartHeight = dimensions.height - paddingTop - paddingBottom;

  // Convert coordinate points
  const points = data.map((d, index) => {
    // const x = paddingLeft + (index / (data.length - 1)) * chartWidth;
    const x = data.length > 1 ? index * (chartWidth / (data.length - 1)) : chartWidth / 2;
    const y = paddingTop + chartHeight - (d.count / maxVal) * chartHeight;
    return { x, y, ...d };
  });

  // SVG Path Generator for smooth bezier curve
  const createBezierPath = () => {
    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      
      // Control points for smooth bezier curve
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (2 * (p1.x - p0.x)) / 3;
      const cpY2 = p1.y;
      
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const linePath = createBezierPath();
  
  // Create closed path for the gradient area underneath
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  // Grid levels for Y-axis
  const yTicks = [0, 50, 100, 150, 200];

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white dark:bg-[#111a2e] p-6 ring-1 ring-slate-200 dark:ring-white/10 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(6,27,49,0.3)]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[15px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">
          Employee Joining Per Year
        </h3>
        <button className="rounded-full bg-[#e3edf9] dark:bg-[#16233d] px-3.5 py-1.5 text-[13px] font-medium text-[#083f72] dark:text-[#cfe1fa] transition-colors duration-200 hover:bg-[#d3e3f6] dark:hover:bg-[#1d2d4d] cursor-pointer">
          View Details
        </button>
      </div>

      <div ref={containerRef} className="flex-1 w-full relative select-none">
        <svg width={dimensions.width} height={dimensions.height} className="overflow-visible">
          <defs>
            {/* Area gradient */}
            <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b5394" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0b5394" stopOpacity="0.00" />
            </linearGradient>
            
            {/* Dot drop shadow */}
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#da5427" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Horizontal Grid lines */}
          {yTicks.map((tick) => {
            const y = paddingTop + chartHeight - (tick / maxVal) * chartHeight;
            return (
              <g key={tick} className="opacity-40">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={dimensions.width - paddingRight}
                  y2={y}
                  className="stroke-[#e2e8f0] dark:stroke-white/20"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                {/* Y-axis labels */}
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[11px] font-medium fill-[#535768] dark:fill-[#aab3c5]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Curved Line Path with Area Gradient */}
          {points.length > 0 && (
            <>
              {/* Area under the line */}
              <motion.path d={areaPath} fill="url(#area-gradient)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.6 }} />

              {/* Main trend line */}
              <motion.path
                d={linePath}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, delay: 0.2, ease: [0.515, 0.147, 0.25, 1] }}
                fill="none"
                stroke="#0b5394"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Interactive dots and hover guides */}
          {points.map((pt, i) => {
            const isHovered = hoveredPoint === i;
            return (
              <g key={pt.year} className="cursor-pointer">
                {/* Vertical hover line indicator */}
                {isHovered && (
                  <line
                    x1={pt.x}
                    y1={paddingTop}
                    x2={pt.x}
                    y2={paddingTop + chartHeight}
                    stroke="#da5427"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    className="animate-fade-in"
                  />
                )}

                {/* Larger transparent hover capture circle */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="14"
                  fill="transparent"
                  onMouseEnter={() => setHoveredPoint(i)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />

                {/* Visual solid dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? '6' : '3.5'}
                  fill={isHovered ? '#da5427' : '#0b5394'}
                  strokeWidth={isHovered ? '2' : '1.5'}
                  filter={isHovered ? 'url(#shadow)' : 'none'}
                  className="stroke-white dark:stroke-[#111a2e] transition-all duration-150"
                  onMouseEnter={() => setHoveredPoint(i)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />

                {/* Value Label above the dot (always shown for peak or hovered) */}
                {(isHovered || pt.year === 2016 || pt.year === 2025 || pt.year === 2026) && (
                  <text
                    x={pt.x}
                    y={pt.y - 10}
                    textAnchor="middle"
                    className={`text-[11px] font-semibold fill-[#1a1818] dark:fill-[#f1f3f8] transition-all duration-200 ${
                      isHovered ? 'fill-[#7a2e12] scale-110' : ''
                    }`}
                  >
                    {pt.count}
                  </text>
                )}
              </g>
            );
          })}

          {/* X-axis year labels */}
          {points.map((pt) => (
            <text
              key={pt.year}
              x={pt.x}
              y={paddingTop + chartHeight + 18}
              textAnchor="middle"
              className="text-[11px] font-medium fill-[#535768] dark:fill-[#aab3c5]"
            >
              {pt.year}
            </text>
          ))}
        </svg>

        {/* Hover Tooltip floating on top */}
        {hoveredPoint !== null && (
          <div
            className="absolute z-20 pointer-events-none rounded-lg bg-[#1a1818] px-2.5 py-1.5 text-[12px] font-medium tabular-nums text-white shadow-lg"
            style={{
              left: `${points[hoveredPoint].x - 30}px`,
              top: `${points[hoveredPoint].y - 38}px`,
            }}
          >
            {points[hoveredPoint].year}: {points[hoveredPoint].count}
          </div>
        )}
      </div>
    </div>
  );
}
