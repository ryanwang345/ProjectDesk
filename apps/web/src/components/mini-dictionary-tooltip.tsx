import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Volume2,
  X,
} from 'lucide-react'
import { speakWord } from '@/lib/speech'
import { getDictionaryEntry, type MiniDictionaryEntry } from '@/lib/dictionary'
import { useEnglish } from '@/hooks/use-english'
import { cn } from '@/lib/utils'

export type MiniDictionaryTooltipProps = {
  word: string
  entry?: Partial<MiniDictionaryEntry>
  contextSentence?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onClose?: () => void
  placement?: 'top' | 'bottom'
  children?: ReactNode
  className?: string
}

export function MiniDictionaryTooltipCard({
  entry,
  onClose,
  placement = 'top',
  arrowOffsetPercent = 50,
  className,
}: {
  entry: MiniDictionaryEntry
  onClose?: () => void
  placement?: 'top' | 'bottom'
  arrowOffsetPercent?: number
  className?: string
}) {
  const navigate = useNavigate()
  const desk = useEnglish()
  const [isPlaying, setIsPlaying] = useState(false)
  const isSaved = desk.cards.some(
    (c) => c.word.toLowerCase() === entry.word.toLowerCase() && c.inReview,
  )

  async function handlePronounce(e: React.MouseEvent) {
    e.stopPropagation()
    setIsPlaying(true)
    try {
      await speakWord(entry.word)
    } finally {
      setIsPlaying(false)
    }
  }

  async function handleToggleWordbook(e: React.MouseEvent) {
    e.stopPropagation()
    const nextSaved = !isSaved

    const existing = desk.cards.find((c) => c.word.toLowerCase() === entry.word.toLowerCase())
    if (existing) {
      await desk.markReview(existing.id, nextSaved)
    } else {
      // Adopt as new card into review queue
      await desk.adoptCard({
        id: entry.id ?? `seed-${entry.word}`,
        word: entry.word,
        meaning: entry.meaningZh,
        pronunciation: entry.ipa,
        inReview: nextSaved,
        generated: true,
        updatedAt: new Date().toISOString(),
        examples: [],
        senses: [
          {
            pos: entry.pos,
            zh: entry.meaningZh,
            en: entry.meaningEn ?? '',
          },
        ],
        band: {
          zh: entry.contextNote ?? '雅思核心真题高频词汇',
          collocations: entry.synonyms ?? [],
          writing: '',
          speaking: '',
          weak: '',
          fix: '',
          paraphrases: entry.synonyms ?? [],
        },
      })
    }
  }

  function handleViewFullEntry(e: React.MouseEvent) {
    e.stopPropagation()
    if (onClose) onClose()
    const matchedCard = desk.cards.find(
      (c) => c.word.toLowerCase() === entry.word.toLowerCase(),
    )
    const cardId = matchedCard?.id ?? entry.id ?? 'seed-additional'
    navigate(`/english?tab=words&word=${encodeURIComponent(cardId)}`)
  }

  return (
    <div
      role="tooltip"
      className={cn(
        'relative z-50 w-[350px] max-w-[calc(100vw-32px)] rounded-2xl border border-emerald-500/35 bg-[#0e1614]/98 p-4 text-left shadow-[0_16px_40px_rgba(0,0,0,0.75)] backdrop-blur-md transition-all',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Header: Word + Pronunciation Button + Band Pill */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h4 className="font-sans text-xl font-bold tracking-tight text-white">
            {entry.word}
          </h4>
          <button
            type="button"
            onClick={handlePronounce}
            aria-label={`Play pronunciation for ${entry.word}`}
            className={cn(
              'grid size-7 place-items-center rounded-full border border-emerald-500/35 bg-emerald-950/70 text-emerald-400 transition hover:bg-emerald-900/60 hover:text-emerald-300',
              isPlaying && 'animate-pulse text-emerald-300 ring-2 ring-emerald-500/40',
            )}
          >
            <Volume2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-emerald-400">
            {entry.band}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tooltip"
              className="text-muted-foreground/60 transition hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. IPA & Part of Speech & Context Note */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-mono font-medium text-emerald-400">{entry.ipa}</span>
        <span className="text-muted-foreground/50" aria-hidden="true">
          •
        </span>
        <span className="font-semibold italic text-emerald-200/90">{entry.pos}</span>
        {entry.contextNote && (
          <span className="truncate text-muted-foreground/80">{entry.contextNote}</span>
        )}
      </div>

      {/* 3. Definition Card */}
      <div className="mt-3 rounded-xl border border-white/5 bg-[#17221e] px-3.5 py-2.5 text-xs leading-relaxed text-foreground/90">
        <span className="font-semibold text-emerald-400">释义：</span>
        <span className="text-white/95">{entry.meaningZh}</span>
      </div>

      {/* 4. Listening/Exam Synonym Paraphrase Card */}
      {entry.examParaphrase && (
        <div className="mt-2.5 rounded-xl border border-emerald-500/35 bg-emerald-950/40 px-3 py-2 text-xs">
          <div className="flex items-start gap-1.5 leading-relaxed">
            <ArrowLeftRight className="mt-0.5 size-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
            <div>
              <span className="font-semibold text-emerald-400">听力考点替换：</span>
              <span className="font-mono font-medium text-emerald-300">
                {entry.examParaphrase.replace(/^[^\w=]+/, '')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Footer: Add to Wordbook + View Full Entry */}
      <div className="mt-3.5 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
        <button
          type="button"
          onClick={handleToggleWordbook}
          className={cn(
            'inline-flex items-center gap-1.5 font-medium transition',
            isSaved
              ? 'text-emerald-400 hover:text-emerald-300'
              : 'text-emerald-400/90 hover:text-emerald-300',
          )}
        >
          {isSaved ? (
            <>
              <BookmarkCheck className="size-3.5 text-emerald-400" aria-hidden="true" />
              <span>已在生词本</span>
            </>
          ) : (
            <>
              <BookmarkPlus className="size-3.5 text-emerald-400" aria-hidden="true" />
              <span>+ 加入生词本</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleViewFullEntry}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground/90 transition hover:text-white"
        >
          <span>查看完整词条</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Tooltip Caret Arrow */}
      <div
        style={{ left: `${Math.max(8, Math.min(92, arrowOffsetPercent))}%` }}
        className={cn(
          'absolute size-3 -translate-x-1/2 rotate-45 bg-[#0e1614]',
          placement === 'bottom'
            ? '-top-1.5 border-l border-t border-emerald-500/35'
            : '-bottom-1.5 border-r border-b border-emerald-500/35',
        )}
        aria-hidden="true"
      />
    </div>
  )
}

/** Interactive wrapper that triggers the mini dictionary tooltip upon hover or click */
export function WordDictionaryTooltip({
  word,
  entry: customEntry,
  contextSentence,
  open: controlledOpen,
  onOpenChange,
  children,
  className,
}: MiniDictionaryTooltipProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen
  const desk = useEnglish()
  const triggerRef = useRef<HTMLSpanElement>(null)

  const resolvedEntry: MiniDictionaryEntry = {
    ...getDictionaryEntry(word, desk.cards, contextSentence),
    ...customEntry,
  }

  function handleSetOpen(next: boolean) {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        if (!isControlled) setInternalOpen(false)
        onOpenChange?.(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!isControlled) setInternalOpen(false)
        onOpenChange?.(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isControlled, onOpenChange])

  return (
    <span ref={triggerRef} className={cn('relative inline-block', className)}>
      <span
        tabIndex={0}
        role="button"
        onClick={() => handleSetOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSetOpen(!isOpen)
          }
        }}
        className="cursor-pointer rounded border-b border-dotted border-emerald-500/60 pb-0.5 text-inherit transition hover:border-emerald-400 hover:bg-emerald-500/10 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
      >
        {children ?? word}
      </span>

      {isOpen && (
        <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-50 -translate-x-1/2 animate-in fade-in zoom-in-95 duration-150">
          <MiniDictionaryTooltipCard
            entry={resolvedEntry}
            onClose={() => handleSetOpen(false)}
          />
        </div>
      )}
    </span>
  )
}
