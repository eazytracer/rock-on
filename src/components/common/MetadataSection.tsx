import React from 'react'

interface MetadataSectionProps {
  title?: string
  children: React.ReactNode
  columns?: 1 | 2 | 3
  className?: string
}

export const MetadataSection: React.FC<MetadataSectionProps> = ({
  title,
  children,
  columns = 2,
  className = '',
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  }

  return (
    <div
      className={`bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6 ${className}`}
    >
      {title && (
        <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      )}
      <div className={`grid ${gridCols[columns]} gap-4 sm:gap-6`}>
        {children}
      </div>
    </div>
  )
}

// Divider for separating sections within MetadataSection
export const MetadataDivider: React.FC = () => (
  <div className="col-span-full border-t border-[#2a2a2a] my-2" />
)

// Full-width field wrapper for fields that span all columns
interface FullWidthFieldProps {
  children: React.ReactNode
}

export const FullWidthField: React.FC<FullWidthFieldProps> = ({ children }) => (
  <div className="col-span-full">{children}</div>
)
