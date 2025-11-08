# RealtimeManager Test Design - Challenge the Implementation

**Date:** 2025-11-02T03:17
**Purpose:** Design comprehensive tests to find bugs, not just verify current behavior
**Approach:** Think like an attacker - what could go wrong?

---

## Code Analysis - Potential Issues Found

### 🔴 Critical Issues

#### 1. **Race Condition in Duplicate Check (Line 122-125)**
```typescript
if (this.channels.has(channelName)) {
  console.log(`[RealtimeManager] Already subscribed to ${channelName}, skipping...`)
  return
}
// ... later ...
this.channels.set(channelName, channel)  // Line 155
```

**Problem:** Non-atomic check-then-set. If two async calls happen concurrently:
1. Thread A checks `has(channelName)` → false
2. Thread B checks `has(channelName)` → false (before A sets)
3. Thread A creates subscription
4. Thread B creates subscription (DUPLICATE!)

**Test Needed:** Concurrent calls with actual timing

#### 2. **Connected Status Race (Line 107-109)**
```typescript
if (this.channels.size > 0) {
  this.connected = true
  console.log(`✅ Real-time sync connected (${this.channels.size} channels)`)
}
```

**Problem:** What if subscription fails AFTER adding to map?
- Channel added to map (line 155)
- Subscribe callback gets error (line 143-145)
- Sets `this.connected = false`
- But `subscribeToUserBands` already set it to `true` (line 108)

**Test Needed:** Subscription failure after channel creation

#### 3. **Invalid Audit Log Handling (Line 596-598)**
```typescript
if (!audit || !audit.table_name || !audit.action) {
  console.warn('[RealtimeManager] Invalid audit payload:', payload)
  return  // ❌ Silent failure!
}
```

**Problem:** Invalid payloads are logged but not reported. Should we:
- Emit error event?
- Track invalid payload count?
- Retry?
- Alert monitoring?

**Test Needed:** Malformed audit payloads

#### 4. **Missing Error Handling in Mappers (Line 729-823)**
```typescript
private mapAuditToSong(jsonb: any): Song {
  return {
    id: jsonb.id,  // ❌ What if jsonb.id is undefined?
    title: jsonb.title || '',  // ❌ What if title is null?
    // ...
  }
}
```

**Problem:** If JSONB is corrupted or missing required fields:
- Throws error → crashes handler
- Creates partial object → data corruption
- Silent failure → lost changes

**Test Needed:** Malformed JSONB data

#### 5. **Toast Batching Memory Leak (Line 849-871)**
```typescript
this.pendingToasts.set(userName, pending)

this.toastBatchTimeout = setTimeout(() => {
  this.flushToasts()
}, this.TOAST_BATCH_DELAY)
```

**Problem:** If toasts never flush (e.g., user closes tab):
- pendingToasts Map grows indefinitely
- Timeout never clears
- Memory leak

**Test Needed:** Long-running session with many changes

---

### 🟡 Medium Issues

#### 6. **Reconnect Not Implemented (Line 1004-1019)**
```typescript
async reconnect(): Promise<void> {
  // Re-subscribe (would need to store band IDs)
  // For now, just mark as connected (full implementation would re-subscribe)
  this.connected = true  // ❌ FAKE!
}
```

**Problem:** Reconnect claims to work but doesn't. If network drops:
- `handleDisconnect()` called → `connected = false`
- `reconnect()` called → `connected = true` but NO subscriptions
- App thinks it's connected but receives no updates

**Test Needed:** Network disconnect/reconnect

#### 7. **User ID Validation Missing (Line 889-891)**
```typescript
if (!userId) {
  console.warn('[RealtimeManager] queueToast called with empty userId, using default name')
} else {
  const user = await db.users.get(userId)
```

**Problem:** Empty userId treated as valid but different from null/undefined. Inconsistent handling.

**Test Needed:** null, undefined, empty string, whitespace userId

#### 8. **Channel Subscription Error Not Propagated (Line 143-145)**
```typescript
if (err) {
  console.error(`❌ Failed to subscribe to ${channelName}:`, err)
  this.connected = false  // ❌ But doesn't throw or return error!
}
```

**Problem:** Subscription errors are logged but caller never knows. `subscribeToUserBands` returns void, so caller thinks it succeeded.

**Test Needed:** Verify error handling and propagation

---

### 🟢 Minor Issues

#### 9. **Deprecated Methods Still Present (Line 165-222)**
```typescript
private async subscribeToBand(_userId: string, bandId: string): Promise<void> {
  // @deprecated - Use subscribeToAuditLog instead (audit-first approach)
```

