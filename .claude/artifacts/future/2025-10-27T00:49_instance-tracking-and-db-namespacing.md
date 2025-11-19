---
title: Instance Tracking & IndexedDB Namespacing
created: 2025-10-27T00:49
prompt: User noticed stale IndexedDB data when switching between Supabase instances (local vs production). Need to namespace IndexedDB by instance ID to prevent conflicts.
status: Implementation Ready
priority: P1 - Important (Development & Production Quality)
---

# Instance Tracking & IndexedDB Namespacing

## Problem Statement

**Current Issue**:
When switching between Supabase instances (e.g., production → local development):
1. Browser retains old IndexedDB data from previous instance
2. App tries to sync stale data with new database
3. User must use incognito mode to get fresh state
4. Risk of data confusion/corruption

**Example Scenario**:
```
1. Developer uses production Supabase (https://prod123.supabase.co)
   → IndexedDB: "RockOnDB" contains production data

2. Developer switches to local Supabase (http://localhost:54321)
   → IndexedDB: "RockOnDB" STILL contains production data
   → App tries to sync production data with local database
   → Conflicts, errors, confusion
```

**Root Cause**:
- IndexedDB database name is hardcoded as `"RockOnDB"`
- Not namespaced by Supabase instance
- No detection of instance changes

---

## Solution Design

### Overview

**Namespace IndexedDB by Instance ID**:
- Extract unique ID from Supabase URL
- Use format: `RockOnDB-{instanceId}`
- Store current instance ID in localStorage
- Detect and handle instance changes

**Instance ID Sources**:
- **Production**: Supabase project ref from URL (e.g., `abcd1234efgh5678`)
- **Local Supabase**: Hash of URL (e.g., `local-54321`)
- **Local-only mode**: Fixed ID `"local-only"`

**Benefits**:
- ✅ Clean separation between environments
- ✅ No stale data conflicts
- ✅ Automatic instance detection
- ✅ Can switch environments without clearing data
- ✅ Can inspect multiple instance DBs in DevTools

---

## Implementation Plan

### Part 1: Instance ID Service

**New File**: `src/services/InstanceIdService.ts`

