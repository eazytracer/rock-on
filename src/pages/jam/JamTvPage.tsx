/**
 * The bar TV (`/j/:code/tv`; Jam TV, Jam Venue 7): full screen, dark always,
 * no chrome, readable across a bar. Drawn on a 1920 × 1080 stage scaled to
 * the window. Slides rotate every 9 s and drop out when empty: On stage (with
 * up next), Looking for someone (songs with an open part), Come play. The QR
 * and code sit on every slide. First names and parts only (jam_tv_feed).
 */
import React, { useEffect, useLayoutEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Hand } from 'lucide-react'
import {
  formatCode,
  normalizeCode,
  partName,
  useJamTvFeed,
} from '../../hooks/useJam'
import type { JamTvFeed } from '../../services/api/jams'
import { useWakeLock } from '../../hooks/useWakeLock'
import { CodeQr } from '../../components/jams/guest/CodeQr'
import {
  INVALID_CODE,
  INVITE_ONLY,
  JAM_ENDED,
  isEnded,
} from '../../components/jams/guest/helpers'
import { ApiError } from '../../services/api/errors'

const W = 1920
const H = 1080
const ROTATE_MS = 9_000
type Item = NonNullable<JamTvFeed['stage']>
type Slide = 'stage' | 'need' | 'join'