**Problem:** Dead code increases complexity, could be called by mistake.

**Test Needed:** Ensure deprecated methods aren't called

#### 10. **Inconsistent Naming (Line 634)**
```typescript
const eventName = `${audit.table_name}:changed`  // practice_sessions:changed
// But event type is 'practices:changed' not 'practice_sessions:changed'
```

**Problem:** Event name mismatch! Audit has `practice_sessions` but event should be `practices:changed`.

**Test Needed:** Verify practice session events are emitted correctly

---

## Comprehensive Test Scenarios

### Category 1: Concurrency & Race Conditions

#### Test 1.1: True Concurrent Duplicate Prevention
```typescript
it('should handle true concurrent calls without race condition', async () => {
  const userId = 'user-1'
  const bandIds = ['band-1']

  // Use Promise.race to create true concurrency
  const results = await Promise.allSettled([
    manager.subscribeToUserBands(userId, bandIds),
    manager.subscribeToUserBands(userId, bandIds),
    manager.subscribeToUserBands(userId, bandIds)
  ])

  // All should succeed
  results.forEach(r => expect(r.status).toBe('fulfilled'))

  // But only ONE channel should exist
  const channels = mockSupabase.channel.mock.calls
  const auditChannels = channels.filter(c => c[0].startsWith('audit-'))
  expect(auditChannels.length).toBe(1)
})
```

#### Test 1.2: Subscription During Subscription
```typescript
it('should handle subscription call while previous subscription is pending', async () => {
  // Make subscribe slow
  mockChannel.subscribe = vi.fn().mockImplementation(() => {
    return new Promise(resolve => setTimeout(() => resolve({ error: null }), 100))
  })

  const userId = 'user-1'
  const bandIds = ['band-1']

  // Start first subscription
  const promise1 = manager.subscribeToUserBands(userId, bandIds)

  // Start second before first completes
  await new Promise(resolve => setTimeout(resolve, 10))
  const promise2 = manager.subscribeToUserBands(userId, bandIds)

  await Promise.all([promise1, promise2])

  // Should still only have one channel
  expect(mockSupabase.channel).toHaveBeenCalledTimes(1)
})
```

---

### Category 2: Error Handling & Edge Cases

#### Test 2.1: Subscription Failure After Channel Creation
```typescript
it('should handle subscription failure correctly', async () => {
  mockChannel.subscribe = vi.fn().mockResolvedValue({
    error: new Error('Connection refused')
  })

  const userId = 'user-1'
  const bandIds = ['band-1']

  await manager.subscribeToUserBands(userId, bandIds)

  // Should NOT be connected (error should win)
  expect(manager.isConnected()).toBe(false)

  // Should still have channel in map (or should it be removed?)
  // This is a design question - current code keeps failed channels
})
```

#### Test 2.2: Malformed Audit Payload
```typescript
it('should handle malformed audit payload gracefully', async () => {
  await manager.subscribeToUserBands('user-1', ['band-1'])

  // Get the audit handler
  const onCall = mockChannel.on.mock.calls[0]
  const handler = onCall[2]

  // Send malformed payloads
  const malformedPayloads = [
    { new: null },  // No audit data
    { new: {} },  // Missing table_name
    { new: { table_name: 'songs' } },  // Missing action
    { new: { table_name: 'invalid', action: 'INSERT' } },  // Invalid table
    { new: { table_name: 'songs', action: 'INVALID' } },  // Invalid action
  ]

  for (const payload of malformedPayloads) {
    // Should not throw
    await expect(handler(payload)).resolves.not.toThrow()
  }

  // Should log warnings
  expect(console.warn).toHaveBeenCalled()
})
```

#### Test 2.3: Corrupted JSONB Data
```typescript
it('should handle corrupted JSONB in audit log', async () => {
  await manager.subscribeToUserBands('user-1', ['band-1'])

  const onCall = mockChannel.on.mock.calls[0]
  const handler = onCall[2]

  // Send audit with corrupted new_values
  const corruptedPayload = {
    new: {
      id: 'audit-1',
      table_name: 'songs',
      action: 'INSERT',
      user_id: 'user-2',
      user_name: 'Bob',
      record_id: 'song-1',
      band_id: 'band-1',
      new_values: {
        // Missing required field 'id'
        title: 'Test Song'
        // Missing contextId, contextType, createdBy, etc.
      }
    }
  }

  // Should either:
  // A) Handle gracefully with defaults
  // B) Throw clear error
  // C) Log error and skip
  await handler(corruptedPayload)

  // Verify IndexedDB wasn't corrupted
  const songs = await db.songs.toArray()
  // Should either have valid song or no song, never partial song
})
```

