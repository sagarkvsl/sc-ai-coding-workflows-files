import { useEffect } from 'react'
import { SEARCH_FIELD_ID, TITLE_FIELD_ID } from '../utils/fieldIds'

const SHORTCUT_TARGETS: Record<string, string> = {
  n: TITLE_FIELD_ID,
  '/': SEARCH_FIELD_ID,
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (isTypingTarget(event.target)) return
  const id = SHORTCUT_TARGETS[event.key]
  const element = id === undefined ? null : document.getElementById(id)
  if (element === null) return
  event.preventDefault()
  element.focus()
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