```typescript
import { config } from '../config/appMode'
import { createHash } from 'crypto-browserify' // Or use a simple hash function

export class InstanceIdService {
  private static readonly STORAGE_KEY = 'rockon-instance-id'
  private static readonly STORAGE_KEY_TIMESTAMP = 'rockon-instance-timestamp'

  /**
   * Get the current instance ID based on Supabase URL or mode
   */
  static getCurrentInstanceId(): string {
    if (config.isLocal) {
      // Local-only mode (no Supabase)
      return 'local-only'
    }

    if (!config.supabaseUrl) {
      return 'local-only'
    }

    // Extract instance ID from Supabase URL
    return this.extractInstanceIdFromUrl(config.supabaseUrl)
  }

  /**
   * Extract instance ID from Supabase URL
   *
   * Examples:
   * - https://abcd1234efgh5678.supabase.co → "abcd1234efgh5678"
   * - http://localhost:54321 → "local-54321"
   * - http://127.0.0.1:54321 → "local-54321"
   */
  private static extractInstanceIdFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)

      // Check if it's a Supabase cloud URL
      if (urlObj.hostname.endsWith('.supabase.co')) {
        // Extract project ref (subdomain)
        const projectRef = urlObj.hostname.split('.')[0]
        return projectRef
      }

      // Check if it's localhost or 127.0.0.1
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        const port = urlObj.port || '80'
        return `local-${port}`
      }

      // For any other URL, create a hash
      return this.hashUrl(url)
    } catch (error) {
      console.error('Failed to parse Supabase URL:', error)
      return 'unknown'
    }
  }

  /**
   * Create a short hash of a URL for use as instance ID
   */
  private static hashUrl(url: string): string {
    // Simple hash function (can use crypto.subtle.digest for better hash)
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `custom-${Math.abs(hash).toString(36)}`
  }

  /**
   * Get the previously stored instance ID
   */
  static getStoredInstanceId(): string | null {
    return localStorage.getItem(this.STORAGE_KEY)
  }

  /**
   * Get when the instance was last updated
   */
  static getStoredInstanceTimestamp(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_TIMESTAMP)
  }

  /**
   * Store the current instance ID
   */
  static storeInstanceId(instanceId: string): void {
    localStorage.setItem(this.STORAGE_KEY, instanceId)
    localStorage.setItem(this.STORAGE_KEY_TIMESTAMP, new Date().toISOString())
  }

  /**
   * Check if the instance has changed since last run
   */
  static hasInstanceChanged(): boolean {
    const current = this.getCurrentInstanceId()
    const stored = this.getStoredInstanceId()

    if (!stored) {
      // First run, no previous instance
      return false
    }

    return current !== stored
  }

  /**
   * Get instance change details
   */
  static getInstanceChangeInfo(): {
    hasChanged: boolean
    currentId: string
    previousId: string | null
    previousTimestamp: string | null
  } {
    return {
      hasChanged: this.hasInstanceChanged(),
      currentId: this.getCurrentInstanceId(),
      previousId: this.getStoredInstanceId(),
      previousTimestamp: this.getStoredInstanceTimestamp(),
    }
  }

  /**
   * Get the database name for the current instance
   */
  static getDatabaseName(): string {
    const instanceId = this.getCurrentInstanceId()
    return `RockOnDB-${instanceId}`
  }

  /**
   * Get database name for a specific instance ID
   */
  static getDatabaseNameForInstance(instanceId: string): string {
    return `RockOnDB-${instanceId}`
  }

  /**
   * List all RockOn databases in IndexedDB
   */
  static async listAllDatabases(): Promise<string[]> {
    if (!('databases' in indexedDB)) {
      // Fallback for browsers that don't support indexedDB.databases()
      return []
    }

    const dbs = await indexedDB.databases()
    return dbs
      .filter(db => db.name?.startsWith('RockOnDB-'))
      .map(db => db.name!)
  }

  /**
   * Clear a specific database by instance ID
   */
  static async clearDatabase(instanceId: string): Promise<void> {
    const dbName = this.getDatabaseNameForInstance(instanceId)
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => {
        console.warn(`Delete of ${dbName} is blocked. Close all tabs using this database.`)
      }
    })
  }

  /**
   * Clear the previous instance's database
   */
  static async clearPreviousDatabase(): Promise<void> {
    const previousId = this.getStoredInstanceId()
    if (!previousId) return

    await this.clearDatabase(previousId)
  }

  /**
   * Get human-readable instance description
   */
  static getInstanceDescription(instanceId: string): string {
    if (instanceId === 'local-only') {
      return 'Local-only mode (no Supabase sync)'
    }

    if (instanceId.startsWith('local-')) {
      const port = instanceId.split('-')[1]
      return `Local Supabase (port ${port})`
    }

    if (instanceId.startsWith('custom-')) {
      return 'Custom Supabase instance'
    }

    // Cloud instance
    return `Supabase Cloud (${instanceId})`
  }
}
```

---

### Part 2: Update Database Initialization

**Update File**: `src/services/database/index.ts`

**Current**:
```typescript
export class RockOnDB extends Dexie {
  constructor() {
    super('RockOnDB') // Hardcoded name
    // ...
  }
}
```

**Updated**:
```typescript
import { InstanceIdService } from '../InstanceIdService'

export class RockOnDB extends Dexie {
  constructor() {
    // Use instance-specific database name
    const dbName = InstanceIdService.getDatabaseName()
    super(dbName)

    console.log(`📦 Using IndexedDB: ${dbName}`)

    // ... rest of constructor
  }
}
```

---

### Part 3: Instance Change Detection Hook