---

### Category 3: State Management

#### Test 3.1: Connected Status After Mixed Success/Failure
```typescript
it('should set connected status correctly with mixed success/failure', async () => {
  // First band succeeds
  mockChannel.subscribe = vi.fn()
    .mockResolvedValueOnce({ error: null })  // band-1: success
    .mockResolvedValueOnce({ error: new Error('Failed') })  // band-2: failure

  await manager.subscribeToUserBands('user-1', ['band-1', 'band-2'])

  // Should be connected (at least one succeeded)
  expect(manager.isConnected()).toBe(true)

  // Should have 2 channels (even though one failed?)
  expect(mockSupabase.channel).toHaveBeenCalledTimes(2)
})
```

#### Test 3.2: Unsubscribe During Active Subscription
```typescript
it('should handle unsubscribeAll during active subscriptions', async () => {
  // Make subscriptions slow
  mockChannel.subscribe = vi.fn().mockImplementation(() => {
    return new Promise(resolve => setTimeout(() => resolve({ error: null }), 100))
  })

  const promise = manager.subscribeToUserBands('user-1', ['band-1', 'band-2'])

  // Unsubscribe while subscriptions are pending
  await new Promise(resolve => setTimeout(resolve, 50))
  await manager.unsubscribeAll()

  // Wait for original promise
  await promise

  // Should end up with no channels
  expect(manager.isConnected()).toBe(false)
  // Channels map should be empty
})
```

---

### Category 4: Event Emission

#### Test 4.1: Event Name Mismatch (practice_sessions vs practices)
```typescript
it('should emit correct event name for practice sessions', async () => {
  await manager.subscribeToUserBands('user-1', ['band-1'])

  const onCall = mockChannel.on.mock.calls[0]
  const handler = onCall[2]

  const eventSpy = vi.fn()
  manager.on('practices:changed', eventSpy)  // Note: practices not practice_sessions

  const auditPayload = {
    new: {
      table_name: 'practice_sessions',  // Supabase name
      action: 'INSERT',
      user_id: 'user-2',
      user_name: 'Bob',
      record_id: 'practice-1',
      band_id: 'band-1',
      new_values: { /* valid practice data */ }
    }
  }

  await handler(auditPayload)

  // Should emit 'practices:changed' event
  // BUG: Currently emits 'practice_sessions:changed'!
  expect(eventSpy).toHaveBeenCalledWith({
    bandId: 'band-1',
    action: 'INSERT',
    recordId: 'practice-1'
  })
})
```

#### Test 4.2: Event Emitted Before IndexedDB Update
```typescript
it('should emit event only after IndexedDB update succeeds', async () => {
  let dbUpdated = false
  mockDb.songs.put = vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 50))
    dbUpdated = true
  })

  await manager.subscribeToUserBands('user-1', ['band-1'])

  const onCall = mockChannel.on.mock.calls[0]
  const handler = onCall[2]

  const eventSpy = vi.fn().mockImplementation(() => {
    // When event fires, IndexedDB should already be updated
    expect(dbUpdated).toBe(true)
  })
  manager.on('songs:changed', eventSpy)

  const auditPayload = {
    new: {
      table_name: 'songs',
      action: 'INSERT',
      user_id: 'user-2',
      user_name: 'Bob',
      record_id: 'song-1',
      band_id: 'band-1',
      new_values: { /* valid song data */ }
    }
  }

  await handler(auditPayload)

  expect(eventSpy).toHaveBeenCalled()
})
```

---

### Category 5: Memory & Resource Management

#### Test 5.1: Toast Memory Leak
```typescript
it('should not leak memory with unbatched toasts', async () => {
  await manager.subscribeToUserBands('user-1', ['band-1'])

  const onCall = mockChannel.on.mock.calls[0]
  const handler = onCall[2]

  // Send 1000 changes rapidly (but never wait for batch delay)
  for (let i = 0; i < 1000; i++) {
    const payload = {
      new: {
        table_name: 'songs',
        action: 'UPDATE',
        user_id: `user-${i}`,
        user_name: `User ${i}`,
        record_id: `song-${i}`,
        band_id: 'band-1',
        new_values: { /* valid data */ }
      }
    }
    await handler(payload)
  }

  // Internal pendingToasts map should not grow unbounded
  // But we can't access it directly... need to refactor for testability
  // Or monitor memory usage
})
```

