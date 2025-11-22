import React, { useState, useEffect } from 'react'
import { Song } from '../../models/Song'
import {
  SongCasting,
  SongAssignment,
  AssignmentRole,
} from '../../models/SongCasting'
import { TouchButton } from '../common/TouchButton'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { castingService } from '../../services/CastingService'

interface Context {
  type: 'setlist' | 'session' | 'template'
  id: string
  name: string
}

interface CastingComparisonProps {
  availableContexts: Context[]
  songs: Song[]
  bandMembers: Array<{ userId: string; name: string }>
  onClose?: () => void
}

interface SongCastingData {
  casting?: SongCasting
  assignments: Array<{
    assignment: SongAssignment
    roles: AssignmentRole[]
    memberName: string
  }>
}

interface ComparisonData {
  songId: number
  songTitle: string
  songArtist: string
  context1Data: SongCastingData | null
  context2Data: SongCastingData | null
  hasDifferences: boolean
}

export const CastingComparison: React.FC<CastingComparisonProps> = ({
  availableContexts,
  songs,
  bandMembers,
  onClose,
}) => {
  const [context1, setContext1] = useState<Context | null>(null)
  const [context2, setContext2] = useState<Context | null>(null)
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([])
  const [loading, setLoading] = useState(false)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    if (context1 && context2) {
      loadComparisonData()
    }
  }, [context1, context2])

  const loadComparisonData = async () => {
    if (!context1 || !context2) return

    setLoading(true)
    try {
      // Get all castings for both contexts
      const castings1 = await castingService.getCastingsForContext(
        context1.type,
        context1.id
      )
      const castings2 = await castingService.getCastingsForContext(
        context2.type,
        context2.id
      )

      // Get all unique song IDs from both contexts
      const allSongIds = new Set([
        ...castings1.map((c: any) => c.songId),
        ...castings2.map((c: any) => c.songId),
      ])

      // Build comparison data
      const comparisons: ComparisonData[] = []

      for (const songId of allSongIds) {
        const song = songs.find(s => parseInt(s.id, 10) === songId)
        if (!song) continue

        const casting1 = castings1.find((c: any) => c.songId === songId)
        const casting2 = castings2.find((c: any) => c.songId === songId)

        const data1 = await loadCastingData(casting1)
        const data2 = await loadCastingData(casting2)

        const hasDifferences = checkForDifferences(data1, data2)

        comparisons.push({
          songId,
          songTitle: song.title,
          songArtist: song.artist,
          context1Data: data1,
          context2Data: data2,
          hasDifferences,
        })
      }

      setComparisonData(comparisons)
    } catch (error) {
      console.error('Failed to load comparison data:', error)
      alert('Failed to load comparison data')
    } finally {
      setLoading(false)
    }
  }

  const loadCastingData = async (
    casting?: SongCasting
  ): Promise<SongCastingData | null> => {
    if (!casting || !casting.id) return null

    try {
      const complete = await castingService.getCompleteCasting(casting.id)
      if (!complete) return null

      const assignmentsWithRoles = complete.assignments.map(
        (assignment: any) => {
          const member = bandMembers.find(m => m.userId === assignment.memberId)
          const assignmentRoles = assignment.roles || []

          return {
            assignment,
            roles: assignmentRoles,
            memberName: member?.name || 'Unknown',
          }
        }
      )

      return {
        casting,
        assignments: assignmentsWithRoles,
      }
    } catch (error) {
      console.error('Failed to load casting data:', error)
      return null
    }
  }

  const checkForDifferences = (
    data1: SongCastingData | null,
    data2: SongCastingData | null
  ): boolean => {
    // If one has casting and the other doesn't, they're different
    if ((!data1 && data2) || (data1 && !data2)) return true
    if (!data1 && !data2) return false

    // Compare number of assignments
    if (data1!.assignments.length !== data2!.assignments.length) return true

    // Compare member IDs (simplified check)
    const memberIds1 = new Set(
      data1!.assignments.map(a => a.assignment.memberId)
    )
    const memberIds2 = new Set(
      data2!.assignments.map(a => a.assignment.memberId)
    )

    if (memberIds1.size !== memberIds2.size) return true

    for (const id of memberIds1) {
      if (!memberIds2.has(id)) return true
    }

    return false
  }

  const handleCopyCasting = async (
    fromContext: Context,
    toContext: Context,
    songId: number
  ) => {
    const confirmed = window.confirm(
      `Copy casting for this song from "${fromContext.name}" to "${toContext.name}"?`
    )
    if (!confirmed) return

    setCopying(true)
    try {
      // Get the casting from source context
      const sourceCastings = await castingService.getCastingsForContext(
        fromContext.type,
        fromContext.id
      )
      const sourceCasting = sourceCastings.find((c: any) => c.songId === songId)

      if (!sourceCasting || !sourceCasting.id) {
        alert('Source casting not found')
        return
      }

      // Copy the casting manually
      // For now, this is a simplified version - a real implementation would
      // copy all assignments and roles
      alert(
        'Copying individual song casting is not yet fully implemented. Use "Copy All" instead.'
      )
      return

      // Reload comparison data
      await loadComparisonData()
      alert('Casting copied successfully!')
    } catch (error) {
      console.error('Failed to copy casting:', error)
      alert('Failed to copy casting')
    } finally {
      setCopying(false)
    }
  }

  const handleCopyAllCasting = async (
    fromContext: Context,
    toContext: Context
  ) => {
    const confirmed = window.confirm(
      `Copy ALL casting from "${fromContext.name}" to "${toContext.name}"? This will overwrite existing casting.`
    )
    if (!confirmed) return

    setCopying(true)
    try {
      await castingService.copyCasting(
        fromContext.type,
        fromContext.id,
        toContext.type,
        toContext.id,
        bandMembers[0]?.userId || 'system'
      )

      await loadComparisonData()
      alert('All casting copied successfully!')
    } catch (error) {
      console.error('Failed to copy all casting:', error)
      alert('Failed to copy all casting')
    } finally {
      setCopying(false)
    }
  }

  const getDifferenceCount = (): number => {
    return comparisonData.filter(d => d.hasDifferences).length
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Compare Casting
          </h2>
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

      {/* Context Selection */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Context 1
            </label>
            <select
              value={context1?.id || ''}
              onChange={e => {
                const selected = availableContexts.find(
                  c => c.id === e.target.value
                )
                setContext1(selected || null)
              }}
              className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select context --</option>
              {availableContexts.map(context => (
                <option
                  key={context.id}
                  value={context.id}
                  disabled={context.id === context2?.id}
                >
                  {context.name} ({context.type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Context 2
            </label>
            <select
              value={context2?.id || ''}
              onChange={e => {
                const selected = availableContexts.find(
                  c => c.id === e.target.value
                )
                setContext2(selected || null)
              }}
              className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select context --</option>
              {availableContexts.map(context => (
                <option
                  key={context.id}
                  value={context.id}
                  disabled={context.id === context1?.id}
                >
                  {context.name} ({context.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {context1 && context2 && (
          <div className="mt-4 flex gap-2">
            <TouchButton
              variant="secondary"
              size="sm"
              onClick={() => handleCopyAllCasting(context1, context2)}
              loading={copying}
            >
              Copy All from {context1.name} →
            </TouchButton>
            <TouchButton
              variant="secondary"
              size="sm"
              onClick={() => handleCopyAllCasting(context2, context1)}
              loading={copying}
            >
              ← Copy All from {context2.name}
            </TouchButton>
          </div>
        )}
      </div>

      {/* Comparison Results */}
      <div className="p-6">
        {loading ? (
          <div className="py-12">
            <LoadingSpinner size="lg" centered text="Loading comparison..." />
          </div>
        ) : context1 && context2 ? (
          <>
            {/* Summary */}
            {comparisonData.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-blue-900">
                      Comparing {comparisonData.length} song
                      {comparisonData.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-blue-700 mt-1">
                      {getDifferenceCount()} difference
                      {getDifferenceCount() !== 1 ? 's' : ''} found
                    </div>
                  </div>
                  <svg
                    className="w-8 h-8 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* Comparison Table */}
            <div className="space-y-4">
              {comparisonData.map(comparison => (
                <div
                  key={comparison.songId}
                  className={`border rounded-lg overflow-hidden ${
                    comparison.hasDifferences
                      ? 'border-yellow-300 bg-yellow-50'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Song Header */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {comparison.songTitle}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {comparison.songArtist}
                        </p>
                      </div>
                      {comparison.hasDifferences && (
                        <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                          Different
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Context 1 */}
                    <div className="p-4 border-b md:border-b-0 md:border-r border-gray-200">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">
                        {context1.name}
                      </h5>
                      {comparison.context1Data ? (
                        <div className="space-y-2">
                          {comparison.context1Data.assignments.map(
                            ({ assignment, roles, memberName }) => (
                              <div key={assignment.id} className="text-sm">
                                <div className="font-medium text-gray-900">
                                  {memberName}
                                </div>
                                <div className="text-gray-600 ml-2">
                                  {roles.map(r => r.name).join(', ')}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          No casting
                        </p>
                      )}
                      {comparison.context1Data && comparison.hasDifferences && (
                        <TouchButton
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopyCasting(
                              context1,
                              context2,
                              comparison.songId
                            )
                          }
                          loading={copying}
                          className="mt-3"
                        >
                          Copy to {context2.name} →
                        </TouchButton>
                      )}
                    </div>

                    {/* Context 2 */}
                    <div className="p-4">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">
                        {context2.name}
                      </h5>
                      {comparison.context2Data ? (
                        <div className="space-y-2">
                          {comparison.context2Data.assignments.map(
                            ({ assignment, roles, memberName }) => (
                              <div key={assignment.id} className="text-sm">
                                <div className="font-medium text-gray-900">
                                  {memberName}
                                </div>
                                <div className="text-gray-600 ml-2">
                                  {roles.map(r => r.name).join(', ')}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          No casting
                        </p>
                      )}
                      {comparison.context2Data && comparison.hasDifferences && (
                        <TouchButton
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopyCasting(
                              context2,
                              context1,
                              comparison.songId
                            )
                          }
                          loading={copying}
                          className="mt-3"
                        >
                          ← Copy to {context1.name}
                        </TouchButton>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {comparisonData.length === 0 && (
                <div className="text-center py-12 text-gray-500">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p>No songs found in these contexts</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p>Select two contexts to compare their casting</p>
          </div>
        )}
      </div>
    </div>
  )
}
