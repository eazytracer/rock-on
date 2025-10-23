import React, { useState } from 'react'
import { X, Tag } from 'lucide-react'

interface NewSongModalProps {
  isOpen: boolean
  onClose: () => void
}

const GUITAR_TUNINGS = [
  'Standard (EADGBE)',
  'Drop D',
  'Drop C',
  'Drop B',
  'Half Step Down',
  'Whole Step Down',
  'Open G',
  'Open D',
  'DADGAD'
]

export const NewSongModal: React.FC<NewSongModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    durationMinutes: '',
    durationSeconds: '',
    bpm: '',
    key: '',
    guitarTuning: '',
    notes: '',
    tags: '',
    externalLink: ''
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted:', formData)
    // TODO: Wire up to database when ready
    onClose()
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white font-medium">Songs</span>
            <span className="text-[#707070]">&gt;</span>
            <span className="text-[#a0a0a0]">New Song</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#707070] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Wonderwall"
                  className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Artist */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">Artist</label>
                <input
                  type="text"
                  value={formData.artist}
                  onChange={(e) => handleChange('artist', e.target.value)}
                  placeholder="Oasis"
                  className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Duration, BPM, Key Row */}
              <div className="grid grid-cols-3 gap-3">
                {/* Duration */}
                <div>
                  <label className="block text-sm text-[#a0a0a0] mb-2">Duration</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={formData.durationMinutes}
                      onChange={(e) => handleChange('durationMinutes', e.target.value)}
                      placeholder="00"
                      className="w-full h-10 px-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm text-center placeholder-[#505050] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="flex items-center text-[#505050]">:</span>
                    <input
                      type="text"
                      value={formData.durationSeconds}
                      onChange={(e) => handleChange('durationSeconds', e.target.value)}
                      placeholder="00"
                      className="w-full h-10 px-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm text-center placeholder-[#505050] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* BPM */}
                <div>
                  <label className="block text-sm text-[#a0a0a0] mb-2">BPM</label>
                  <input
                    type="text"
                    value={formData.bpm}
                    onChange={(e) => handleChange('bpm', e.target.value)}
                    placeholder="120"
                    className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm text-center placeholder-[#505050] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Key */}
                <div>
                  <label className="block text-sm text-[#a0a0a0] mb-2">Key</label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => handleChange('key', e.target.value)}
                    placeholder="F#m"
                    className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm text-center placeholder-[#505050] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm text-[#a0a0a0]">
                    <Tag size={14} />
                    Tags
                  </label>
                  <button
                    type="button"
                    className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    Manage
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                  placeholder="Select tags"
                  className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Guitar Tuning */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">Guitar Tuning</label>
                <select
                  value={formData.guitarTuning}
                  onChange={(e) => handleChange('guitarTuning', e.target.value)}
                  className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="" className="bg-[#1a1a1a]">Standard (EADGBE)</option>
                  {GUITAR_TUNINGS.map(tuning => (
                    <option key={tuning} value={tuning} className="bg-[#1a1a1a]">{tuning}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Band notes here..."
                  rows={4}
                  className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

              {/* External Link(s) */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">External Link(s)</label>
                <input
                  type="text"
                  value={formData.externalLink}
                  onChange={(e) => handleChange('externalLink', e.target.value)}
                  placeholder="https://youtube.com/video"
                  className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-[#2a2a2a]">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              Create Song
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
