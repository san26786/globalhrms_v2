import React, { useState, useRef, useEffect } from 'react';
import { JOINING_TREND_DATA } from '../data/mockData';

export default function LineChart() {
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

  const data = JOINING_TREND_DATA;
  const maxVal = 200; // Y axis maximum as shown in the image

  const paddingLeft = 35;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = dimensions.width - paddingLeft - paddingRight;
  const chartHeight = dimensions.height - paddingTop - paddingBottom;

  // Convert coordinate points
  const points = data.map((d, index) => {
    const x = paddingLeft + (index / (data.length - 1)) * chartWidth;
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
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-display font-semibold text-slate-800 text-base">
          Employee Joining Per Year
        </h3>
        <button className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
          View Details
        </button>
      </div>

      <div ref={containerRef} className="flex-1 w-full relative select-none">
        <svg width={dimensions.width} height={dimensions.height} className="overflow-visible">
          <defs>
            {/* Area gradient */}
            <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.00" />
            </linearGradient>
            
            {/* Dot drop shadow */}
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#3b82f6" floodOpacity="0.3" />
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
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                {/* Y-axis labels */}
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] font-bold text-slate-400 font-mono fill-current"
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
              <path d={areaPath} fill="url(#area-gradient)" />

              {/* Main trend line */}
              <path
                d={linePath}
                fill="none"
                stroke="#2563eb"
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
                    stroke="#3b82f6"
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
                  fill={isHovered ? '#2563eb' : '#3b82f6'}
                  stroke="#ffffff"
                  strokeWidth={isHovered ? '2' : '1.5'}
                  filter={isHovered ? 'url(#shadow)' : 'none'}
                  className="transition-all duration-150"
                  onMouseEnter={() => setHoveredPoint(i)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />

                {/* Value Label above the dot (always shown for peak or hovered) */}
                {(isHovered || pt.year === 2016 || pt.year === 2025 || pt.year === 2026) && (
                  <text
                    x={pt.x}
                    y={pt.y - 10}
                    textAnchor="middle"
                    className={`text-[10px] font-bold font-mono fill-slate-700 transition-all duration-200 ${
                      isHovered ? 'text-blue-600 font-extrabold scale-110' : ''
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
              className="text-[10px] font-bold text-slate-400 font-mono fill-current"
            >
              {pt.year}
            </text>
          ))}
        </svg>

        {/* Hover Tooltip floating on top */}
        {hoveredPoint !== null && (
          <div
            className="absolute bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-md pointer-events-none z-20 font-mono"
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