**New File**: `src/hooks/useInstanceChangeDetection.ts`

```typescript
import { useEffect, useState } from 'react'
import { InstanceIdService } from '../services/InstanceIdService'

export interface InstanceChangeInfo {
  hasChanged: boolean
  currentId: string
  currentDescription: string
  previousId: string | null
  previousDescription: string | null
  previousTimestamp: string | null
}

export function useInstanceChangeDetection() {
  const [changeInfo, setChangeInfo] = useState<InstanceChangeInfo | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    checkForInstanceChange()
  }, [])

  async function checkForInstanceChange() {
    setIsChecking(true)

    const info = InstanceIdService.getInstanceChangeInfo()

    if (info.hasChanged) {
      setChangeInfo({
        hasChanged: true,
        currentId: info.currentId,
        currentDescription: InstanceIdService.getInstanceDescription(info.currentId),
        previousId: info.previousId,
        previousDescription: info.previousId
          ? InstanceIdService.getInstanceDescription(info.previousId)
          : null,
        previousTimestamp: info.previousTimestamp,
      })
    } else {
      // No change, update stored ID
      InstanceIdService.storeInstanceId(info.currentId)
    }

    setIsChecking(false)
  }

  async function acceptNewInstance(clearOldData: boolean = true) {
    if (!changeInfo) return

    if (clearOldData && changeInfo.previousId) {
      console.log(`🗑️  Clearing old database: ${changeInfo.previousId}`)
      await InstanceIdService.clearDatabase(changeInfo.previousId)
    }

    // Store new instance ID
    InstanceIdService.storeInstanceId(changeInfo.currentId)

    // Clear change info
    setChangeInfo(null)

    // Reload page to reinitialize with new database
    window.location.reload()
  }

  async function keepBothDatabases() {
    if (!changeInfo) return

    // Store new instance ID without clearing old one
    InstanceIdService.storeInstanceId(changeInfo.currentId)

    // Clear change info
    setChangeInfo(null)

    // Reload page to use new database
    window.location.reload()
  }

  return {
    isChecking,
    changeInfo,
    acceptNewInstance,
    keepBothDatabases,
  }
}
```

---

### Part 4: Instance Change Modal

**New Component**: `src/components/InstanceChangeModal.tsx`

```typescript
import React from 'react'
import { InstanceChangeInfo } from '../hooks/useInstanceChangeDetection'

interface Props {
  changeInfo: InstanceChangeInfo
  onAccept: (clearOldData: boolean) => Promise<void>
  onKeepBoth: () => Promise<void>
}

export function InstanceChangeModal({ changeInfo, onAccept, onKeepBoth }: Props) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClearAndContinue = async () => {
    setIsProcessing(true)
    await onAccept(true)
  }

  const handleKeepBoth = async () => {
    setIsProcessing(true)
    await onKeepBoth()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg p-6">
        <h2 className="text-2xl font-bold mb-4">
          🔄 Database Instance Changed
        </h2>

        <div className="mb-6">
          <p className="mb-3">
            You've switched to a different Supabase instance:
          </p>

          <div className="bg-gray-100 p-3 rounded mb-2">
            <div className="text-sm text-gray-600">Previous:</div>
            <div className="font-mono text-sm">{changeInfo.previousDescription}</div>
            {changeInfo.previousTimestamp && (
              <div className="text-xs text-gray-500 mt-1">
                Last used: {new Date(changeInfo.previousTimestamp).toLocaleString()}
              </div>
            )}
          </div>

          <div className="bg-blue-100 p-3 rounded">
            <div className="text-sm text-blue-600">Current:</div>
            <div className="font-mono text-sm">{changeInfo.currentDescription}</div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-700">
            Your browser has local data from the previous instance. What would you like to do?
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleClearAndContinue}
            disabled={isProcessing}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-left"
          >
            <div className="font-semibold">Clear old data and continue</div>
            <div className="text-sm text-blue-100 mt-1">
              Recommended for development. Old local data will be deleted.
            </div>
          </button>

          <button
            onClick={handleKeepBoth}
            disabled={isProcessing}
            className="w-full px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-left"
          >
            <div className="font-semibold">Keep both databases separate</div>
            <div className="text-sm text-gray-600 mt-1">
              Old data preserved. You can inspect it later in DevTools.
            </div>
          </button>
        </div>

        {isProcessing && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Processing... Page will reload.
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer hover:text-gray-800">
              Technical Details
            </summary>
            <div className="mt-2 space-y-1">
              <div>
                <span className="font-mono text-xs">Current DB:</span>{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">
                  RockOnDB-{changeInfo.currentId}
                </code>
              </div>
              {changeInfo.previousId && (
                <div>
                  <span className="font-mono text-xs">Previous DB:</span>{' '}
                  <code className="text-xs bg-gray-100 px-1 rounded">
                    RockOnDB-{changeInfo.previousId}
                  </code>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
```

