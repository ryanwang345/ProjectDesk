import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { MiniDictionaryTooltipCard } from '@/components/mini-dictionary-tooltip'
import { getDictionaryEntry, type MiniDictionaryEntry } from '@/lib/dictionary'
import { useEnglish } from '@/hooks/use-english'
import { cn } from '@/lib/utils'

export type InteractiveGlossTextProps = {
  text: string
  className?: string
  contextSentence?: string
}

export function InteractiveGlossText({
  text,
  className,
  contextSentence,
}: InteractiveGlossTextProps) {
  const desk = useEnglish()
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [activeEntry, setActiveEntry] = useState<MiniDictionaryEntry | null>(null)
  const [popupPos, setPopupPos] = useState<{
    x: number
    y: number
    placement: 'top' | 'bottom'
    arrowOffsetPercent: number
  } | null>(null)
  const containerRef = useRef<HTMLParagraphElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Split text into tokens while preserving whitespace and punctuation
  const tokens = useMemo(() => {
    // Regex splits by word boundary: letters/hyphens vs whitespace/punctuation
    return text.split(/(\b[a-zA-Z]+(?:'[a-zA-Z]+)?\b)/g)
  }, [text])

  // Close popup on outside click, window resize, scroll, or escape
  useEffect(() => {
    if (!activeWord) return

    function handleClickOutside(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setActiveWord(null)
        setActiveEntry(null)
        setPopupPos(null)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setActiveWord(null)
        setActiveEntry(null)
        setPopupPos(null)
      }
    }

    function handleScroll() {
      // Close on scroll so popup doesn't drift away
      setActiveWord(null)
      setActiveEntry(null)
      setPopupPos(null)
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('resize', handleScroll)
    }
  }, [activeWord])

  function handleWordClick(word: string, e: React.MouseEvent<HTMLSpanElement>) {
    e.stopPropagation()
    const cleanWord = word.trim().toLowerCase()
    if (!cleanWord || cleanWord.length < 2) return

    // If already active, toggle off
    if (activeWord === cleanWord) {
      setActiveWord(null)
      setActiveEntry(null)
      setPopupPos(null)
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const cardWidth = 350
    const wordCenterX = rect.left + rect.width / 2

    // Viewport clamping: keep at least 16px from screen edges so card is NEVER cut off
    const clampedX = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, wordCenterX - cardWidth / 2))
    const arrowOffsetPercent = ((wordCenterX - clampedX) / cardWidth) * 100

    // Smart vertical placement: above word if enough room, else below
    const placeBelow = rect.top < 300
    const popupY = placeBelow ? rect.bottom + 10 : rect.top - 10
    const placement: 'top' | 'bottom' = placeBelow ? 'bottom' : 'top'

    const entry = getDictionaryEntry(cleanWord, desk.cards, contextSentence ?? text)
    setActiveEntry(entry)
    setActiveWord(cleanWord)

    setPopupPos({
      x: clampedX,
      y: popupY,
      placement,
      arrowOffsetPercent,
    })
  }

  return (
    <p
      ref={containerRef}
      data-interactive-gloss="true"
      className={cn('relative inline leading-relaxed', className)}
    >
      {tokens.map((token, idx) => {
        const isWord = /^[a-zA-Z]+(?:'[a-zA-Z]+)?$/.test(token)
        if (!isWord) {
          return <span key={idx}>{token}</span>
        }

        const lower = token.toLowerCase()
        const isKeyIeltsWord =
          lower === 'complimentary' ||
          lower === 'additional' ||
          lower === 'abandon' ||
          lower === 'apprentice' ||
          lower === 'probationary' ||
          lower === 'physiotherapist' ||
          lower === 'overwhelmed' ||
          lower === 'deliberate' ||
          lower === 'swelling' ||
          lower === 'dilapidated' ||
          lower === 'furniture' ||
          lower === 'apartment' ||
          lower === 'theft' ||
          lower === 'canadian' ||
          lower === 'subterranean' ||
          lower === 'convection' ||
          lower === 'buoyancy' ||
          lower === 'windcatcher' ||
          lower === 'qanat'

        const isCurrentlyActive = activeWord === lower

        return (
          <span
            key={idx}
            role="button"
            tabIndex={0}
            onClick={(e) => handleWordClick(token, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleWordClick(token, e as unknown as React.MouseEvent<HTMLSpanElement>)
              }
            }}
            title={`点击查看雅思词典：${token}`}
            className={cn(
              'cursor-pointer rounded px-0.5 transition-colors duration-150 outline-none',
              // Hover: show underline on hover
              'hover:underline hover:decoration-emerald-400 hover:decoration-2 hover:underline-offset-4 hover:text-emerald-300',
              isCurrentlyActive
                ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-400 underline decoration-emerald-400 decoration-2 underline-offset-4'
                : isKeyIeltsWord
                  ? 'border-b border-emerald-500/50 font-medium text-emerald-300/90'
                  : 'text-inherit',
            )}
          >
            {token}
          </span>
        )
      })}

      {/* Floating Mini Dictionary Popover Card rendered via portal to prevent any clipping */}
      {activeWord && activeEntry && popupPos &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: 'fixed',
              left: `${popupPos.x}px`,
              top: `${popupPos.y}px`,
              transform: popupPos.placement === 'top' ? 'translateY(-100%)' : 'none',
              zIndex: 99999,
            }}
            className="pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
          >
            <MiniDictionaryTooltipCard
              entry={activeEntry}
              placement={popupPos.placement}
              arrowOffsetPercent={popupPos.arrowOffsetPercent}
              onClose={() => {
                setActiveWord(null)
                setActiveEntry(null)
                setPopupPos(null)
              }}
            />
          </div>,
          document.body,
        )}
    </p>
  )
}
