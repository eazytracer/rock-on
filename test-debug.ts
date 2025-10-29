import { useUpdatePractice, useDeletePractice, useAutoSuggestSongs } from './src/hooks/usePractices'

console.log('useUpdatePractice type:', typeof useUpdatePractice)
console.log('useDeletePractice type:', typeof useDeletePractice)
console.log('useAutoSuggestSongs type:', typeof useAutoSuggestSongs)

if (typeof useUpdatePractice === 'function') {
  console.log('✓ useUpdatePractice is a function')
} else {
  console.log('✗ useUpdatePractice is NOT a function:', useUpdatePractice)
}

if (typeof useDeletePractice === 'function') {
  console.log('✓ useDeletePractice is a function')
} else {
  console.log('✗ useDeletePractice is NOT a function:', useDeletePractice)
}

if (typeof useAutoSuggestSongs === 'function') {
  console.log('✓ useAutoSuggestSongs is a function')
} else {
  console.log('✗ useAutoSuggestSongs is NOT a function:', useAutoSuggestSongs)
}
