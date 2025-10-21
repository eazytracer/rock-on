# Confidence Level Editing Implementation Plan

## Overview
The application currently tracks song confidence levels (readiness) in the database and displays them throughout the UI, but lacks any user interface for editing these values. Users can see readiness indicators but cannot update them.

## Current State Analysis

### ✅ What Already Works
- **Database**: `confidenceLevel: number` field exists in Song model
- **Service Layer**: `SongService.submitConfidenceRating()` method available
- **Display Logic**: Confidence levels shown with color coding throughout app
- **Calculations**: Used in dashboards, setlist readiness reports, filtering

### ❌ What's Missing
- **No UI components** for editing confidence levels
- **No integration** between practice sessions and confidence updates
- **No quick rating** functionality in song lists/cards
- **No bulk editing** capabilities

## Implementation Plan

### Phase 1: Core Rating Component (Priority 1)

#### 1.1 Create StarRating Component
**File**: `src/components/common/StarRating.tsx`

```typescript
interface StarRatingProps {
  value: number
  onChange?: (rating: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  className?: string
}

export const StarRating: React.FC<StarRatingProps>
```

**Features**:
- Interactive star rating (1-5 stars)
- Touch-friendly for mobile
- Keyboard accessible
- Visual feedback on hover/focus
- Read-only mode for display
- Size variants for different contexts

#### 1.2 Create ConfidenceRating Component
**File**: `src/components/songs/ConfidenceRating.tsx`

```typescript
interface ConfidenceRatingProps {
  songId: string
  currentRating: number
  onRatingChange: (newRating: number) => Promise<void>
  compact?: boolean
  showLabel?: boolean
}

export const ConfidenceRating: React.FC<ConfidenceRatingProps>
```

**Features**:
- Wraps StarRating with song-specific logic
- Handles API calls to update confidence
- Loading states during updates
- Error handling and user feedback
- Compact mode for cards, full mode for forms

### Phase 2: Integration Points (Priority 2)

#### 2.1 Add to Song Cards
**File**: `src/components/songs/SongCard.tsx`

**Changes**:
- Add quick rating section below existing readiness badge
- Show in expanded/detailed view mode
- Replace static badge with interactive rating when editing enabled

```typescript
// Add to SongCard props
interface SongCardProps {
  // ... existing props
  allowRatingEdit?: boolean
  onConfidenceChange?: (songId: string, newRating: number) => Promise<void>
}
```

#### 2.2 Add to Song Edit Form
**File**: `src/components/songs/AddSongForm.tsx`

**Changes**:
- Add confidence level field to form
- Use StarRating component
- Include in form validation
- Handle in submit logic

#### 2.3 Add to Song Detail View
**Location**: Create new `src/components/songs/SongDetail.tsx` or enhance existing song views

**Features**:
- Prominent confidence rating section
- Historical practice data
- Last practiced date
- Confidence trend (if we track history)

### Phase 3: Enhanced Functionality (Priority 3)

#### 3.1 Quick Rating in Song Lists
**File**: `src/components/songs/SongList.tsx`

**Features**:
- Inline rating mode toggle
- Bulk rating actions
- Keyboard shortcuts for quick rating
- Rating progress indicator

#### 3.2 Practice Session Integration
**File**: `src/services/PracticeSessionService.ts`

**Changes**:
- Add confidence update logic to session completion
- Automatic confidence adjustment based on practice performance
- Optional post-practice rating prompts

#### 3.3 Bulk Rating Tools
**Location**: New `src/components/songs/BulkRatingPanel.tsx`

**Features**:
- Select multiple songs
- Apply same rating to selected songs
- Rating based on filters (key, difficulty, etc.)
- Undo/redo functionality

## Implementation Steps

### Step 1: Create Base Components
1. **StarRating Component**
   - Implement with pure CSS/Tailwind
   - Add touch/keyboard support
   - Test across devices
   - Create Storybook stories

2. **ConfidenceRating Component**
   - Integrate with SongService
   - Add loading/error states
   - Test API integration
   - Handle edge cases

### Step 2: Integrate with Existing Views
1. **Song Cards**
   - Add rating to expanded view
   - Test in different contexts (lists, search, setlist builder)
   - Ensure mobile responsiveness

2. **Song Forms**
   - Add to AddSongForm for new songs
   - Add to edit flow for existing songs
   - Update form validation

