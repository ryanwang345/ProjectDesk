import { useState, useEffect, useRef, useCallback } from 'react'
import { MiniDictionaryTooltipCard } from '@/components/mini-dictionary-tooltip'
import { getDictionaryEntry, type MiniDictionaryEntry } from '@/lib/dictionary'
import { useEnglish } from '@/hooks/use-english'

const STORAGE_KEY = 'projectdesk.hover_dictionary_enabled'
const listeners = new Set<() => void>()
let isGlobalHoverEnabled = true

try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved !== null) {
    isGlobalHoverEnabled = saved === 'true'
  }
} catch {
  // Ignore local storage error
}

export function setGlobalHoverDictionaryEnabled(enabled: boolean) {
  isGlobalHoverEnabled = enabled
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // Ignore local storage error
  }
  for (const listener of listeners) listener()
}

export function useHoverDictionaryToggle() {
  const [enabled, setEnabled] = useState(isGlobalHoverEnabled)
  useEffect(() => {
    const handleUpdate = () => setEnabled(isGlobalHoverEnabled)
    listeners.add(handleUpdate)
    return () => {
      listeners.delete(handleUpdate)
    }
  }, [])

  const toggle = useCallback(() => {
    setGlobalHoverDictionaryEnabled(!isGlobalHoverEnabled)
  }, [])

  return { enabled, toggle }
}

/** Trivial non-content words that do not need dictionary tooltips */
const TRIVIAL_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'nor', 'so',
  'in', 'on', 'at', 'to', 'for', 'of', 'by', 'with', 'from', 'as',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'it', 'its', 'this', 'that', 'these', 'those',
  'he', 'she', 'they', 'them', 'his', 'her', 'their', 'we', 'us', 'our', 'you', 'your', 'my', 'me',
])

/** Check if character is a valid English word character */
function isWordChar(char: string | undefined): boolean {
  if (!char) return false
  return /[a-zA-Z]/.test(char)
}

/** Check if character is part of a contraction or hyphenated word */
function isWordBoundaryChar(char: string | undefined): boolean {
  if (!char) return false
  return /[-a-zA-Z']/.test(char)
}

/**
 * Filter out buttons, links, form controls, navigation bars, headers, footers,
 * badges, and other non-reading UI chrome elements so tooltips never appear on them.
 */
function isInteractiveOrUiControl(element: Element | null): boolean {
  if (!element) return true

  // 1. Direct interactive tags & roles (Buttons, links, inputs, selects, tabs, menus, dialogs)
  if (
    element.closest('button') ||
    element.closest('a') ||
    element.closest('input') ||
    element.closest('textarea') ||
    element.closest('select') ||
    element.closest('option') ||
    element.closest('[role="button"]') ||
    element.closest('[role="tab"]') ||
    element.closest('[role="tablist"]') ||
    element.closest('[role="link"]') ||
    element.closest('[role="menu"]') ||
    element.closest('[role="menuitem"]') ||
    element.closest('[role="switch"]') ||
    element.closest('[role="checkbox"]') ||
    element.closest('[role="radio"]') ||
    element.closest('[role="dialog"]') ||
    element.closest('[role="tooltip"]') ||
    element.closest('[data-no-dict-hover]') ||
    element.closest('[data-interactive-gloss]')
  ) {
    return true
  }

  // 2. UI Chrome / Layout Containers (Navigation, header, footer, sidebar, badges)
  if (
    element.closest('nav') ||
    element.closest('header') ||
    element.closest('footer') ||
    element.closest('aside') ||
    element.closest('[data-sidebar]') ||
    element.closest('.site-header') ||
    element.closest('.badge') ||
    element.closest('[data-slot="badge"]')
  ) {
    return true
  }

  // 3. Any element with cursor: pointer or explicit clickable semantics
  let cur: HTMLElement | null = element as HTMLElement
  let depth = 0
  while (cur && depth < 5 && cur !== document.body) {
    if (
      cur.tagName === 'BUTTON' ||
      cur.tagName === 'A' ||
      cur.getAttribute('role') === 'button' ||
      cur.getAttribute('role') === 'tab'
    ) {
      return true
    }
    const style = window.getComputedStyle(cur)
    if (style.cursor === 'pointer') {
      return true
    }
    cur = cur.parentElement
    depth++
  }

  return false
}

/** Find word under coordinate using caret position or element text traversal */
function getWordAtPoint(
  x: number,
  y: number,
): { word: string; rect: DOMRect; sentence: string } | null {
  // 1. Check topmost element under cursor - ignore buttons & non-reading UI controls immediately
  const topElem = document.elementFromPoint(x, y)
  if (!topElem || isInteractiveOrUiControl(topElem)) {
    return null
  }

  let range: Range | null = null

  // Standard caretRangeFromPoint (Chromium / WebKit)
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y)
  } else if ('caretPositionFromPoint' in document) {
    // caretPositionFromPoint (Firefox / Modern standard)
    const pos = (
      document as unknown as {
        caretPositionFromPoint: (x: number, y: number) => { offsetNode: Node; offset: number } | null
      }
    ).caretPositionFromPoint(x, y)
    if (pos && pos.offsetNode) {
      range = document.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      range.setEnd(pos.offsetNode, pos.offset)
    }
  }

  if (!range) return null
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE || !node.textContent) return null

  const parent = node.parentElement
  if (!parent || isInteractiveOrUiControl(parent)) return null

  const text = node.textContent
  const offset = range.startOffset

  // Locate word index
  let targetIndex = offset
  if (targetIndex >= text.length || !isWordChar(text[targetIndex])) {
    if (targetIndex > 0 && isWordChar(text[targetIndex - 1])) {
      targetIndex = targetIndex - 1
    } else {
      return null
    }
  }

  let start = targetIndex
  while (start > 0 && isWordBoundaryChar(text[start - 1])) {
    start--
  }
  let end = targetIndex
  while (end < text.length && isWordBoundaryChar(text[end])) {
    end++
  }

  const rawWord = text.slice(start, end).replace(/^[-']+|[-']+$/g, '')
  if (!rawWord || rawWord.length < 2 || !/^[a-zA-Z]+$/.test(rawWord)) return null

  // Ignore tiny common stopwords that are not meaningful dictionary lookups
  const lower = rawWord.toLowerCase()
  if (TRIVIAL_STOP_WORDS.has(lower)) {
    return null
  }

  try {
    const wordRange = document.createRange()
    wordRange.setStart(node, start)
    wordRange.setEnd(node, end)
    const rect = wordRange.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return null

    // Ensure cursor is directly on or very near the word (within 6px)
    if (
      x < rect.left - 6 ||
      x > rect.right + 6 ||
      y < rect.top - 6 ||
      y > rect.bottom + 6
    ) {
      return null
    }

    return {
      word: rawWord,
      rect,
      sentence: text.trim(),
    }
  } catch {
    return null
  }
}

