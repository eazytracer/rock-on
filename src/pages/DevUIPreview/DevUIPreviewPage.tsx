/**
 * Dev-only UI preview page.
 *
 * Mounted at /dev/ui-preview (outside the authenticated layout). Contains
 * proposed component previews for the UI unification pass documented in
 * .claude/artifacts/2026-04-22T20:57_ui-unification-and-cleanup-assessment.md
 *
 * Do NOT import from this directory anywhere in the production app. All
 * components here are drafts and will be moved/rewritten when approved.
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Monitor,
  Palette,
  FileText,
  LayoutGrid,
  AlertCircle,
} from 'lucide-react'
import { PracticeSessionPreview } from './PracticeSessionPreview'
import { TuningTreatmentPreview } from './TuningTreatmentPreview'
import { MarkdownFieldPreview } from './MarkdownFieldPreview'
import { UnsavedChangesPreview } from './UnsavedChangesPreview'
import { SectionCardPreview } from './SectionCardPreview'

type TabKey = 'practice' | 'tunings' | 'markdown' | 'unsaved' | 'sections'

interface Tab {
  key: TabKey
  label: string
  icon: React.ReactNode
  description: string
}

const TABS: Tab[] = [
  {
    key: 'practice',
    label: 'Practice Viewer',
    icon: <Monitor size={16} />,
    description: 'TV / tablet / mobile layouts with font size toggle',
  },
  {
    key: 'tunings',
    label: 'Tuning Colors',
    icon: <Palette size={16} />,
    description: '4 treatments × 3 palettes on a mixed-tuning setlist',
  },
  {
    key: 'markdown',
    label: 'Markdown Field',
    icon: <FileText size={16} />,
    description: 'Render → pencil edit → click-out save pattern',
  },
  {
    key: 'unsaved',
    label: 'Unsaved Changes',
    icon: <AlertCircle size={16} />,
    description: 'Blocking confirm dialog for modals and edit flows',
  },
  {
    key: 'sections',
    label: 'Section Card',
    icon: <LayoutGrid size={16} />,
    description: 'Before/after unified card extraction',
  },
]

export const DevUIPreviewPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('practice')

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dev/dashboard"
              className="flex items-center gap-2 text-[#a0a0a0] hover:text-white transition-colors text-sm"
              data-testid="ui-preview-back-link"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Dev Dashboard</span>
            </Link>
            <div className="h-5 w-px bg-[#2a2a2a]" />
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-base sm:text-lg truncate">
                UI Unification Preview
              </h1>
              <p className="text-[#707070] text-xs truncate">
                Design sandbox — not wired to real data
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-[#707070]">
            <span className="px-2 py-1 bg-[#f17827ff]/10 text-[#f17827ff] rounded border border-[#f17827ff]/30">
              DRAFT
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto custom-scrollbar-thin">
          <div className="flex items-center gap-1 min-w-max">
            {TABS.map(tab => {
              const isActive = tab.key === activeTab
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  data-testid={`ui-preview-tab-${tab.key}`}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-[#f17827ff] border-[#f17827ff]'
                      : 'text-[#a0a0a0] border-transparent hover:text-white hover:border-[#3a3a3a]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </header>

      {/* Active tab description */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <p className="text-[#a0a0a0] text-sm">
          {TABS.find(t => t.key === activeTab)?.description}
        </p>
      </div>

      {/* Tab content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'practice' && <PracticeSessionPreview />}
        {activeTab === 'tunings' && <TuningTreatmentPreview />}
        {activeTab === 'markdown' && <MarkdownFieldPreview />}
        {activeTab === 'unsaved' && <UnsavedChangesPreview />}
        {activeTab === 'sections' && <SectionCardPreview />}
      </main>
    </div>
  )
}

export default DevUIPreviewPage
