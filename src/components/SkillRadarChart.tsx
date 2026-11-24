import React from 'react';
import type { SkillBands } from '../types';

interface SkillRadarChartProps {
  bands: SkillBands;
}

const AXES: { key: keyof SkillBands; label: string; angleDeg: number }[] = [
  { key: 'listening', label: 'Listening', angleDeg: -90 },
  { key: 'reading', label: 'Reading', angleDeg: 0 },
  { key: 'writing', label: 'Writing', angleDeg: 90 },
  { key: 'speaking', label: 'Speaking', angleDeg: 180 },
];

const RINGS = [3, 6, 9];
const MAX_BAND = 9;
const CX = 150;
const CY = 115;
const RADIUS = 76;

function polarToXY(angleDeg: number, ratio: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + Math.cos(rad) * RADIUS * ratio, CY + Math.sin(rad) * RADIUS * ratio];
}

export function SkillRadarChart({ bands }: SkillRadarChartProps) {
  const valuePoints = AXES.map(({ key, angleDeg }) => {
    const raw = Number(bands[key]);
    const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(MAX_BAND, raw)) : 0;
    return polarToXY(angleDeg, clamped / MAX_BAND);
  });

  const polygonStr = valuePoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox="0 0 300 230"
      className="w-full h-full max-h-56 select-none"
      role="img"
      aria-label={`Biểu đồ Radar 4 kỹ năng: Listening ${bands.listening}, Reading ${bands.reading}, Writing ${bands.writing}, Speaking ${bands.speaking}`}
    >
      {/* Vòng lưới đồng cổ cho thang điểm 3 / 6 / 9 */}
      {RINGS.map((ring) => {
        const ratio = ring / MAX_BAND;
        const pts = AXES.map(({ angleDeg }) => {
          const [x, y] = polarToXY(angleDeg, ratio);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        return (
          <g key={ring}>
            <polygon
              points={pts}
              fill="none"
              stroke="rgba(197, 160, 89, 0.24)"
              strokeWidth={ring === 9 ? 1.2 : 0.9}
              strokeDasharray={ring === 9 ? undefined : '3 3'}
            />
            <text
              x={CX + 5}
              y={CY - RADIUS * ratio + 3}
              fill="#968D80"
              fontSize="9"
              fontFamily="var(--font-sans)"
            >
              {ring}
            </text>
          </g>
        );
      })}

      {/* Trục chữ thập 4 phương */}
      {AXES.map(({ key, angleDeg }) => {
        const [x, y] = polarToXY(angleDeg, 1);
        return (
          <line
            key={key}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke="rgba(197, 160, 89, 0.26)"
            strokeWidth="1"
          />
        );
      })}

      {/* Đa giác năng lực học viên tông Đỏ Huyết Trầm viền Vàng Xưa */}
      <polygon
        points={polygonStr}
        fill="#8E2933"
        fillOpacity={0.38}
        stroke="#E2C88D"
        strokeWidth="2"
        strokeLinejoin="miter"
      />

      {/* Các đỉnh chạm khắc đồng */}
      {valuePoints.map(([x, y], idx) => (
        <rect
          key={AXES[idx].key}
          x={x - 3}
          y={y - 3}
          width="6"
          height="6"
          transform={`rotate(45 ${x} ${y})`}
          fill="#E2C88D"
          stroke="#090807"
          strokeWidth="1"
        />
      ))}

      {/* Nhãn 4 kỹ năng */}
      {AXES.map(({ key, label, angleDeg }) => {
        const [x, y] = polarToXY(angleDeg, 1.24);
        const anchor = angleDeg === 0 ? 'start' : angleDeg === 180 ? 'end' : 'middle';
        const dy = angleDeg === -90 ? -2 : angleDeg === 90 ? 10 : 4;
        const dx = angleDeg === 0 ? -4 : angleDeg === 180 ? 4 : 0;
        return (
          <text
            key={key}
            x={x + dx}
            y={y + dy}
            textAnchor={anchor}
            fill="#ECE6D8"
            fontSize="11.5"
            fontWeight="500"
            fontFamily="var(--font-sans)"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
