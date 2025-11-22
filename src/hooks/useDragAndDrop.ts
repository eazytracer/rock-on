import { useGesture } from '@use-gesture/react'
import { useCallback, useRef, useState } from 'react'

export interface DragItem<T = unknown> {
  id: string
  data: T
  index: number
}

export interface DropZone {
  id: string
  accepts: string[]
  index?: number
}

export interface DragState<T = unknown> {
  isDragging: boolean
  draggedItem: DragItem<T> | null
  draggedOverZone: string | null
  dragOffset: { x: number; y: number }
  canDrop: boolean
}

export interface DragAndDropOptions<T = unknown> {
  type?: string
  data?: T
  onDragStart?: (item: DragItem<T>) => void
  onDragEnd?: (item: DragItem<T>) => void
  onDrop?: (
    draggedItem: DragItem<T>,
    dropZone: DropZone,
    targetIndex?: number
  ) => void
  onReorder?: (fromIndex: number, toIndex: number) => void
  enableHaptics?: boolean
  dragThreshold?: number
  snapToGrid?: boolean
  gridSize?: { x: number; y: number }
}

export function useDragAndDrop<T = unknown>(
  options: DragAndDropOptions<T> = {}
) {
  const {
    type = 'default',
    data,
    onDragStart,
    onDragEnd,
    onDrop,
    onReorder,
    enableHaptics = true,
    dragThreshold = 5,
    snapToGrid = false,
    gridSize = { x: 20, y: 20 },
  } = options

  const [dragState, setDragState] = useState<DragState<T>>({
    isDragging: false,
    draggedItem: null,
    draggedOverZone: null,
    dragOffset: { x: 0, y: 0 },
    canDrop: false,
  })

  const dragElementRef = useRef<HTMLElement>(null)
  const dropZones = useRef<Map<string, DropZone>>(new Map())

  const triggerHapticFeedback = useCallback(
    (intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
      if (enableHaptics && 'vibrate' in navigator) {
        const vibrationPattern = {
          light: 10,
          medium: 25,
          heavy: 50,
        }
        navigator.vibrate(vibrationPattern[intensity])
      }
    },
    [enableHaptics]
  )

  const snapToGridCoordinates = useCallback(
    (x: number, y: number) => {
      if (!snapToGrid) return { x, y }

      return {
        x: Math.round(x / gridSize.x) * gridSize.x,
        y: Math.round(y / gridSize.y) * gridSize.y,
      }
    },
    [snapToGrid, gridSize]
  )

  const findDropZoneAtPosition = useCallback(
    (x: number, y: number): DropZone | null => {
      const elements = document.elementsFromPoint(x, y)

      for (const element of elements) {
        const zoneId = element.getAttribute('data-drop-zone')
        if (zoneId && dropZones.current.has(zoneId)) {
          return dropZones.current.get(zoneId)!
        }
      }

      return null
    },
    []
  )

  const registerDropZone = useCallback((zone: DropZone) => {
    dropZones.current.set(zone.id, zone)

    return () => {
      dropZones.current.delete(zone.id)
    }
  }, [])

  // Main drag gesture hook
  const useDraggable = useCallback(
    (id: string, index: number, itemData?: T) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const bind = useGesture(
        {
          onDrag: ({ movement: [mx, my], first, last, event }) => {
            if (first) {
              const item: DragItem<T> = {
                id,
                data: (itemData ?? data) as T,
                index,
              }

              setDragState({
                isDragging: true,
                draggedItem: item,
                draggedOverZone: null,
                dragOffset: { x: 0, y: 0 },
                canDrop: false,
              })

              triggerHapticFeedback('light')
              onDragStart?.(item)
            }

            if (!last) {
              const snappedOffset = snapToGridCoordinates(mx, my)

              // Find drop zone at current position
              const clientRect = (
                event.target as Element
              )?.getBoundingClientRect()
              if (clientRect) {
                const pageX = clientRect.left + mx
                const pageY = clientRect.top + my
                const dropZone = findDropZoneAtPosition(pageX, pageY)

                const canDrop = dropZone?.accepts.includes(type) ?? false

                setDragState(prev => {
                  const newState = {
                    ...prev,
                    dragOffset: snappedOffset,
                    draggedOverZone: dropZone?.id ?? null,
                    canDrop,
                  }

                  // Haptic feedback when entering valid drop zone
                  if (
                    dropZone &&
                    canDrop &&
                    prev.draggedOverZone !== dropZone.id
                  ) {
                    triggerHapticFeedback('medium')
                  }

                  return newState
                })
              }
            }

            if (last) {
              const currentState = dragState
              const finalItem = currentState.draggedItem

              if (finalItem) {
                // Find final drop zone
                const clientRect = (
                  event.target as Element
                )?.getBoundingClientRect()
                if (clientRect) {
                  const pageX = clientRect.left + mx
                  const pageY = clientRect.top + my
                  const dropZone = findDropZoneAtPosition(pageX, pageY)

                  if (dropZone && dropZone.accepts.includes(type)) {
                    triggerHapticFeedback('heavy')

                    // Handle reordering if it's within the same list
                    if (dropZone.index !== undefined && onReorder) {
                      onReorder(finalItem.index, dropZone.index)
                    } else {
                      onDrop?.(finalItem, dropZone, dropZone.index)
                    }
                  }
                }

                onDragEnd?.(finalItem)
              }

              setDragState({
                isDragging: false,
                draggedItem: null,
                draggedOverZone: null,
                dragOffset: { x: 0, y: 0 },
                canDrop: false,
              })
            }
          },
        },
        {
          drag: {
            threshold: dragThreshold,
            filterTaps: true,
            rubberband: false,
          },
        }
      )

      return bind
    },
    [
      data,
      type,
      dragThreshold,
      onDragStart,
      onDragEnd,
      onDrop,
      onReorder,
      snapToGridCoordinates,
      findDropZoneAtPosition,
      triggerHapticFeedback,
      dragState,
    ]
  )

  // Drop zone hook
  const useDroppable = useCallback(
    (zoneId: string, accepts: string[] = [type], index?: number) => {
      const dropZone: DropZone = { id: zoneId, accepts, index }

      const bindProps = {
        'data-drop-zone': zoneId,
        className:
          dragState.draggedOverZone === zoneId
            ? dragState.canDrop
              ? 'drop-zone-active'
              : 'drop-zone-invalid'
            : 'drop-zone',
      }

      // Register/unregister drop zone
      const cleanup = registerDropZone(dropZone)

      return {
        ...bindProps,
        cleanup,
        isOver: dragState.draggedOverZone === zoneId,
        canDrop: dragState.canDrop && dragState.draggedOverZone === zoneId,
      }
    },
    [type, dragState, registerDropZone]
  )

  return {
    dragState,
    useDraggable,
    useDroppable,
    ref: dragElementRef,
  }
}