#### Test 5.2: Channel Cleanup on Unsubscribe
```typescript
it('should fully clean up all references on unsubscribeAll', async () => {
  await manager.subscribeToUserBands('user-1', ['band-1', 'band-2'])

  expect(manager.isConnected()).toBe(true)

  await manager.unsubscribeAll()

  // All state should be cleared
  expect(manager.isConnected()).toBe(false)
  // channels Map should be empty (can't test private field directly)
  // currentUserId should be null

  // Subsequent calls should work as if fresh instance
  await manager.subscribeToUserBands('user-1', ['band-3'])
  expect(manager.isConnected()).toBe(true)
})
```

---

### Category 6: Integration with IndexedDB

#### Test 6.1: IndexedDB Write Failure
```typescript
it('should handle IndexedDB write failures', async () => {
  mockDb.songs.put = vi.fn().mockRejectedValue(new Error('QuotaExceededError'))

  await manager.subscribeToUserBands('user-1', ['band-1'])

  const onCall = mockChannel.on.mock.calls[0]
  const handler = onCall[2]

  const eventSpy = vi.fn()
  manager.on('songs:changed', eventSpy)

  const payload = { /* valid audit payload */ }

  await handler(payload)

  // Should event still be emitted if DB write failed?
  // Should error be logged?
  // Should sync be retried?
})
```

---

### Category 7: Reconnection & Network Failures

#### Test 7.1: Reconnect Without Band IDs
```typescript
it('should fail to reconnect without stored band IDs', async () => {
  await manager.subscribeToUserBands('user-1', ['band-1'])

  // Simulate disconnect
  manager.handleDisconnect()
  expect(manager.isConnected()).toBe(false)

  // Try to reconnect
  await manager.reconnect()

  // BUG: Currently claims to be connected but has no subscriptions!
  expect(manager.isConnected()).toBe(true)  // FALSE sense of security
  // But no actual subscriptions exist
  expect(mockChannel.subscribe).toHaveBeenCalledTimes(1)  // Still just the original
})
```

---

## Test Implementation Priority

### P0: Critical Bugs (Must Fix Before Production)
1. ✅ Race condition in duplicate check → Already partially fixed
2. ❌ Event name mismatch (practice_sessions vs practices)
3. ❌ Reconnect claiming success without resubscribing
4. ❌ Malformed JSONB causing crashes

### P1: High Priority (Fix Soon)
1. ❌ Subscription error not propagated to caller
2. ❌ Connected status race condition
3. ❌ Invalid audit payloads silently ignored
4. ❌ Toast memory leak potential

### P2: Medium Priority (Nice to Have)
1. ❌ Remove deprecated code
2. ❌ Consistent userId handling
3. ❌ Event emitted before DB update guarantee

---

## Test Structure

Each test should:
1. **Setup:** Describe what we're testing and why
2. **Execute:** Run the scenario
3. **Assert:** Verify expected behavior
4. **Document:** If test fails, document the bug found

Example:
```typescript
it('CRITICAL: should handle concurrent subscriptions atomically', async () => {
  // WHY: Without atomic check-set, two concurrent calls can create duplicates
  // EXPECTED: Only one subscription per band regardless of timing
  // CURRENT STATE: Unknown - needs testing to verify

  const userId = 'user-1'
  const bandIds = ['band-1']

  await Promise.all([
    manager.subscribeToUserBands(userId, bandIds),
    manager.subscribeToUserBands(userId, bandIds)
  ])

  const channels = mockSupabase.channel.mock.calls
    .filter(c => c[0].startsWith('audit-'))

  expect(channels.length).toBe(1)

  // IF THIS FAILS: We have a race condition that can cause duplicate subscriptions
  // FIX: Use atomic operation or mutex/lock pattern
})
```

---

## Next Steps

1. Implement these tests
2. Run tests and document failures
3. Fix bugs found
4. Add tests to CI/CD to prevent regressions
5. Update specification with testing requirements

---

## Questions for Discussion

Before implementing, let's decide:

1. **Error Handling Philosophy:**
   - Should subscription errors throw or log?
   - Should malformed data crash or skip?
   - Should we have a global error handler?

2. **Reconnection Strategy:**
   - Should reconnect() track band IDs automatically?
   - Should we retry failed subscriptions?
   - How many retries before giving up?

3. **Memory Management:**
   - Should we limit pendingToasts size?
   - Should we have a max subscription count?
   - Should we clean up old channels?

4. **Event Naming:**
   - Fix `practice_sessions` → `practices` inconsistency?
   - Standardize all event names?
   - Document event contract?

These decisions will shape the test expectations!
