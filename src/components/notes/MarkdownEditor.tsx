import React, { useState } from 'react'
import { Eye, Edit3 } from 'lucide-react'
import { TouchButton } from '../common/TouchButton'
import { MarkdownRenderer } from './MarkdownRenderer'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  maxLength?: number
  warnAt?: number
}

/**
 * Markdown editor with preview toggle and character limits
 * Warns at 8KB, limits at 10KB by default
 */
export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your notes here... (Markdown supported)',
  className = '',
  minHeight = 'min-h-[200px]',
  maxLength = 10240, // 10KB default
  warnAt = 8192, // 8KB default
}) => {
  const [isPreview, setIsPreview] = useState(false)

  const charCount = value.length
  const isNearLimit = charCount >= warnAt
  const isAtLimit = charCount >= maxLength

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    if (newValue.length <= maxLength) {
      onChange(newValue)
    }
  }

  return (
    <div className={`space-y-2 ${className}`} data-testid="markdown-editor">
      {/* Toggle buttons */}
      <div className="flex gap-2">
        <TouchButton
          variant={!isPreview ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setIsPreview(false)}
          data-testid="markdown-editor-edit-button"
        >
          <Edit3 className="w-4 h-4 mr-2" />
          Edit
        </TouchButton>
        <TouchButton
          variant={isPreview ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setIsPreview(true)}
          data-testid="markdown-editor-preview-button"
        >
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </TouchButton>
      </div>

      {/* Editor or Preview */}
      {!isPreview ? (
        <div className="relative">
          <textarea
            name="markdown-content"
            id="markdown-content"
            data-testid="markdown-editor-textarea"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            className={`
              w-full ${minHeight} p-4 rounded-lg
              bg-steel-gray text-smoke-white
              border border-steel-gray/30
              focus:outline-none focus:ring-2 focus:ring-energy-orange
              placeholder-smoke-white/40
              resize-y
            `}
          />
        </div>
      ) : (
        <div
          className={`
            ${minHeight} p-4 rounded-lg
            bg-steel-gray border border-steel-gray/30
            overflow-y-auto
          `}
          data-testid="markdown-editor-preview"
        >
          {value ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-smoke-white/40 italic">
              Nothing to preview yet...
            </p>
          )}
        </div>
      )}

      {/* Character count */}
      <div
        className={`
          text-sm text-right
          ${isAtLimit ? 'text-amp-red font-semibold' : isNearLimit ? 'text-electric-yellow' : 'text-smoke-white/60'}
        `}
        data-testid="markdown-editor-char-count"
      >
        {charCount.toLocaleString()} / {maxLength.toLocaleString()} characters
        {isNearLimit && !isAtLimit && ' (approaching limit)'}
        {isAtLimit && ' (limit reached)'}
      </div>
    </div>
  )
}
