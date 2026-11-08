import { describe, it, expect } from 'vitest'
import {
  notificationPath,
  notificationTitle,
  shortTime,
} from '../../../src/domain/notifications'
import { markInitials } from '../../../src/domain/marks'

const base = {
  source: 'activity',
  actor_name: 'Mike Thompson',
  verb: 'added',
  object_type: 'song',
  object_id: 's1',
  object_name: 'Hash Pipe',
  link: null,
}

describe('notificationTitle', () => {
  it('uses the actor first name, verb and object', () => {
    expect(notificationTitle(base)).toBe('Mike added Hash Pipe')
  })
  it('uses the stored title for non-activity items', () => {
    expect(
      notificationTitle({
        ...base,
        source: 'friend',
        object_name: 'Dana sent a request',
      })
    ).toBe('Dana sent a request')
  })
})

describe('notificationPath', () => {
  it('routes each object type', () => {
    expect(notificationPath(base)).toBe('/songs?song=s1')
    expect(notificationPath({ ...base, object_type: 'show' })).toBe('/shows/s1')
    expect(notificationPath({ ...base, object_type: 'practice' })).toBe(
      '/practices/s1'
    )
  })
  it('has nowhere to go for deleted things', () => {
    expect(notificationPath({ ...base, verb: 'deleted' })).toBeNull()
  })
  it('prefers an explicit link', () => {
    expect(notificationPath({ ...base, link: '/friends' })).toBe('/friends')
  })
})

describe('shortTime', () => {
  const now = new Date('2026-11-07T20:00:00Z').getTime()
  it('is compact for recent items', () => {
    expect(shortTime('2026-11-07T19:59:30Z', now)).toBe('now')
    expect(shortTime('2026-11-07T19:48:00Z', now)).toBe('12m')
    expect(shortTime('2026-11-07T18:30:00Z', now)).toBe('1h')
  })
})

describe('markInitials', () => {
  it('takes the first letters of two words, or two letters of one', () => {
    expect(markInitials('Acoustic Duo')).toBe('AD')
    expect(markInitials('Rush')).toBe('Ru')
    expect(markInitials('  ')).toBe('?')
  })
})
