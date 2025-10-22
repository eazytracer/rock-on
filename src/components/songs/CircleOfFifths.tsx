import React, { useState } from 'react';

interface CircleOfFifthsProps {
  selectedKey?: string;
  onKeySelect: (key: string) => void;
}

const CircleOfFifths: React.FC<CircleOfFifthsProps> = ({ selectedKey, onKeySelect }) => {
  // Initialize mode based on selected key (if it ends with 'm', it's minor)
  const initialMode = selectedKey && selectedKey.endsWith('m') ? 'minor' : 'major';
  const [mode, setMode] = useState<'major' | 'minor'>(initialMode);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Circle of Fifths order
  const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯/G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
  const minorKeys = ['A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'E♭', 'B♭', 'F', 'C', 'G', 'D'];

  const keys = mode === 'major' ? majorKeys : minorKeys;
  const totalKeys = 12;
  const anglePerKey = 360 / totalKeys;
  const radius = 140;  // Increased from 100
  const centerRadius = 40;  // Increased from 30

  // Create a pie slice path
  const createSlicePath = (index: number, isHovered: boolean) => {
    const startAngle = (index * anglePerKey - 90) * (Math.PI / 180); // -90 to start at top
    const endAngle = ((index + 1) * anglePerKey - 90) * (Math.PI / 180);

    // Use larger radius for hovered slice
    const outerRadius = isHovered ? radius * 1.15 : radius;

    const x1 = centerRadius * Math.cos(startAngle);
    const y1 = centerRadius * Math.sin(startAngle);
    const x2 = outerRadius * Math.cos(startAngle);
    const y2 = outerRadius * Math.sin(startAngle);
    const x3 = outerRadius * Math.cos(endAngle);
    const y3 = outerRadius * Math.sin(endAngle);
    const x4 = centerRadius * Math.cos(endAngle);
    const y4 = centerRadius * Math.sin(endAngle);

    return `M ${x1},${y1} L ${x2},${y2} A ${outerRadius},${outerRadius} 0 0,1 ${x3},${y3} L ${x4},${y4} A ${centerRadius},${centerRadius} 0 0,0 ${x1},${y1} Z`;
  };

  // Get text position for each key
  const getTextPosition = (index: number) => {
    const angle = (index * anglePerKey + anglePerKey / 2 - 90) * (Math.PI / 180);
    const textRadius = (radius + centerRadius) / 2;
    return {
      x: textRadius * Math.cos(angle),
      y: textRadius * Math.sin(angle)
    };
  };

  // Color scheme for keys
  const getSliceColor = (key: string, index: number, isHovered: boolean) => {
    const isSelected = selectedKey === key;

    if (isSelected) {
      return '#3b82f6'; // blue-500
    }
    if (isHovered) {
      return '#60a5fa'; // blue-400
    }

    // Gradient around the circle
    const hue = (index * 30) % 360;
    return `hsl(${hue}, 60%, 65%)`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg
          width="380"
          height="380"
          viewBox="-190 -190 380 380"
          className="touch-manipulation"
        >
          {/* Pie slices */}
          {keys.map((key, index) => {
            const keyWithMode = mode === 'minor' ? `${key}m` : key;
            const isHovered = hoveredIndex === index;
            const isSelected = selectedKey === keyWithMode || selectedKey === key;
            const isDualLabel = key.includes('/');

            return (
              <g key={key}>
                <path
                  d={createSlicePath(index, isHovered)}
                  fill={getSliceColor(key, index, isHovered)}
                  stroke="#fff"
                  strokeWidth="2"
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    filter: isHovered ? 'brightness(1.1)' : 'none',
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => onKeySelect(keyWithMode)}
                />
                <text
                  x={getTextPosition(index).x}
                  y={getTextPosition(index).y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none font-bold"
                  fill={isSelected ? '#fff' : '#1f2937'}
                  fontSize={isHovered ? (isDualLabel ? "14" : "18") : (isDualLabel ? "12" : "16")}
                  style={{ transition: 'font-size 0.2s' }}
                >
                  {key}
                </text>
              </g>
            );
          })}

          {/* Center circle with mode toggle */}
          <circle
            cx="0"
            cy="0"
            r={centerRadius}
            fill="#fff"
            stroke="#3b82f6"
            strokeWidth="3"
            className="cursor-pointer"
            onClick={() => setMode(mode === 'major' ? 'minor' : 'major')}
          />
          <text
            x="0"
            y="0"
            textAnchor="middle"
            dominantBaseline="middle"
            className="pointer-events-none select-none font-bold text-lg"
            fill="#3b82f6"
            fontSize="22"
          >
            {mode === 'major' ? 'Maj' : 'Min'}
          </text>
        </svg>
      </div>

      {selectedKey && (
        <div className="text-sm text-gray-600">
          Selected: <span className="font-bold">{selectedKey}</span>
        </div>
      )}
    </div>
  );
};

export default CircleOfFifths;