---

### Part 5: Integrate into App

**Update File**: `src/App.tsx`

```typescript
import { useInstanceChangeDetection } from './hooks/useInstanceChangeDetection'
import { InstanceChangeModal } from './components/InstanceChangeModal'

function App() {
  const { isChecking, changeInfo, acceptNewInstance, keepBothDatabases } =
    useInstanceChangeDetection()

  // Show loading while checking
  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Checking database instance...</div>
      </div>
    )
  }

  // Show instance change modal if detected
  if (changeInfo) {
    return (
      <InstanceChangeModal
        changeInfo={changeInfo}
        onAccept={acceptNewInstance}
        onKeepBoth={keepBothDatabases}
      />
    )
  }

  // Normal app rendering
  return (
    <div className="App">
      {/* Your existing app */}
    </div>
  )
}
```

---

## Environment Variable Setup

### .env.local (Local Development)
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# Optional: Force instance ID (for testing)
# VITE_INSTANCE_ID=dev-local
```

### .env.production (Production)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
```

**Instance ID Detection**:
- Local: `http://localhost:54321` → `local-54321`
- Production: `https://abcd1234.supabase.co` → `abcd1234`

---

## Testing Scenarios

### Scenario 1: First Run
```
1. User opens app for first time
2. No stored instance ID
3. Current instance: local-54321
4. Store instance ID in localStorage
5. Use database: RockOnDB-local-54321
✅ No modal shown
```

### Scenario 2: Same Instance
```
1. User opens app
2. Stored instance: local-54321
3. Current instance: local-54321
4. No change detected
✅ No modal shown, use existing database
```

### Scenario 3: Switch from Local to Production
```
1. User opens app
2. Stored instance: local-54321
3. Current instance: abcd1234 (production)
4. Change detected!
5. Show modal:
   - Previous: Local Supabase (port 54321)
   - Current: Supabase Cloud (abcd1234)
6. User chooses "Clear old data"
7. Delete RockOnDB-local-54321
8. Store new instance: abcd1234
9. Reload → Use RockOnDB-abcd1234
✅ Clean switch to production
```

### Scenario 4: Switch Back to Local
```
1. User switches .env back to local
2. Stored instance: abcd1234
3. Current instance: local-54321
4. Change detected!
5. Show modal:
   - Previous: Supabase Cloud (abcd1234)
   - Current: Local Supabase (port 54321)
6. User chooses "Keep both"
7. Keep RockOnDB-abcd1234 (production data preserved)
8. Store new instance: local-54321
9. Reload → Use RockOnDB-local-54321
✅ Can switch back to production later without losing data
```

---

## Database Management Utilities

### Developer Tools Panel

Add a debug panel to help developers manage databases:

**New Component**: `src/components/dev/DatabaseManager.tsx`

