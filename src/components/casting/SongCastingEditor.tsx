/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react'
import { Song } from '../../models/Song'
import {
  SongCasting,
  SongAssignment,
  AssignmentRole,
  RoleDisplayNames,
  MemberCapability,
  CastingSuggestion,
} from '../../models/SongCasting'
import { MemberRoleSelector, MemberRoleSelection } from './MemberRoleSelector'
import { TouchButton } from '../common/TouchButton'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { castingService } from '../../services/CastingService'
import { memberCapabilityService } from '../../services/MemberCapabilityService'
import { castingSuggestionService } from '../../services/casting/CastingSuggestionService'

interface CompleteCasting {
  casting: SongCasting
  assignments: Array<{
    assignment: SongAssignment
    roles: AssignmentRole[]
    memberName: string
  }>
}

interface SongCastingEditorProps {
  song: Song
  bandMembers: Array<{ userId: string; name: string }>
  bandId: string
  contextType: 'setlist' | 'session' | 'template'
  contextId: string
  existingCasting?: CompleteCasting
  onSave?: () => void
  onClose?: () => void
}

type ViewMode = 'view' | 'add' | 'edit' | 'suggestions'

export const SongCastingEditor: React.FC<SongCastingEditorProps> = ({
  song,
  bandMembers,
  bandId,
  contextType,
  contextId,
  existingCasting,
  onSave,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('view')
  const [casting, setCasting] = useState<CompleteCasting | null>(
    existingCasting || null
  )
  const [capabilities, setCapabilities] = useState<MemberCapability[]>([])
  const [suggestions, setSuggestions] = useState<CastingSuggestion[]>([])
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Load member capabilities on mount
  useEffect(() => {
    loadCapabilities()
  }, [bandId])

  // Load casting if it exists
  useEffect(() => {
    if (!existingCasting && song.id) {
      loadExistingCasting()
    }
  }, [song.id, contextType, contextId])

  const loadCapabilities = async () => {
    try {
      const caps: MemberCapability[] = []
      for (const member of bandMembers) {
        const memberCaps = await memberCapabilityService.getMemberCapabilities(
          member.userId,
          bandId
        )
        caps.push(...memberCaps)
      }
      setCapabilities(caps)
    } catch (error) {
      console.error('Failed to load capabilities:', error)
    }
  }

  const loadExistingCasting = async () => {
    if (!song.id) return

    try {
      // Check if casting exists for this song in this context
      const songIdNum = parseInt(song.id, 10)
      const allCastings = await castingService.getCastingsForContext(
        contextType,
        contextId
      )
      const songCasting = allCastings.find((c: any) => c.songId === songIdNum)

      if (songCasting && songCasting.id) {
        const complete = await castingService.getCompleteCasting(songCasting.id)
        if (complete) {
          // Transform to CompleteCasting format with member names
          const assignments = await Promise.all(
            complete.assignments.map(async (assignment: any) => {
              const member = bandMembers.find(
                m => m.userId === assignment.memberId
              )
              return {
                assignment,
                roles: assignment.roles || [],
                memberName: member?.name || 'Unknown',
              }
            })
          )

          setCasting({
            casting: songCasting,
            assignments,
          })
        }
      }
    } catch (error) {
      console.error('Failed to load existing casting:', error)
    }
  }

  const loadSuggestions = async () => {
    if (!song.id) return

    setLoadingSuggestions(true)
    try {
      const songIdNum = parseInt(song.id, 10)
      const contextTypeMap = {
        setlist: 'electric' as const,
        session: 'practice' as const,
        template: 'electric' as const,
      }
      const suggestedCasting =
        await castingSuggestionService.getSuggestionsForSong(
          songIdNum,
          bandId,
          contextTypeMap[contextType]
        )
      setSuggestions(suggestedCasting)
      setViewMode('suggestions')
    } catch (error) {
      console.error('Failed to load suggestions:', error)
      alert('Failed to load casting suggestions')
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const createCasting = async (userId: string): Promise<number | null> => {
    if (!song.id) return null

    try {
      const songIdNum = parseInt(song.id, 10)
      const castingId = await castingService.createCasting({
        contextType,
        contextId,
        songId: songIdNum,
        createdBy: userId,
        createdDate: new Date(),
        notes: '',
      })
      return castingId
    } catch (error) {
      console.error('Failed to create casting:', error)
      alert('Failed to create casting')
      return null
    }
  }

  const handleAddAssignment = async (selection: MemberRoleSelection) => {
    setLoading(true)
    try {
      // Get or create casting
      let castingId = casting?.casting.id
      if (!castingId) {
        const newCastingId = await createCasting(selection.memberId)
        if (!newCastingId) {
          setLoading(false)
          return
        }
        castingId = newCastingId
      }

      // Add assignment
      const assignmentId = await castingService.assignMember(
        castingId,
        selection.memberId,
        selection.roles,
        selection.isPrimaryMember,
        selection.confidence,
        selection.notes,
        selection.memberId
      )

      if (assignmentId) {
        // Reload casting
        await loadExistingCasting()
        setViewMode('view')
        onSave?.()
      }
    } catch (error) {
      console.error('Failed to add assignment:', error)
      alert('Failed to add assignment')
    } finally {
      setLoading(false)
    }
  }

  const handleEditAssignment = async (selection: MemberRoleSelection) => {
    if (!editingAssignmentId) return

    setLoading(true)
    try {
      // Update confidence and notes
      await castingService.updateAssignment(editingAssignmentId, {
        confidence: selection.confidence,
        notes: selection.notes,
      })

      // TODO: Update roles - would need additional service methods
      // For now, just reload

      await loadExistingCasting()
      setViewMode('view')
      setEditingAssignmentId(null)
      onSave?.()
    } catch (error) {
      console.error('Failed to update assignment:', error)
      alert('Failed to update assignment')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAssignment = async (assignmentId: number) => {
    const confirmed = window.confirm(
      'Are you sure you want to remove this assignment?'
    )
    if (!confirmed) return

    setLoading(true)
    try {
      // Get the casting to find member ID
      const assignment = casting?.assignments.find(
        a => a.assignment.id === assignmentId
      )
      if (assignment && casting?.casting.id) {
        await castingService.unassignMember(
          casting.casting.id,
          assignment.assignment.memberId
        )
      }
      await loadExistingCasting()
      onSave?.()
    } catch (error) {
      console.error('Failed to remove assignment:', error)
      alert('Failed to remove assignment')
    } finally {
      setLoading(false)
    }
  }

  const handleApplySuggestion = async (suggestion: CastingSuggestion) => {
    const member = bandMembers.find(m => m.userId === suggestion.memberId)
    if (!member) return

    const selection: MemberRoleSelection = {
      memberId: suggestion.memberId,
      memberName: member.name,
      roles: [
        {
          type: suggestion.roleType,
          name: RoleDisplayNames[suggestion.roleType],
          isPrimary: suggestion.isPrimary,
          arrangement: '',
        },
      ],
      isPrimaryMember: suggestion.isPrimary,
      confidence: Math.round(suggestion.confidence * 5), // Convert 0-1 to 1-5
      notes: suggestion.reason,
    }

    await handleAddAssignment(selection)
  }

  const getAssignedMemberIds = (): string[] => {
    return casting?.assignments.map(a => a.assignment.memberId) || []
  }

  const getEditingSelection = (): MemberRoleSelection | undefined => {
    if (!editingAssignmentId || !casting) return undefined

    const assignment = casting.assignments.find(
      a => a.assignment.id === editingAssignmentId
    )
    if (!assignment) return undefined

    return {
      memberId: assignment.assignment.memberId,
      memberName: assignment.memberName,
      roles: assignment.roles.map(r => ({
        type: r.type,
        name: r.name,
        arrangement: r.arrangement,
        isPrimary: r.isPrimary,
      })),
      isPrimaryMember: assignment.assignment.isPrimary,
      confidence: assignment.assignment.confidence,
      notes: assignment.assignment.notes,
    }
  }

  // View Mode: Show casting summary and assignments
  if (viewMode === 'view') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {song.title}
              </h3>
              <p className="text-sm text-gray-600">{song.artist}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                  {song.key}
                </span>
                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                  {song.bpm} BPM
                </span>
                {song.guitarTuning && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {song.guitarTuning}
                  </span>
                )}
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Assignments */}
        <div className="p-6">
          {casting && casting.assignments.length > 0 ? (
            <div className="space-y-3 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase">
                Assigned Members ({casting.assignments.length})
              </h4>
              {casting.assignments.map(({ assignment, roles, memberName }) => (
                <div
                  key={assignment.id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-medium text-gray-900">
                          {memberName}
                        </h5>
                        {assignment.isPrimary && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            assignment.confidence >= 4
                              ? 'bg-green-100 text-green-800'
                              : assignment.confidence >= 3
                                ? 'bg-yellow-100 text-yellow-800'
                                : assignment.confidence >= 2
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-red-100 text-red-800'
                          }`}
                        >
                          Confidence: {assignment.confidence}/5
                        </span>
                      </div>
                      <div className="space-y-1">
                        {roles.map(role => (
                          <div
                            key={role.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span
                              className={`font-medium ${role.isPrimary ? 'text-blue-600' : 'text-gray-700'}`}
                            >
                              {role.name}
                              {role.isPrimary && ' ★'}
                            </span>
                            {role.arrangement && (
                              <span className="text-gray-500 text-xs">
                                ({role.arrangement})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {assignment.notes && (
                        <p className="text-sm text-gray-600 mt-2 italic">
                          {assignment.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-4">
                      <button
                        onClick={() => {
                          setEditingAssignmentId(assignment.id!)
                          setViewMode('edit')
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                        aria-label="Edit assignment"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveAssignment(assignment.id!)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                        aria-label="Remove assignment"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 mb-4">
              <svg
                className="mx-auto h-12 w-12 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p>No members assigned yet</p>
              <p className="text-sm mt-1">
                Add members to assign roles for this song
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <TouchButton
              variant="primary"
              size="md"
              fullWidth
              onClick={() => setViewMode('add')}
            >
              Add Member
            </TouchButton>
            <TouchButton
              variant="secondary"
              size="md"
              fullWidth
              onClick={loadSuggestions}
              loading={loadingSuggestions}
            >
              Get Suggestions
            </TouchButton>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
            <LoadingSpinner size="lg" text="Updating casting..." />
          </div>
        )}
      </div>
    )
  }

  // Add Mode: Show MemberRoleSelector
  if (viewMode === 'add') {
    return (
      <MemberRoleSelector
        bandMembers={bandMembers.filter(
          m => !getAssignedMemberIds().includes(m.userId)
        )}
        capabilities={capabilities}
        onSave={handleAddAssignment}
        onCancel={() => setViewMode('view')}
        loading={loading}
      />
    )
  }

  // Edit Mode: Show MemberRoleSelector with existing selection
  if (viewMode === 'edit') {
    const existingSelection = getEditingSelection()
    if (!existingSelection) {
      setViewMode('view')
      return null
    }

    return (
      <MemberRoleSelector
        bandMembers={bandMembers}
        capabilities={capabilities}
        existingSelection={existingSelection}
        onSave={handleEditAssignment}
        onCancel={() => {
          setViewMode('view')
          setEditingAssignmentId(null)
        }}
        loading={loading}
      />
    )
  }

  // Suggestions Mode: Show AI suggestions
  if (viewMode === 'suggestions') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Casting Suggestions
          </h3>
          <TouchButton
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('view')}
          >
            ← Back
          </TouchButton>
        </div>

        {suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => {
              const member = bandMembers.find(
                m => m.userId === suggestion.memberId
              )
              if (!member) return null

              return (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-medium text-gray-900">
                          {member.name}
                        </h5>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {RoleDisplayNames[suggestion.roleType]}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            suggestion.confidence >= 0.8
                              ? 'bg-green-100 text-green-800'
                              : suggestion.confidence >= 0.6
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {Math.round(suggestion.confidence * 100)}% match
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {suggestion.reason}
                      </p>
                    </div>
                    <TouchButton
                      variant="primary"
                      size="sm"
                      onClick={() => handleApplySuggestion(suggestion)}
                      loading={loading}
                    >
                      Apply
                    </TouchButton>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No suggestions available</p>
            <p className="text-sm mt-1">
              Add member capabilities to get better suggestions
            </p>
          </div>
        )}
      </div>
    )
  }

  return null
}
