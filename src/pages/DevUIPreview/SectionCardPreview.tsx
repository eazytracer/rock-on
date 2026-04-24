/**
 * SectionCardPreview — shows the proposed <SectionCard> unification.
 *
 * Currently, SetlistView / ShowView / PracticeView each rebuild the same
 * "dark card with section heading" pattern. This demo shows before/after.
 */

import React from 'react'
import { FileText, Clock, MapPin } from 'lucide-react'

// Proposed shared component (inline for the preview)
interface SectionCardProps {
  title?: string
  children: React.ReactNode
  className?: string
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  children,
  className = '',
}) => {
  return (
    <div
      className={`bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6 ${className}`}
    >
      {title && (
        <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      )}
      {children}
    </div>
  )
}

export const SectionCardPreview: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Before */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-300 rounded border border-red-500/30">
              BEFORE
            </span>
            <span className="text-[#a0a0a0] text-sm">
              Hand-rolled in each page (3+ copies)
            </span>
          </div>

          {/* Replicating PracticeViewPage pattern inline */}
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MockField
                icon={<Clock size={16} />}
                label="Duration"
                value="2h"
              />
              <MockField
                icon={<MapPin size={16} />}
                label="Location"
                value="Studio B"
              />
            </div>
          </div>

          <div className="mt-4 bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Wrap-up Notes
            </h2>
            <p className="text-sm text-[#707070]">
              Capture your thoughts after the practice...
            </p>
          </div>

          <pre className="mt-4 p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-xs text-[#a0a0a0] overflow-x-auto">
            {`<div className="bg-[#121212] border
     border-[#2a2a2a] rounded-lg
     p-4 sm:p-6">
  <h2 className="text-lg font-semibold
       text-white mb-4">Details</h2>
  ...
</div>`}
          </pre>
        </section>

        {/* After */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-300 rounded border border-green-500/30">
              AFTER
            </span>
            <span className="text-[#a0a0a0] text-sm">
              Shared &lt;SectionCard&gt; component
            </span>
          </div>

          <SectionCard title="Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MockField
                icon={<Clock size={16} />}
                label="Duration"
                value="2h"
              />
              <MockField
                icon={<MapPin size={16} />}
                label="Location"
                value="Studio B"
              />
            </div>
          </SectionCard>

          <div className="mt-4" />
          <SectionCard title="Wrap-up Notes">
            <p className="text-sm text-[#707070]">
              Capture your thoughts after the practice...
            </p>
          </SectionCard>

          <pre className="mt-4 p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-xs text-[#a0a0a0] overflow-x-auto">
            {`<SectionCard title="Details">
  ...
</SectionCard>`}
          </pre>
        </section>
      </div>

      {/* Benefits summary */}
      <section className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <FileText size={18} className="text-[#f17827ff]" />
          Extraction impact
        </h3>
        <ul className="text-sm text-[#a0a0a0] space-y-2 list-disc list-inside">
          <li>
            <span className="text-white">~9 duplicated blocks</span> collapse to
            one component (PracticeView details + wrap-up, ShowView details,
            SetlistView details, BandMembers, Settings sections, etc.)
          </li>
          <li>
            Typography / spacing normalized — today <code>h2</code> weight and
            margins drift between pages
          </li>
          <li>
            Accepts optional <code>title</code>, <code>className</code>,
            <code>actions</code> slot for per-section buttons (e.g. "Edit" on
            the right of a heading)
          </li>
          <li>
            Sibling proposal: <code>SongSection</code> (a SectionCard + sortable
            song list + Add button) addresses the larger setlist/show/practice
            duplication
          </li>
        </ul>
      </section>
    </div>
  )
}

// ---- Local helpers (preview only) ----

const MockField: React.FC<{
  icon: React.ReactNode
  label: string
  value: string
}> = ({ icon, label, value }) => (
  <div>
    <div className="flex items-center gap-2 text-xs text-[#707070] mb-1">
      {icon}
      <span>{label}</span>
    </div>
    <div className="text-white">{value}</div>
  </div>
)