```typescript
export function DatabaseManager() {
  const [databases, setDatabases] = useState<string[]>([])

  useEffect(() => {
    loadDatabases()
  }, [])

  async function loadDatabases() {
    const dbs = await InstanceIdService.listAllDatabases()
    setDatabases(dbs)
  }

  async function handleDelete(dbName: string) {
    if (!confirm(`Delete ${dbName}? This cannot be undone.`)) return

    const instanceId = dbName.replace('RockOnDB-', '')
    await InstanceIdService.clearDatabase(instanceId)
    await loadDatabases()
  }

  const currentDb = InstanceIdService.getDatabaseName()

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">IndexedDB Databases</h3>

      <div className="mb-2">
        <span className="text-sm text-gray-600">Current:</span>{' '}
        <code className="bg-blue-100 px-2 py-1 rounded">{currentDb}</code>
      </div>

      <ul className="space-y-2">
        {databases.map(db => (
          <li key={db} className="flex items-center justify-between">
            <code className="text-sm">{db}</code>
            {db !== currentDb && (
              <button
                onClick={() => handleDelete(db)}
                className="text-red-600 text-sm hover:underline"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      {databases.length === 0 && (
        <div className="text-sm text-gray-500">No databases found</div>
      )}
    </div>
  )
}
```

---

## Migration Strategy

### Existing Users (Production)

For users who already have data in the old `RockOnDB`:

**Option 1: Automatic Migration** (Recommended)
```typescript
// In database initialization
async function migrateFromLegacyDatabase() {
  const legacyDbName = 'RockOnDB'
  const newDbName = InstanceIdService.getDatabaseName()

  // Check if legacy DB exists and new DB doesn't
  const dbs = await indexedDB.databases()
  const hasLegacy = dbs.some(db => db.name === legacyDbName)
  const hasNew = dbs.some(db => db.name === newDbName)

  if (hasLegacy && !hasNew) {
    console.log('🔄 Migrating from legacy database...')

    // Rename legacy database to new name
    // Note: IndexedDB doesn't support rename, so we'd need to copy data

    // For simplicity, just log and ask user
    console.log(`Please manually rename ${legacyDbName} to ${newDbName} in DevTools`)
    console.log('Or clear all data and start fresh')
  }
}
```

**Option 2: Keep Legacy as Fallback**
- First run: Use `RockOnDB` if it exists
- Store instance ID after successful connection
- Future runs: Use instance-specific name

---

## Benefits

### For Developers
- ✅ Switch between local/production without conflicts
- ✅ Test migrations safely (keep production data separate)
- ✅ Inspect multiple instances in DevTools
- ✅ Clear old data easily

### For Production
- ✅ Prevent accidental data mixing
- ✅ Support multi-account scenarios (future)
- ✅ Better error messages (know which instance has issues)
- ✅ Easier debugging (clear instance identification)

### For Testing
- ✅ Can test with multiple Supabase projects
- ✅ Automated tests can use unique instance IDs
- ✅ Parallel test runs won't conflict

---

## Edge Cases

### No Supabase URL (Local-Only Mode)
- Instance ID: `local-only`
- Database: `RockOnDB-local-only`
- Consistent across sessions

### Custom Supabase Instances
- Hash the URL to create unique ID
- Format: `custom-{hash}`
- Example: `RockOnDB-custom-a7f3b2`

### Invalid URLs
- Fallback to `unknown`
- Log warning for developer
- Still namespaced to prevent conflicts

### Browser Compatibility
- `indexedDB.databases()` not supported in all browsers
- Fallback: Manual database management in DevTools
- Still prevents conflicts via namespacing

---

## Implementation Checklist

### Phase 1: Core Service (30 min)
- [ ] Create `InstanceIdService.ts`
- [ ] Add instance ID extraction logic
- [ ] Add localStorage management
- [ ] Add database name generation
- [ ] Write unit tests

### Phase 2: Database Integration (15 min)
- [ ] Update `RockOnDB` constructor to use instance-specific name
- [ ] Test with different instance IDs
- [ ] Verify old data doesn't interfere