/** Scale the 1920 × 1080 stage to fit the window. */
function useFit() {
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const fit = () =>
      setScale(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return scale
}

const castNames = (i: Item) =>
  i.slots.filter(s => s.cast).map(s => s.cast!.name)

const gapPart = (i: Item) => {
  const s = i.slots.find(x => x.gap)
  return s ? partName(s, s.nth) : null
}

const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scale = useFit()
  return (
    <div
      data-testid="jam-tv-page"
      className="fixed inset-0 overflow-hidden bg-[#0c0b0a] text-[#f4efe9] font-sans cursor-none"
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: W,
          height: H,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

const Notice: React.FC<{ text: string; testid: string }> = ({
  text,
  testid,
}) => (
  <Screen>
    <div
      className="absolute inset-0 grid place-items-center px-40 text-center"
      data-testid={testid}
    >
      <div>
        <Wordmark />
        <h1 className="font-display font-black uppercase text-[120px] leading-[.9] mt-10">
          {text}
        </h1>
      </div>
    </div>
  </Screen>
)

const Wordmark: React.FC = () => (
  <span className="inline-flex items-center gap-3 font-display font-extrabold uppercase text-[34px] text-[#f4efe9]">
    <i className="w-[7px] h-[34px] bg-[#ff7a1a] rounded-sm" />
    Rock On
  </span>
)

export const JamTvPage: React.FC = () => {
  const { code: raw = '' } = useParams<{ code: string }>()
  const code = normalizeCode(raw)
  const feed = useJamTvFeed(code)
  useWakeLock()

  const data = feed.data
  const slides: Slide[] = []
  if (data?.stage) slides.push('stage')
  if (data?.looking_for?.length) slides.push('need')
  slides.push('join')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), ROTATE_MS)
    return () => clearInterval(t)
  }, [])
  const slide = slides[tick % slides.length]

  if (feed.isLoading) return <Screen>{null}</Screen>
  if (feed.error || !data) {
    const invite =
      feed.error instanceof ApiError && feed.error.key === 'invite_only'
    return invite ? (
      <Notice text={INVITE_ONLY} testid="jam-tv-invite-only" />
    ) : (
      <Notice text={INVALID_CODE} testid="jam-tv-invalid" />
    )
  }
  if (isEnded(data.jam.status))
    return <Notice text={JAM_ENDED} testid="jam-tv-ended" />

  const link = `${window.location.origin}/j/${code}`
  const shown = formatCode(data.code || code)
  const live = data.jam.status === 'live'

  const side = (title: string, text: string, light = false) => (
    <div
      className={`absolute right-20 top-[170px] bottom-[110px] w-[420px] rounded-[40px] flex flex-col items-center justify-center gap-[22px] p-[30px] text-center ${
        light ? 'bg-[#f7f3ee] text-[#1a1512]' : 'bg-[#161412]'
      }`}
    >
      <CodeQr
        value={link}
        size={260}
        className="!p-[18px] !rounded-[18px]"
        data-testid="jam-tv-qr"
      />
      <b className="font-display font-extrabold uppercase text-[56px] leading-[.9] mt-3">
        {title}
      </b>
      <p
        className={`text-[26px] leading-[1.35] ${light ? 'text-[#3d352f]' : 'text-[#cfc6bd]'}`}
      >
        {text}
      </p>
      <div
        className={`font-mono text-[24px] tracking-[.08em] ${light ? 'text-[#6b6158]' : 'text-[#8a8178]'}`}
      >
        CODE{' '}
        <em
          className={`not-italic tracking-[.16em] ${light ? 'text-[#1a1512]' : 'text-[#f4efe9]'}`}
          data-testid="jam-tv-code"
        >
          {shown}
        </em>
      </div>
    </div>
  )

  const kicker = (text: string, violet = false) => (
    <div
      className={`font-mono text-[26px] tracking-[.14em] uppercase ${violet ? 'text-[#c58bff]' : 'text-[#ff9a4d]'}`}
    >
      {text}
    </div>
  )

  const stage = data.stage
  const next = data.up_next
  return (
    <Screen>
      <div className="absolute left-20 right-20 top-14 flex items-center gap-[26px]">
        {live && (
          <span className="flex items-center gap-3 font-mono font-bold text-[26px] tracking-[.12em] text-[#ff5d5d]">
            <i className="w-[18px] h-[18px] rounded-full bg-[#ff5d5d] animate-pulse" />
            LIVE
          </span>
        )}
        <span
          className="font-display font-extrabold uppercase text-[44px] tracking-[.02em]"
          data-testid="jam-tv-name"
        >
          {data.jam.name}
        </span>
        {data.jam.venue && (
          <span className="font-mono text-[24px] tracking-[.08em] uppercase text-[#8a8178]">
            {data.jam.venue}
          </span>
        )}
        <div className="ml-auto flex gap-3">
          {slides.map(s => (
            <i
              key={s}
              className={`w-12 h-2 rounded ${s === slide ? 'bg-[#ff7a1a]' : 'bg-[#2a2522]'}`}
            />
          ))}
        </div>
      </div>

      <div
        className="absolute left-20 right-[560px] top-[170px] bottom-[110px]"
        data-testid={`jam-tv-slide-${slide}`}
      >
        {slide === 'stage' && stage && (
          <div data-testid="jam-tv-stage">
            {kicker('On stage now')}
            <h2
              className="font-display font-black uppercase text-[170px] leading-[.85] mt-4 mb-3 line-clamp-2"
              data-testid="jam-tv-stage-title"
            >
              {stage.title}
            </h2>
            {stage.artist && (
              <div className="text-[40px] text-[#cfc6bd]">{stage.artist}</div>
            )}
            <div className="flex flex-wrap gap-4 mt-10">
              {stage.slots.map(s => (
                <div
                  key={`${s.key}-${s.label ?? ''}-${s.nth}`}
                  className={`h-24 rounded-[48px] flex items-center gap-4 text-[36px] font-bold ${
                    s.cast
                      ? 'bg-[#221f1c] pl-3.5 pr-[30px]'
                      : 'px-[30px] shadow-[inset_0_0_0_3px_#4a423c] text-[#a69c92]'
                  }`}
                >
                  {s.cast && (
                    <i className="w-[68px] h-[68px] rounded-full bg-[#3a332d] grid place-items-center not-italic text-[30px] font-extrabold">
                      {s.cast.name[0]}
                    </i>
                  )}
                  <small className="font-mono text-[20px] uppercase tracking-[.08em] text-[#8a8178] font-medium">
                    {partName(s, s.nth)}
                  </small>
                  {s.cast ? s.cast.name : 'Open'}
                </div>
              ))}
            </div>
            {next && (
              <div className="mt-12" data-testid="jam-tv-up-next">
                {kicker('Up next')}
                <div className="flex items-baseline gap-6 py-3.5 mt-2 border-t-2 border-[#221f1c]">
                  <b
                    className="text-[46px] flex-1 truncate"
                    data-testid="jam-tv-up-next-title"
                  >
                    {next.title}
                  </b>
                  <em className="not-italic text-[30px] text-[#a69c92] truncate max-w-[50%]">
                    {[next.artist, castNames(next).join(', ') || null]
                      .filter(Boolean)
                      .join(' · ')}
                  </em>
                </div>
              </div>
            )}
          </div>
        )}

        {slide === 'need' && (
          <div data-testid="jam-tv-looking-for">
            {kicker('Looking for someone', true)}
            <h2 className="font-display font-black uppercase text-[120px] leading-[.88] mt-4 mb-9">
              Know one of these?
            </h2>
            <div className="flex flex-col gap-[18px]">
              {data.looking_for.slice(0, 3).map(i => {
                const names = castNames(i)
                const part = gapPart(i)
                return (
                  <div
                    key={i.id}
                    className="flex items-center gap-[30px] px-[34px] py-[26px] rounded-[32px] bg-[#161412]"
                  >
                    <div className="flex-1 min-w-0">
                      <b className="block text-[52px] leading-[1.05] truncate">
                        {i.title}
                      </b>
                      <small className="text-[28px] text-[#a69c92]">
                        {[
                          i.artist,
                          names.length
                            ? `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} in`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    </div>
                    {part && (
                      <span className="h-[84px] px-[34px] rounded-[42px] bg-[#c58bff] text-[#1a0a2e] flex items-center gap-3 text-[36px] font-extrabold shrink-0">
                        <Hand size={38} />
                        {part}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {slide === 'join' && (
          <div data-testid="jam-tv-join">
            <Wordmark />
            <div className="mt-8">{kicker('The stage is open')}</div>
            <h2 className="font-display font-black uppercase text-[150px] leading-[.82] mt-2.5 mb-7">
              Come <span className="text-[#ff7a1a]">play</span>.
            </h2>
            <div className="flex flex-col gap-[18px]">
              {[
                ['Scan the code', "Opens in your phone's browser"],
                ['Say what you play', 'A first name is enough'],
                ['Raise your hand', 'The host calls you up'],
              ].map(([t, s], n) => (
                <div
                  key={t}
                  className="flex items-center gap-[26px] text-[38px] font-bold"
                >
                  <i className="w-[76px] h-[76px] rounded-full bg-[#221f1c] grid place-items-center not-italic font-mono text-[30px] text-[#ff9a4d] shrink-0">
                    {n + 1}
                  </i>
                  <span>
                    {t}
                    <small className="block text-[28px] text-[#a69c92] font-normal">
                      {s}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {slide === 'stage' &&
        side('Want to play?', 'Scan to raise your hand or pitch a song.')}
      {slide === 'need' &&
        side('Know one?', 'Scan and raise your hand. Or just tell the host.')}
      {slide === 'join' &&
        side(
          'Scan to join',
          'No app, no account. Or just tell the host.',
          true
        )}

      <div className="absolute left-20 right-20 bottom-11 flex items-center gap-[18px] font-mono text-[22px] tracking-[.06em] text-[#8a8178] uppercase">
        Join at {window.location.host}/j · code {shown}
        <span className="ml-auto">
          <Wordmark />
        </span>
      </div>
    </Screen>
  )
}

export default JamTvPage
