import { useCallback, useEffect, useState } from 'react'
import { CastingAssignmentService } from '../services/CastingAssignmentService'
import {
  DEFAULT_LINEUP,
  type BandRole,
  type CastingAssignment,
  type CastingContext,
  type AssignInput,
} from '../models/Casting'

/**
 * Casting for a setlist/event context: the band role vocabulary + current
 * assignments, with assign/unassign. Directors (band admin / event host) only —
 * enforced by RLS; the UI shows the surface read-only otherwise.
 */
export function useCasting(
  contextType: CastingContext,
  contextId: string | undefined,
  bandId: string | undefined
) {
  const [roles, setRoles] = useState<BandRole[]>([])
  const [casting, setCasting] = useState<CastingAssignment[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!contextId) return
    const [r, c] = await Promise.all([
      // Band-less (personal/social) events have no band_roles rows → fall back to
      // the canonical default lineup so parts are still castable.
      bandId
        ? CastingAssignmentService.getBandRoles(bandId)
        : Promise.resolve(DEFAULT_LINEUP),
      CastingAssignmentService.getCasting(contextType, contextId),
    ])
    setRoles(r.length > 0 ? r : DEFAULT_LINEUP)
    setCasting(c)
    setLoading(false)
  }, [contextType, contextId, bandId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const assign = useCallback(
    async (input: AssignInput) => {
      const res = await CastingAssignmentService.assign(input)
      if (res.ok) await refetch()
      return res
    },
    [refetch]
  )

  const unassign = useCallback(
    async (id: string) => {
      await CastingAssignmentService.unassign(id)
      await refetch()
    },
    [refetch]
  )

  /** Roles that make up the default required lineup (drives "N/M parts cast"). */
  const defaultParts = roles.filter(r => r.isDefaultPart)

  return { roles, defaultParts, casting, loading, refetch, assign, unassign }
}