### Phase 3: Change Detection (30 min)
- [ ] Create `useInstanceChangeDetection` hook
- [ ] Add instance change info retrieval
- [ ] Add accept/reject handlers
- [ ] Write tests

### Phase 4: UI Components (45 min)
- [ ] Create `InstanceChangeModal` component
- [ ] Style modal
- [ ] Add loading states
- [ ] Add technical details section

### Phase 5: App Integration (15 min)
- [ ] Integrate hook into `App.tsx`
- [ ] Add loading state
- [ ] Add modal rendering
- [ ] Test full flow

### Phase 6: Developer Tools (Optional, 30 min)
- [ ] Create `DatabaseManager` component
- [ ] Add to dev tools panel
- [ ] Test database deletion
- [ ] Add to settings page

### Phase 7: Testing (30 min)
- [ ] Test first run (no stored ID)
- [ ] Test same instance
- [ ] Test local → production switch
- [ ] Test production → local switch
- [ ] Test "keep both" option
- [ ] Test "clear old" option

**Total Time: 2.5-3 hours**

---

## Example Usage

### Console Logging (Development)

When app starts:
```
🚀 Rock On running in production mode
☁️  Using production mode (Dexie + Supabase sync)
📦 Using IndexedDB: RockOnDB-abcd1234efgh5678
```

When instance changes:
```
🔄 Instance changed!
   Previous: local-54321 (Local Supabase)
   Current: abcd1234efgh5678 (Supabase Cloud)
🗑️  Clearing old database: RockOnDB-local-54321
✅ Switched to: RockOnDB-abcd1234efgh5678
```

### DevTools Inspection

Can see all databases:
```
Application → Storage → IndexedDB
  - RockOnDB-local-54321 (96.4 KB)
  - RockOnDB-abcd1234 (2.1 MB)
  - RockOnDB-local-only (512 KB)
```

---

## Configuration Options

### Force Instance ID (for Testing)

```typescript
// In config/appMode.ts
export function getConfig(): AppConfig {
  return {
    // ... other config

    // Override instance ID for testing
    instanceId: import.meta.env.VITE_INSTANCE_ID || undefined,
  }
}

// In InstanceIdService
static getCurrentInstanceId(): string {
  // Check for override
  if (config.instanceId) {
    return config.instanceId
  }

  // Normal detection
  // ...
}
```

### Disable Instance Checking (for Testing)

```typescript
// In App.tsx
const skipInstanceCheck = import.meta.env.VITE_SKIP_INSTANCE_CHECK === 'true'

if (!skipInstanceCheck) {
  const { changeInfo } = useInstanceChangeDetection()
  // ...
}
```

---

## Future Enhancements

### Multi-Account Support
- Allow users to switch between multiple accounts
- Each account gets its own instance ID
- Quick account switcher in UI

### Cloud Backup/Restore
- Backup local database to cloud storage
- Restore from cloud when switching devices
- Link databases across instances

### Instance Sync
- Sync data between instances (e.g., local → production)
- Selective sync (only certain tables)
- Conflict resolution

### Analytics
- Track instance usage
- Detect common switching patterns
- Optimize database initialization

---

## Summary

**Problem**: IndexedDB conflicts when switching Supabase instances

**Solution**: Namespace IndexedDB by instance ID
- Extract ID from Supabase URL
- Use format: `RockOnDB-{instanceId}`
- Detect and handle instance changes
- Allow user to clear or keep old data

**Impact**:
- ✅ No more stale data conflicts
- ✅ Clean environment switching
- ✅ Better development experience
- ✅ Production-ready multi-instance support

**Implementation**: 2.5-3 hours
**Testing**: Comprehensive scenarios covered
**Migration**: Smooth for existing users

---

**Status**: Design complete, ready for implementation
**Next Action**: User review and approval to proceed
