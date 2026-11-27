/**
 * Band profile (`/band/profile`; Band Identity 3, decision 11): mark, name,
 * city, genres, description and links, edited in place through
 * update_band_profile. Owner / admins edit; members read. No public page yet.
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ExternalLink,
  Link2,
  MapPin,
  Pencil,
  Plus,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useBandActions, useBandRow } from '../hooks/useBandAdmin'
import { BackCrumb } from '../components/layout/MobileHeader'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { BandMark, Button, Empty, Group } from '../components/ui'
import { BandMarkPicker } from '../components/band/BandMarkPicker'
import {
  defaultMark,
  type BandMarkValue,
} from '../components/ui/bandMarkPalette'
import { errorText } from '../services/api/errors'
import type { BandLink } from '../services/api/bands'

/** A text field that saves when you leave it (Enter too, for one line). */
const InPlace: React.FC<{
  value: string
  onSave: (v: string) => Promise<boolean>
  readOnly: boolean
  placeholder: string
  multiline?: boolean
  className?: string
  id: string
  name: string
  'data-testid': string
  maxLength?: number
}> = ({
  value,
  onSave,
  readOnly,
  placeholder,
  multiline,
  className = '',
  id,
  name,
  'data-testid': testId,
  maxLength,
}) => {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = async () => {
    if (draft.trim() === value.trim()) return
    if (!(await onSave(draft.trim()))) setDraft(value)
  }
  const props = {
    id,
    name,
    'data-testid': testId,
    value: draft,
    readOnly,
    placeholder: readOnly ? '' : placeholder,
    maxLength,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: commit,
    className: `w-full bg-transparent outline-none rounded-lg placeholder:text-ink-4 ${
      readOnly ? '' : 'hover:bg-bg-3/50 focus:bg-bg-3'
    } ${className}`,
  }
  return multiline ? (
    <textarea rows={2} {...props} />
  ) : (
    <input
      {...props}
      onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

export const BandProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const { currentBandId, currentUserRole } = useAuth()
  const { showToast } = useToast()
  const bandId = currentBandId ?? ''
  const { data: band, isLoading } = useBandRow(bandId)
  const { updateProfile } = useBandActions(bandId)
  const [picker, setPicker] = useState(false)
  const [genre, setGenre] = useState<string | null>(null)
  const [link, setLink] = useState<{ label: string; url: string } | null>(null)

  if (!currentBandId) {
    return (
      <div data-testid="band-profile-page">
        <Empty
          icon={<Users size={26} />}
          title="No band selected"
          why="Switch to a band from the header to see its profile."
          action={
            <Button
              variant="primary"
              onClick={() => navigate('/band/new')}
              data-testid="band-profile-create"
            >
              Create a band
            </Button>
          }
        />
      </div>
    )
  }

  const canEdit = currentUserRole === 'owner' || currentUserRole === 'admin'
  const save = async (
    patch: Parameters<typeof updateProfile.mutateAsync>[0]
  ) => {
    try {
      await updateProfile.mutateAsync(patch)
      return true
    } catch (err) {
      showToast(errorText(err), 'error')
      return false
    }
  }

  const name = band?.name ?? ''
  const mark = (band?.mark as BandMarkValue | null) ?? defaultMark(name)
  const genres = band?.genres ?? []
  const links = ((band?.links as BandLink[] | null) ?? []).filter(l => l?.url)

  const addGenre = async () => {
    const g = genre?.trim()
    setGenre(null)
    if (!g || genres.some(x => x.toLowerCase() === g.toLowerCase())) return
    await save({ genres: [...genres, g] })
  }

  const addLink = async () => {
    if (!link) return
    let url = link.url.trim()
    if (!url) return setLink(null)
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    const next = [...links, { label: link.label.trim() || hostOf(url), url }]
    if (await save({ links: next })) setLink(null)
  }

  return (
    <div
      data-testid="band-profile-page"
      className="max-w-[720px] md:pb-10 pb-28"
    >
      <BackCrumb
        to="/band"
        label="Band"
        className="mb-4"
        data-testid="band-profile-back"
      />
      <ContentLoadingSpinner isLoading={isLoading}>
        <div className="flex gap-4 items-center px-1 pb-4">
          <button
            type="button"
            onClick={() => canEdit && setPicker(true)}
            disabled={!canEdit}
            className="relative shrink-0"
            aria-label="Change the band mark"
            data-testid="band-profile-mark"
          >
            <BandMark name={name} mark={mark} size={84} />
            {canEdit && (
              <span className="absolute -right-1.5 -bottom-1.5 w-[30px] h-[30px] rounded-full bg-bg-4 text-ink-1 grid place-items-center ring-[3px] ring-bg-1">
                <Pencil size={14} />
              </span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <InPlace
              id="band-profile-name"
              name="bandName"
              data-testid="band-profile-name-input"
              value={name}
              readOnly={!canEdit}
              placeholder="Band name"
              maxLength={60}
              onSave={v =>
                v
                  ? save({ name: v })
                  : (showToast('A band needs a name.', 'error'),
                    Promise.resolve(false))
              }
              className="font-display font-extrabold uppercase text-[40px] leading-[.95] text-ink-1 px-1"
            />
            <label
              htmlFor="band-profile-city"
              className="flex items-center gap-1.5 text-[13.5px] text-ink-2 mt-1"
            >
              <MapPin size={14} className="text-ink-3 shrink-0" />
              <InPlace
                id="band-profile-city"
                name="bandCity"
                data-testid="band-profile-city-input"
                value={band?.city ?? ''}
                readOnly={!canEdit}
                placeholder="City and state"
                onSave={v => save({ city: v })}
                className="px-1 py-0.5"
              />
            </label>
          </div>
        </div>

        <div
          className="flex flex-wrap gap-1.5 px-1 pb-3"
          data-testid="band-profile-genres"
        >
          {genres.map(g => (
            <span
              key={g}
              className="inline-flex items-center gap-1 h-8 pl-3 pr-2 rounded-lg bg-bg-3 font-mono text-[11px] tracking-[.06em] uppercase text-ink-2"
              data-testid="band-profile-genre"
            >
              {g}
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Remove ${g}`}
                  onClick={() => save({ genres: genres.filter(x => x !== g) })}
                  className="grid place-items-center w-5 h-5 text-ink-3 hover:text-ink-1"
                  data-testid={`band-profile-genre-remove-${g}`}
                >
                  <X size={13} />
                </button>
              )}
            </span>
          ))}
          {canEdit &&
            (genre === null ? (
              <button
                type="button"
                onClick={() => setGenre('')}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12.5px] font-semibold text-ink-3 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]"
                data-testid="band-profile-genre-add"
              >
                <Plus size={14} /> Genre
              </button>
            ) : (
              <input
                id="band-profile-genre-new"
                name="genre"
                data-testid="band-profile-genre-input"
                autoFocus
                value={genre}
                onChange={e => setGenre(e.target.value)}
                onBlur={addGenre}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setGenre(null)
                }}
                placeholder="Grunge"
                maxLength={30}
                className="h-8 w-32 px-3 rounded-lg bg-bg-3 text-[13px] text-ink-1 outline-none"
              />
            ))}
          {!canEdit && genres.length === 0 && (
            <span className="text-[13px] text-ink-3">No genres yet.</span>
          )}
        </div>

        <div className="px-1 pb-4">
          <InPlace
            id="band-profile-description"
            name="bandDescription"
            data-testid="band-profile-description-input"
            value={band?.description ?? ''}
            readOnly={!canEdit}
            multiline
            placeholder="One or two lines about the band…"
            onSave={v => save({ description: v })}
            className="text-[14.5px] leading-relaxed text-ink-2 px-1 py-1 resize-none"
          />
        </div>

        <div className="-mx-3">
          <Group
            label="Links"
            action={
              canEdit && !link
                ? {
                    label: '+ Add',
                    onClick: () => setLink({ label: '', url: '' }),
                    'data-testid': 'band-profile-link-add',
                  }
                : undefined
            }
            data-testid="band-profile-links"
          >
            {links.map((l, i) => (
              <div
                key={`${l.url}-${i}`}
                className="flex items-center gap-3 min-h-[52px] pl-4 pr-2"
                data-testid="band-profile-link"
              >
                <Link2 size={18} className="text-ink-3 shrink-0" />
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 min-w-0"
                >
                  <b className="block truncate text-[15px] font-semibold text-ink-1">
                    {l.label || hostOf(l.url)}
                  </b>
                  <small className="block truncate text-[12.5px] text-ink-3">
                    {hostOf(l.url)}
                  </small>
                </a>
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Remove ${l.label || l.url}`}
                    onClick={() =>
                      save({ links: links.filter((_, j) => j !== i) })
                    }
                    className="grid place-items-center w-10 h-10 text-ink-3 hover:text-ink-1"
                    data-testid={`band-profile-link-remove-${i}`}
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <ExternalLink size={16} className="text-ink-4 mr-3" />
                )}
              </div>
            ))}
            {link && (
              <div
                className="flex flex-col gap-2 p-3"
                data-testid="band-profile-link-form"
              >
                <input
                  id="band-profile-link-label"
                  name="linkLabel"
                  data-testid="band-profile-link-label-input"
                  value={link.label}
                  onChange={e => setLink({ ...link, label: e.target.value })}
                  placeholder="Label (Instagram, Website…)"
                  className="h-11 px-3.5 rounded-xl bg-bg-3 text-[15px] text-ink-1 outline-none"
                />
                <input
                  id="band-profile-link-url"
                  name="linkUrl"
                  data-testid="band-profile-link-url-input"
                  value={link.url}
                  autoFocus
                  onChange={e => setLink({ ...link, url: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && addLink()}
                  placeholder="https://"
                  inputMode="url"
                  className="h-11 px-3.5 rounded-xl bg-bg-3 text-[15px] text-ink-1 outline-none"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={() => setLink(null)}
                    data-testid="band-profile-link-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={addLink}
                    disabled={!link.url.trim() || updateProfile.isPending}
                    data-testid="band-profile-link-save"
                  >
                    Add link
                  </Button>
                </div>
              </div>
            )}
            {links.length === 0 && !link && (
              <p className="px-4 py-4 text-[14px] text-ink-3">
                {canEdit
                  ? 'Website, Instagram, Bandcamp: add where people find you.'
                  : 'No links yet.'}
              </p>
            )}
          </Group>
        </div>
      </ContentLoadingSpinner>

      {picker && (
        <BandMarkPicker
          name={name}
          value={mark}
          saving={updateProfile.isPending}
          onClose={() => setPicker(false)}
          onSave={async m => {
            if (await save({ mark: m })) {
              setPicker(false)
              showToast('Band mark saved', 'success')
            }
          }}
        />
      )}
    </div>
  )
}

export default BandProfilePage