export function GlobalHoverDictionary() {
  const desk = useEnglish()
  const { enabled } = useHoverDictionaryToggle()
  const [hoveredWord, setHoveredWord] = useState<{
    word: string
    rect: DOMRect
    sentence: string
  } | null>(null)
  const [activeEntry, setActiveEntry] = useState<MiniDictionaryEntry | null>(null)
  const [popupState, setPopupState] = useState<{
    x: number
    y: number
    placement: 'top' | 'bottom'
    arrowOffsetPercent: number
  } | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)

  const closeTooltip = useCallback(() => {
    setActiveEntry(null)
    setPopupState(null)
    setHoveredWord(null)
  }, [])

  useEffect(() => {
    if (!enabled) {
      closeTooltip()
      return
    }

    function handleMouseMove(e: MouseEvent) {
      if (!enabled) return

      // If mouse is inside the tooltip card, keep tooltip open and don't change underline
      if (cardRef.current && cardRef.current.contains(e.target as Node)) {
        return
      }

      const found = getWordAtPoint(e.clientX, e.clientY)
      if (!found) {
        setHoveredWord(null)
        return
      }

      setHoveredWord(found)
    }

    function handleClick(e: MouseEvent) {
      if (!enabled) return

      // If clicked inside the tooltip card, let interactions (pronunciation, saving) happen
      if (cardRef.current && cardRef.current.contains(e.target as Node)) {
        return
      }

      // Check if user clicked on an English word in reading text
      const found = getWordAtPoint(e.clientX, e.clientY)
      if (found) {
        const cleanWord = found.word.toLowerCase()
        const entry = getDictionaryEntry(cleanWord, desk.cards, found.sentence)
        const wordCenterX = found.rect.left + found.rect.width / 2

        // Card width ~350px
        const cardWidth = 350
        const clampedX = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, wordCenterX - cardWidth / 2))
        const arrowOffsetPercent = ((wordCenterX - clampedX) / cardWidth) * 100

        // Determine top or bottom placement
        const placeBelow = found.rect.top < 300
        const popupY = placeBelow ? found.rect.bottom + 10 : found.rect.top - 10
        const placement = placeBelow ? 'bottom' : 'top'

        setActiveEntry(entry)
        setPopupState({
          x: clampedX,
          y: popupY,
          placement,
          arrowOffsetPercent,
        })
        setHoveredWord(null)
        return
      }

      // Clicked outside any word and outside card: close
      if (activeEntry) {
        closeTooltip()
      }
    }

    function handleScroll() {
      // Reposition/close on scroll so card does not float away
      closeTooltip()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeTooltip()
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('click', handleClick)
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('resize', handleScroll)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, desk.cards, activeEntry, closeTooltip])

  if (!enabled) return null

  return (
    <>
      {/* 1. Word Underline on Hover */}
      {hoveredWord && !activeEntry && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredWord.rect.left}px`,
            top: `${hoveredWord.rect.bottom - 2}px`,
            width: `${hoveredWord.rect.width}px`,
            height: '2px',
            zIndex: 99998,
          }}
          className="pointer-events-none rounded-full bg-emerald-400 transition-all duration-75 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
        />
      )}

      {/* 2. Tooltip Card on Click */}
      {activeEntry && popupState && (
        <div
          ref={cardRef}
          style={{
            position: 'fixed',
            left: `${popupState.x}px`,
            top: `${popupState.y}px`,
            transform: popupState.placement === 'top' ? 'translateY(-100%)' : 'none',
            zIndex: 99999,
          }}
          className="pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
        >
          <MiniDictionaryTooltipCard
            entry={activeEntry}
            placement={popupState.placement}
            arrowOffsetPercent={popupState.arrowOffsetPercent}
            onClose={closeTooltip}
          />
        </div>
      )}
    </>
  )
}