3. **Song Lists**
   - Add rating column option
   - Test with filtering/sorting
   - Ensure performance with large lists

### Step 3: Advanced Features
1. **Practice Integration**
   - Update confidence after practice sessions
   - Add rating prompts
   - Track confidence history

2. **Bulk Operations**
   - Multi-select functionality
   - Bulk rating UI
   - Progress indicators

## Technical Considerations

### Performance
- **Debounce rating updates** to avoid excessive API calls
- **Optimistic updates** for better UX
- **Batch updates** for bulk operations
- **Memoization** for rating components

### UX Design
- **Consistent styling** with existing UI patterns
- **Clear visual feedback** for rating changes
- **Accessible design** (ARIA labels, keyboard navigation)
- **Mobile-first** approach for touch interactions

### Data Integrity
- **Validation** (1-5 range enforcement)
- **Conflict resolution** for concurrent updates
- **Audit trail** (optional: track who changed what when)
- **Rollback capability** for accidental changes

## API Enhancements Needed

### Update SongService
**File**: `src/services/SongService.ts`

**Changes**:
```typescript
// Enhance existing method
static async submitConfidenceRating(
  songId: string,
  rating: ConfidenceRating
): Promise<{ averageConfidence: number, totalRatings: number }>

// Add new methods
static async updateConfidenceLevel(
  songId: string,
  confidenceLevel: number
): Promise<Song>

static async bulkUpdateConfidence(
  updates: Array<{songId: string, confidenceLevel: number}>
): Promise<Song[]>

static async getConfidenceHistory(
  songId: string
): Promise<ConfidenceHistoryEntry[]>
```

## Testing Strategy

### Unit Tests
- StarRating component interactions
- ConfidenceRating API integration
- Service method validation
- Edge case handling

### Integration Tests
- Song card rating updates
- Form submission with confidence
- List view rating changes
- Practice session updates

### E2E Tests
- Complete rating workflow
- Bulk rating operations
- Mobile touch interactions
- Keyboard navigation

## Migration Considerations

### Existing Data
- All songs currently have `confidenceLevel` field
- Default values are properly set
- No migration needed for database

### Backward Compatibility
- Keep existing display logic intact
- Add editing as enhancement
- Graceful degradation if API fails

## Success Metrics

### User Engagement
- **Rating frequency**: How often users update confidence levels
- **Feature adoption**: Percentage of songs with user-updated ratings
- **Session integration**: Confidence updates after practice sessions

### Data Quality
- **Rating distribution**: Healthy spread across 1-5 scale
- **Update frequency**: Regular confidence updates over time
- **Accuracy**: Ratings align with practice session outcomes

## Future Enhancements

### Advanced Features
1. **Confidence Trends**: Historical tracking and visualization
2. **Smart Suggestions**: AI-powered confidence level suggestions
3. **Team Consensus**: Multiple member ratings with averages
4. **Performance Correlation**: Link confidence to actual performance

### Analytics
1. **Readiness Dashboard**: Team-wide confidence analytics
2. **Practice Insights**: Confidence improvement tracking
3. **Setlist Optimization**: Confidence-based setlist recommendations

## Implementation Timeline

### Week 1: Core Components
- StarRating component
- ConfidenceRating component
- Basic testing

### Week 2: Integration
- Song card integration
- Form integration
- API testing

### Week 3: Enhanced Features
- List view integration
- Bulk operations
- Practice integration

### Week 4: Polish & Testing
- E2E testing
- Performance optimization
- Documentation updates

## Files to Create/Modify

### New Files
- `src/components/common/StarRating.tsx`
- `src/components/songs/ConfidenceRating.tsx`
- `src/components/songs/BulkRatingPanel.tsx`
- `tests/unit/StarRating.test.tsx`
- `tests/unit/ConfidenceRating.test.tsx`
- `tests/integration/confidence-rating.test.tsx`

### Modified Files
- `src/components/songs/SongCard.tsx`
- `src/components/songs/AddSongForm.tsx`
- `src/components/songs/SongList.tsx`
- `src/services/SongService.ts`
- `src/services/PracticeSessionService.ts`
- `src/pages/Songs/Songs.tsx`

This implementation will provide users with comprehensive confidence level editing capabilities while maintaining the existing functionality and improving the overall user experience.