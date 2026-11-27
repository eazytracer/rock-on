/**
 * Host a jam (`/jam/new`; FP 21): name, date + start (kit pickers), where
 * (optional). Create → the planned jam. A jam made in a band belongs to the
 * band (its catalog, its members); in Personal it's yours.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PartyPopper } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useMediaQuery } from '../../hooks/useResponsive'
import { useJamAction } from '../../hooks/useJam'
import { createJam } from '../../services/api/jams'
import { errorText } from '../../services/api/errors'
import { BackCrumb } from '../../components/layout/MobileHeader'
import { DockAction } from '../../components/layout/PhoneDock'
import { Button, PageTitle } from '../../components/ui'
import { JamFields } from '../../components/jams/JamForm'
import { jamFormAt, jamFormFrom } from '../../components/jams/parts'
import { roundUpToQuarterHour } from '../../utils/dateHelpers'

/** Tonight at 8, or the next quarter hour once it's past 8. */
const defaultStart = () => {
  const d = new Date()
  if (d.getHours() < 20) {
    d.setHours(20, 0, 0, 0)
    return d
  }
  return roundUpToQuarterHour(d)
}

export const JamNewPage: React.FC = () => {
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 768px)')
  const { currentBandId } = useAuth()
  const [v, setV] = useState(() => jamFormFrom(defaultStart()))
  const [error, setError] = useState<string | null>(null)
  const create = useJamAction(createJam)

  const submit = async () => {
    if (!v.name.trim()) return setError('Give the jam a name.')
    setError(null)
    try {
      const jam = await create.mutateAsync({
        name: v.name.trim(),
        at: jamFormAt(v).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        where: v.where.trim() || undefined,
        bandId: currentBandId ?? undefined,
      })
      navigate(`/jam/${jam.id}`, { replace: true })
    } catch (err) {
      setError(errorText(err))
    }
  }
  const back = () => navigate('/jam')
  const createBtn = (
    <Button
      variant="primary"
      size={desktop ? 'md' : 'lg'}
      fullWidth={!desktop}
      disabled={create.isPending}
      onClick={() => void submit()}
      data-testid="jam-new-create"
    >
      Create
    </Button>
  )

  return (
    <div data-testid="jam-new-page" className="max-w-xl pb-28 md:pb-8">
      {!desktop && (
        <BackCrumb label="Jam" onClick={back} data-testid="jam-new-back" />
      )}
      <PageTitle
        eyebrow="Jam"
        title="Host a jam"
        actions={
          desktop ? (
            <>
              <Button onClick={back} data-testid="jam-new-cancel">
                Cancel
              </Button>
              {createBtn}
            </>
          ) : undefined
        }
      />
      <div className="mt-6">
        <JamFields
          value={v}
          onChange={setV}
          onSubmit={() => void submit()}
          error={error}
          testId="jam-new"
        />
      </div>
      <p className="mt-5 flex gap-2 text-[13px] leading-snug text-ink-3">
        <PartyPopper size={16} className="shrink-0 mt-0.5 text-type-jam" />
        You get a code to share. Songs, parts and who can join come after.
      </p>
      {!desktop && <DockAction>{createBtn}</DockAction>}
    </div>
  )
}

export default JamNewPage