// Specialized hook for list reordering
export function useListReorder<T>(
  items: T[],
  onReorder: (newOrder: T[]) => void,
  keyExtractor: (item: T, index: number) => string,
  options: Omit<DragAndDropOptions<T>, 'onReorder'> = {}
) {
  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newItems = [...items]
      const [movedItem] = newItems.splice(fromIndex, 1)
      newItems.splice(toIndex, 0, movedItem)
      onReorder(newItems)
    },
    [items, onReorder]
  )

  const dragAndDrop = useDragAndDrop<T>({
    ...options,
    onReorder: handleReorder,
  })

  const getItemProps = useCallback(
    (item: T, index: number) => {
      const key = keyExtractor(item, index)
      const draggable = dragAndDrop.useDraggable(key, index, item)
      const droppable = dragAndDrop.useDroppable(
        `${key}-drop`,
        [options.type || 'default'],
        index
      )

      return {
        ...draggable(),
        ...droppable,
        'data-item-id': key,
        style: {
          transform:
            dragAndDrop.dragState.draggedItem?.id === key
              ? `translate(${dragAndDrop.dragState.dragOffset.x}px, ${dragAndDrop.dragState.dragOffset.y}px)`
              : undefined,
          zIndex:
            dragAndDrop.dragState.draggedItem?.id === key ? 1000 : undefined,
          opacity: dragAndDrop.dragState.draggedItem?.id === key ? 0.8 : 1,
          transition: dragAndDrop.dragState.isDragging
            ? 'none'
            : 'all 0.2s ease-in-out',
        },
      }
    },
    [dragAndDrop, keyExtractor, options.type]
  )

  return {
    ...dragAndDrop,
    getItemProps,
  }
}

// Hook specifically for setlist reordering
export function useSetlistReorder<T extends { id: string; order?: number }>(
  songs: T[],
  onSongReorder: (songId: string, fromIndex: number, toIndex: number) => void,
  options: Omit<DragAndDropOptions<T>, 'onReorder'> = {}
) {
  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const song = songs[fromIndex]
      if (song) {
        onSongReorder(song.id, fromIndex, toIndex)
      }
    },
    [songs, onSongReorder]
  )

  return useDragAndDrop<T>({
    ...options,
    type: 'setlist-song',
    onReorder: handleReorder,
    enableHaptics: true,
  })
}

// Hook for drag-to-remove functionality
export function useDragToRemove<T>(
  onRemove: (item: T) => void,
  options: Omit<DragAndDropOptions<T>, 'onDrop'> = {}
) {
  const handleDrop = useCallback(
    (draggedItem: DragItem<T>, dropZone: DropZone) => {
      if (dropZone.id === 'remove-zone') {
        onRemove(draggedItem.data)
      }
    },
    [onRemove]
  )

  return useDragAndDrop<T>({
    ...options,
    onDrop: handleDrop,
  })
}
