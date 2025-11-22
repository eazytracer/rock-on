import React, { useState } from 'react'
import {
  RoleType,
  RoleDisplayNames,
  MemberCapability,
} from '../../models/SongCasting'
import { TouchButton } from '../common/TouchButton'

export interface RoleSelection {
  type: RoleType
  name: string
  arrangement?: string
  isPrimary: boolean
}

export interface MemberRoleSelection {
  memberId: string
  memberName: string
  roles: RoleSelection[]
  isPrimaryMember: boolean
  confidence: number
  notes?: string
}

interface MemberRoleSelectorProps {
  bandMembers: Array<{ userId: string; name: string }>
  capabilities?: MemberCapability[]
  existingSelection?: MemberRoleSelection
  onSave: (selection: MemberRoleSelection) => void
  onCancel: () => void
  loading?: boolean
}

const ROLE_CATEGORIES: Record<string, RoleType[]> = {
  Vocals: ['vocals_lead', 'vocals_backing', 'vocals_harmony'],
  Guitar: ['guitar_lead', 'guitar_rhythm', 'guitar_acoustic'],
  Bass: ['bass'],
  Drums: ['drums', 'percussion'],
  Keys: ['keys_piano', 'keys_synth', 'keys_organ'],
  Other: ['other'],
}

export const MemberRoleSelector: React.FC<MemberRoleSelectorProps> = ({
  bandMembers,
  capabilities = [],
  existingSelection,
  onSave,
  onCancel,
  loading = false,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    existingSelection?.memberId || ''
  )
  const [selectedRoles, setSelectedRoles] = useState<RoleSelection[]>(
    existingSelection?.roles || []
  )
  const [isPrimaryMember, setIsPrimaryMember] = useState<boolean>(
    existingSelection?.isPrimaryMember ?? true
  )
  const [confidence, setConfidence] = useState<number>(
    existingSelection?.confidence || 3
  )
  const [notes, setNotes] = useState<string>(existingSelection?.notes || '')
  const [arrangementInput, setArrangementInput] = useState<
    Record<string, string>
  >({})

  // Get member's capabilities for the selected member
  const memberCapabilities = selectedMemberId
    ? capabilities.filter(cap => cap.userId === selectedMemberId)
    : []

  // Get capability for a specific role
  const getCapabilityForRole = (
    roleType: RoleType
  ): MemberCapability | undefined => {
    return memberCapabilities.find(cap => cap.roleType === roleType)
  }

  // Get proficiency level display
  const getProficiencyDisplay = (level: 1 | 2 | 3 | 4 | 5): string => {
    const labels = [
      'Beginner',
      'Intermediate',
      'Proficient',
      'Advanced',
      'Expert',
    ]
    return labels[level - 1]
  }

  // Toggle role selection
  const toggleRole = (roleType: RoleType) => {
    const existingIndex = selectedRoles.findIndex(r => r.type === roleType)

    if (existingIndex >= 0) {
      // Remove role
      setSelectedRoles(selectedRoles.filter(r => r.type !== roleType))
    } else {
      // Add role
      const newRole: RoleSelection = {
        type: roleType,
        name: RoleDisplayNames[roleType],
        isPrimary: selectedRoles.length === 0, // First role is primary by default
        arrangement: arrangementInput[roleType] || '',
      }
      setSelectedRoles([...selectedRoles, newRole])
    }
  }

  // Set primary role
  const setPrimaryRole = (roleType: RoleType) => {
    setSelectedRoles(
      selectedRoles.map(role => ({
        ...role,
        isPrimary: role.type === roleType,
      }))
    )
  }

  // Update arrangement for a role
  const updateArrangement = (roleType: RoleType, arrangement: string) => {
    setArrangementInput({ ...arrangementInput, [roleType]: arrangement })
    setSelectedRoles(
      selectedRoles.map(role =>
        role.type === roleType ? { ...role, arrangement } : role
      )
    )
  }

  const handleSave = () => {
    if (!selectedMemberId) {
      alert('Please select a member')
      return
    }

    if (selectedRoles.length === 0) {
      alert('Please select at least one role')
      return
    }

    const selectedMember = bandMembers.find(m => m.userId === selectedMemberId)
    if (!selectedMember) {
      alert('Selected member not found')
      return
    }

    const selection: MemberRoleSelection = {
      memberId: selectedMemberId,
      memberName: selectedMember.name,
      roles: selectedRoles,
      isPrimaryMember,
      confidence,
      notes: notes.trim() || undefined,
    }

    onSave(selection)
  }

  const isRoleSelected = (roleType: RoleType): boolean => {
    return selectedRoles.some(r => r.type === roleType)
  }

  const getRoleInSelection = (
    roleType: RoleType
  ): RoleSelection | undefined => {
    return selectedRoles.find(r => r.type === roleType)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {existingSelection ? 'Edit Assignment' : 'Assign Member to Song'}
      </h3>

      {/* Member Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Member *
        </label>
        <select
          value={selectedMemberId}
          onChange={e => {
            setSelectedMemberId(e.target.value)
            // Reset roles when changing member
            setSelectedRoles([])
          }}
          className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={!!existingSelection || loading}
        >
          <option value="">-- Select a member --</option>
          {bandMembers.map(member => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
      </div>

      {/* Role Selection */}
      {selectedMemberId && (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Roles * (can select multiple)
            </label>
            <div className="space-y-4">
              {Object.entries(ROLE_CATEGORIES).map(([category, roles]) => (
                <div key={category}>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    {category}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {roles.map(roleType => {
                      const capability = getCapabilityForRole(roleType)
                      const selected = isRoleSelected(roleType)
                      const roleSelection = getRoleInSelection(roleType)

                      return (
                        <div key={roleType} className="space-y-2">
                          <button
                            onClick={() => toggleRole(roleType)}
                            className={`w-full min-h-[48px] px-4 py-2 rounded-lg border-2 transition-all text-left touch-manipulation ${
                              selected
                                ? 'border-blue-500 bg-blue-50 text-blue-900'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium">
                                  {RoleDisplayNames[roleType]}
                                </div>
                                {capability && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    {getProficiencyDisplay(
                                      capability.proficiencyLevel
                                    )}
                                    {capability.isPrimary && (
                                      <span className="ml-1 text-blue-600">
                                        ★ Primary
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {selected && (
                                <svg
                                  className="w-5 h-5 text-blue-600"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </div>
                          </button>

                          {/* Arrangement input for selected role */}
                          {selected && (
                            <div className="pl-4 space-y-2">
                              {selectedRoles.length > 1 && (
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    checked={roleSelection?.isPrimary || false}
                                    onChange={() => setPrimaryRole(roleType)}
                                    className="w-4 h-4 text-blue-600"
                                  />
                                  <span className="text-sm text-gray-700">
                                    Primary Role
                                  </span>
                                </label>
                              )}
                              <input
                                type="text"
                                placeholder="Arrangement notes (e.g., Drop D, Capo 2)"
                                value={roleSelection?.arrangement || ''}
                                onChange={e =>
                                  updateArrangement(roleType, e.target.value)
                                }
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Primary Member Toggle */}
          <div className="mb-6">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={isPrimaryMember}
                onChange={e => setIsPrimaryMember(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-700">
                  Primary Assignment
                </div>
                <div className="text-xs text-gray-500">
                  Primary assignments take precedence over backup assignments
                </div>
              </div>
            </label>
          </div>

          {/* Confidence Rating */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Rating *
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="1"
                max="5"
                value={confidence}
                onChange={e => setConfidence(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex items-center space-x-2">
                <span
                  className={`text-lg font-bold ${
                    confidence >= 4
                      ? 'text-green-600'
                      : confidence >= 3
                        ? 'text-yellow-600'
                        : confidence >= 2
                          ? 'text-orange-600'
                          : 'text-red-600'
                  }`}
                >
                  {confidence}
                </span>
                <span className="text-sm text-gray-500">/ 5</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              {confidence === 1 && 'Learning - needs significant practice'}
              {confidence === 2 && 'Developing - can play with mistakes'}
              {confidence === 3 && 'Comfortable - can play through song'}
              {confidence === 4 && 'Confident - ready to perform'}
              {confidence === 5 && 'Expert - can perform with eyes closed'}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Any special notes for this assignment..."
            />
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
        <TouchButton
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSave}
          loading={loading}
          disabled={!selectedMemberId || selectedRoles.length === 0 || loading}
          className="sm:flex-1"
        >
          {existingSelection ? 'Update Assignment' : 'Add Assignment'}
        </TouchButton>
        <TouchButton
          variant="ghost"
          size="lg"
          fullWidth
          onClick={onCancel}
          disabled={loading}
          className="sm:flex-1"
        >
          Cancel
        </TouchButton>
      </div>
    </div>
  )
}
