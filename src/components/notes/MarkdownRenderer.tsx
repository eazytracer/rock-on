import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * Renders markdown content with GitHub Flavored Markdown support
 * Styled for dark theme with prose classes
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
}) => {
  return (
    <div
      className={`prose prose-invert prose-sm max-w-none ${className}`}
      data-testid="markdown-renderer"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-smoke-white mb-4 mt-6">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-smoke-white mb-3 mt-5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-smoke-white mb-2 mt-4">
              {children}
            </h3>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="text-smoke-white/90 mb-4 leading-relaxed">
              {children}
            </p>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-smoke-white/90 mb-4 space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-smoke-white/90 mb-4 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-smoke-white/90">{children}</li>
          ),
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-energy-orange hover:text-energy-orange/80 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Code
          code: ({ children, className }) => {
            const isInline = !className
            if (isInline) {
              return (
                <code className="bg-steel-gray px-1.5 py-0.5 rounded text-electric-yellow text-sm">
                  {children}
                </code>
              )
            }
            return (
              <code className="block bg-steel-gray p-4 rounded-lg text-smoke-white/90 text-sm overflow-x-auto mb-4">
                {children}
              </code>
            )
          },
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-energy-orange pl-4 italic text-smoke-white/80 my-4">
              {children}
            </blockquote>
          ),
          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-bold text-smoke-white">{children}</strong>
          ),
          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic text-smoke-white/90">{children}</em>
          ),
          // Horizontal Rule
          hr: () => <hr className="border-t border-steel-gray/50 my-6" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
