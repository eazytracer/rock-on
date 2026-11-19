/**
 * New band (`/band/new`; Band and Friends 5, Band Identity 1, desktop
 * bandnew): the name is the hero under a live mark; city, genres and
 * description can wait. Create → the band page with the invite card on top.
 * Desktop: two panes, the mark picker beside the form.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, MapPin, Pencil, Plus } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useMediaQuery } from '../hooks/useResponsive'
import { enterBand, useCreateBandRpc } from '../hooks/useBandAdmin'
import { BackCrumb } from '../components/layout/MobileHeader'
import { DockAction } from '../components/layout/PhoneDock'
import { BandMark, Button, Chip, Group, PageTitle } from '../components/ui'
import { BandMarkPicker, MarkEditor } from '../components/band/BandMarkPicker'
import {
  defaultMark,
  type BandMarkValue,
} from '../components/ui/bandMarkPalette'
import { markInitials } from '../domain/marks'
import { errorText } from '../services/api/errors'

const GENRES = [
  'Rock',
  'Covers',
  'Indie',
  'Punk',
  'Alt rock',
  'Metal',
  'Blues',
  'Folk',
]

export const BandNewPage: React.FC = () => {
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 768px)')
  const { showToast } = useToast()
  const create = useCreateBandRpc()
  const [name, setName] = useState('')
  // initials: null follows the name until the user types their own.
  const [mark, setMark] = useState<BandMarkValue>({
    ...defaultMark(''),
    initials: null,
  })
  const [picker, setPicker] = useState(false)
  const [city, setCity] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [custom, setCustom] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const shownName = name.trim() || 'New band'
  const live: BandMarkValue = {
    ...mark,
    initials:
      mark.initials || (name.trim() ? markInitials(name).toUpperCase() : 'NB'),
  }
  // Keep following the name unless the initials themselves were edited.
  const onMark = (m: BandMarkValue) =>
    setMark({
      ...m,
      initials: m.initials === live.initials ? mark.initials : m.initials,
    })
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))

  const submit = async () => {
    const n = name.trim()
    if (!n) {
      setError('Give the band a name.')
      return
    }
    setError(null)
    try {
      const band = await create.mutateAsync({
        name: n,
        mark: live,
        profile: {
          city: city.trim() || undefined,
          description: description.trim() || undefined,
          genres,
        },
      })
      enterBand(band.id, '/band?invite=new')
    } catch (err) {
      setError(errorText(err))
      showToast(errorText(err), 'error')
    }
  }

  const toggleGenre = (g: string) =>
    setGenres(gs => (gs.includes(g) ? gs.filter(x => x !== g) : [...gs, g]))
  const addCustom = () => {
    const g = custom?.trim()
    setCustom(null)
    if (g && !genres.includes(g)) setGenres(gs => [...gs, g])
  }

  const nameInput = (big: boolean) => (
    <div className={big ? 'w-full' : 'flex-1 min-w-0'}>
      {!big && (
        <label
          htmlFor="band-new-name"
          className="block font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3 mb-1.5"
        >
          Band name <span className="text-accent-ink">required</span>
        </label>
      )}
      <input
        id="band-new-name"
        name="bandName"
        data-testid="band-new-name-input"
        autoFocus
        value={name}
        maxLength={60}
        onChange={e => {
          setName(e.target.value)
          setError(null)
        }}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Band name"
        aria-label="Band name"
        aria-invalid={!!error}
        className={
          big
            ? 'w-full bg-transparent text-center font-display font-extrabold uppercase text-[38px] leading-none text-ink-1 pb-1.5 border-b-2 border-accent outline-none placeholder:text-ink-4'
            : 'w-full h-14 px-4 rounded-2xl bg-bg-3 font-display font-extrabold uppercase text-[28px] text-ink-1 outline-none placeholder:text-ink-4 focus:shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]'
        }
      />
      {error && (
        <p
          className="mt-2 text-[13px] text-danger text-center md:text-left"
          role="alert"
          data-testid="band-new-error"
        >
          {error}
        </p>
      )}
    </div>
  )

  const optional = (
    <>
      <Group label="Where · optional">
        <label
          htmlFor="band-new-city"
          className="flex items-center gap-3 min-h-14 px-4"
        >
          <MapPin size={18} className="text-ink-3" />
          <input
            id="band-new-city"
            name="bandCity"
            data-testid="band-new-city-input"
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="City and state"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-ink-1 outline-none placeholder:text-ink-3"
          />
        </label>
      </Group>
      <Group label="Genres · optional">
        <div
          className="flex flex-wrap gap-1.5 p-3"
          data-testid="band-new-genres"
        >
          {[...GENRES, ...genres.filter(g => !GENRES.includes(g))].map(g => (
            <Chip
              key={g}
              on={genres.includes(g)}
              onClick={() => toggleGenre(g)}
              data-testid={`band-new-genre-${g.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {g}
            </Chip>
          ))}
          {custom === null ? (
            <Chip
              icon={<Plus size={14} />}
              onClick={() => setCustom('')}
              data-testid="band-new-genre-add"
            >
              Add
            </Chip>
          ) : (
            <input
              id="band-new-genre"
              name="genre"
              data-testid="band-new-genre-input"
              autoFocus
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onBlur={addCustom}
              onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
              maxLength={30}
              placeholder="Genre"
              className="h-[38px] w-32 px-3 rounded-full bg-bg-3 text-[13.5px] text-ink-1 outline-none"
            />
          )}
        </div>
      </Group>
      <Group label="Description · optional">
        <textarea
          id="band-new-description"
          name="bandDescription"
          data-testid="band-new-description-input"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="One or two lines about the band…"
          className="block w-full px-4 py-3 bg-transparent text-[14.5px] text-ink-1 outline-none resize-none placeholder:text-ink-3"
        />
      </Group>
    </>
  )

  const createButton = (
    <Button
      variant="primary"
      size={desktop ? 'md' : 'lg'}
      fullWidth={!desktop}
      icon={<Check size={18} />}
      onClick={submit}
      disabled={create.isPending}
      data-testid="band-new-create"
    >
      {create.isPending ? 'Creating…' : 'Create'}
    </Button>
  )

  if (desktop) {
    return (
      <div data-testid="band-new-page" className="pb-10">
        <BackCrumb
          label="Back"
          onClick={back}
          className="mb-4"
          data-testid="band-new-back"
        />
        <PageTitle
          title="New band"
          actions={
            <>
              <Button onClick={back} data-testid="band-new-cancel">
                Cancel
              </Button>
              {createButton}
            </>
          }
        />
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-5 items-start">
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-4">
              <BandMark name={shownName} mark={live} size={96} />
              {nameInput(false)}
            </div>
            <div className="-mx-3">{optional}</div>
          </div>
          <div className="rounded-[20px] bg-bg-2 shadow-group p-4">
            <b className="block text-[15px] text-ink-1 mb-3">Band mark</b>
            <MarkEditor name={shownName} value={live} onChange={onMark} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="band-new-page" className="pb-28">
      <BackCrumb label="Back" onClick={back} data-testid="band-new-back" />
      <h1 className="sr-only">New band</h1>
      <div className="flex flex-col items-center gap-3 pt-4 pb-4">
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="relative"
          aria-label="Choose a band mark"
          data-testid="band-new-mark"
        >
          <BandMark name={shownName} mark={live} size={104} />
          <span className="absolute -right-1.5 -bottom-1.5 w-[34px] h-[34px] rounded-full bg-bg-4 text-ink-1 grid place-items-center ring-[3px] ring-bg-1">
            <Pencil size={16} />
          </span>
        </button>
        {nameInput(true)}
        <small className="text-[12.5px] text-ink-3">
          Only the name is needed. Everything below can wait.
        </small>
      </div>
      <div className="-mx-3">{optional}</div>
      <DockAction>{createButton}</DockAction>
      {picker && (
        <BandMarkPicker
          name={shownName}
          value={live}
          onClose={() => setPicker(false)}
          onSave={m => {
            onMark(m)
            setPicker(false)
          }}
        />
      )}
    </div>
  )
}

export default BandNewPage
