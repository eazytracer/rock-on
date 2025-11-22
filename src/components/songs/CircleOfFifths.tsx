import React, { useState } from 'react'
import { Check } from 'lucide-react'

interface CircleOfFifthsProps {
  selectedKey?: string
  onKeySelect: (key: string) => void
}

const CircleOfFifths: React.FC<CircleOfFifthsProps> = ({
  selectedKey,
  onKeySelect,
}) => {
  // Initialize mode based on selected key (if it ends with 'm', it's minor)
  const initialMode =
    selectedKey && selectedKey.endsWith('m') ? 'minor' : 'major'
  const [mode, setMode] = useState<'major' | 'minor'>(initialMode)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [previewKey, setPreviewKey] = useState<string | null>(
    selectedKey || null
  )
  const [clickedIndex, setClickedIndex] = useState<number | null>(null)

  // Circle of Fifths order
  const majorKeys = [
    'C',
    'G',
    'D',
    'A',
    'E',
    'B',
    'F♯/G♭',
    'D♭',
    'A♭',
    'E♭',
    'B♭',
    'F',
  ]
  const minorKeys = [
    'A',
    'E',
    'B',
    'F♯',
    'C♯',
    'G♯',
    'E♭',
    'B♭',
    'F',
    'C',
    'G',
    'D',
  ]

  const keys = mode === 'major' ? majorKeys : minorKeys
  const totalKeys = 12
  const anglePerKey = 360 / totalKeys
  const radius = 140 // Increased from 100
  const centerRadius = 40 // Increased from 30

  // Create a pie slice path
  const createSlicePath = (
    index: number,
    isHovered: boolean,
    isClicked: boolean
  ) => {
    const startAngle = (index * anglePerKey - 90) * (Math.PI / 180) // -90 to start at top
    const endAngle = ((index + 1) * anglePerKey - 90) * (Math.PI / 180)

    // Use larger radius for hovered or clicked slice
    const outerRadius = isHovered || isClicked ? radius * 1.15 : radius

    const x1 = centerRadius * Math.cos(startAngle)
    const y1 = centerRadius * Math.sin(startAngle)
    const x2 = outerRadius * Math.cos(startAngle)
    const y2 = outerRadius * Math.sin(startAngle)
    const x3 = outerRadius * Math.cos(endAngle)
    const y3 = outerRadius * Math.sin(endAngle)
    const x4 = centerRadius * Math.cos(endAngle)
    const y4 = centerRadius * Math.sin(endAngle)

    return `M ${x1},${y1} L ${x2},${y2} A ${outerRadius},${outerRadius} 0 0,1 ${x3},${y3} L ${x4},${y4} A ${centerRadius},${centerRadius} 0 0,0 ${x1},${y1} Z`
  }

  // Get text position for each key
  const getTextPosition = (index: number) => {
    const angle = (index * anglePerKey + anglePerKey / 2 - 90) * (Math.PI / 180)
    const textRadius = (radius + centerRadius) / 2
    return {
      x: textRadius * Math.cos(angle),
      y: textRadius * Math.sin(angle),
    }
  }

  // Color scheme for keys - updated to match app theme
  const getSliceColor = (
    keyWithMode: string,
    index: number,
    isHovered: boolean
  ) => {
    const isPreview = previewKey === keyWithMode
    const isSelected = selectedKey === keyWithMode

    if (isSelected && isPreview) {
      return '#f17827ff' // App's primary orange accent - confirmed selection
    }
    if (isPreview) {
      return '#ff9447' // Lighter orange for preview/pending selection
    }
    if (isHovered) {
      return '#ff9447' // Lighter orange on hover
    }

    // Subtle gradient around the circle with muted tones
    const hue = (index * 30) % 360
    return `hsl(${hue}, 40%, 45%)` // More muted colors
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]">
      <div className="relative w-full max-w-[min(350px,90vw)] sm:max-w-[380px]">
        <svg
          width="100%"
          height="100%"
          viewBox="-190 -190 380 380"
          className="touch-manipulation"
          style={{ aspectRatio: '1' }}
        >
          {/* Pie slices */}
          {keys.map((key, index) => {
            const keyWithMode = mode === 'minor' ? `${key}m` : key
            const isHovered = hoveredIndex === index
            const isClicked = clickedIndex === index
            const isSelected =
              selectedKey === keyWithMode || selectedKey === key
            const isDualLabel = key.includes('/')

            return (
              <g key={key}>
                <path
                  d={createSlicePath(index, isHovered, isClicked)}
                  fill={getSliceColor(keyWithMode, index, isHovered)}
                  stroke="#2a2a2a"
                  strokeWidth="2"
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    filter: isHovered || isClicked ? 'brightness(1.2)' : 'none',
                  }}
                  data-testid={`key-picker-${keyWithMode}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => {
                    setPreviewKey(keyWithMode)
                    // Clear hover state for mobile
                    setHoveredIndex(null)
                    // Trigger click animation
                    setClickedIndex(index)
                    setTimeout(() => setClickedIndex(null), 200)
                  }}
                  onTouchStart={() => {
                    // For touch devices, clear hover and trigger click animation
                    setHoveredIndex(null)
                    setClickedIndex(index)
                  }}
                  onTouchEnd={() => {
                    setPreviewKey(keyWithMode)
                    setTimeout(() => setClickedIndex(null), 200)
                  }}
                />
                <text
                  x={getTextPosition(index).x}
                  y={getTextPosition(index).y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none font-bold"
                  fill={
                    (isSelected && previewKey === keyWithMode) ||
                    previewKey === keyWithMode
                      ? '#ffffff'
                      : '#e0e0e0'
                  }
                  fontSize={
                    isHovered
                      ? isDualLabel
                        ? '14'
                        : '18'
                      : isDualLabel
                        ? '12'
                        : '16'
                  }
                  style={{ transition: 'font-size 0.2s' }}
                >
                  {key}
                </text>
              </g>
            )
          })}

          {/* Center circle with mode toggle */}
          <circle
            cx="0"
            cy="0"
            r={centerRadius}
            fill="#1a1a1a"
            stroke="#f17827ff"
            strokeWidth="3"
            className="cursor-pointer transition-all duration-200 hover:fill-[#252525]"
            onClick={() => setMode(mode === 'major' ? 'minor' : 'major')}
          />
          <text
            x="0"
            y="0"
            textAnchor="middle"
            dominantBaseline="middle"
            className="pointer-events-none select-none font-bold text-lg"
            fill="#f17827ff"
            fontSize="22"
          >
            {mode === 'major' ? 'Maj' : 'Min'}
          </text>
        </svg>
      </div>

      {/* Preview and Confirmation */}
      <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4 min-h-[48px] w-full">
        <div className="flex-1 text-center sm:text-left w-full sm:w-auto">
          {previewKey ? (
            <div className="text-sm text-[#a0a0a0]">
              Selected Key:{' '}
              <span className="font-bold text-white text-lg">{previewKey}</span>
            </div>
          ) : (
            <div className="text-xs text-[#707070]">Click a key to select</div>
          )}
        </div>

        {previewKey && (
          <button
            data-testid="key-picker-confirm"
            onClick={() => onKeySelect(previewKey)}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#f17827ff] hover:bg-[#d66620] text-white text-sm font-medium rounded-lg transition-colors w-full sm:w-auto"
          >
            <Check size={18} />
            <span>Confirm</span>
          </button>
        )}
      </div>

      <div className="text-xs text-[#707070] text-center pt-2 border-t border-[#2a2a2a] w-full">
        Center circle toggles major/minor
      </div>
    </div>
  )
}

export default CircleOfFifths
