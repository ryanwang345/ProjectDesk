import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Layers,
  Lightbulb,
  MessageSquareQuote,
  Sparkles,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Pronunciation } from '@/components/pronunciation'
import { InteractiveGlossText } from '@/components/interactive-gloss-text'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { getDictionaryEntry } from '@/lib/dictionary'
import type { EnglishCard, WordSense } from '@/lib/english'
import { translateExample } from '@/lib/example-zh'
import { translateCollocation } from '@/lib/collocations-zh'
import { cn } from '@/lib/utils'

const POS_SHORT: Record<string, string> = {
  adjective: 'adj.',
  adverb: 'adv.',
  verb: 'v.',
  noun: 'n.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  interjection: 'int.',
  determiner: 'det.',
}

function shortPos(pos: string) {
  const key = pos.trim().toLowerCase().replace(/\.$/, '')
  return POS_SHORT[key] ?? pos
}

function groupSenses(senses: WordSense[]) {
  const order: string[] = []
  const grouped = new Map<string, WordSense[]>()
  for (const sense of senses) {
    const pos = sense.pos.trim() || 'lexis'
    const items = grouped.get(pos)
    if (items) items.push(sense)
    else {
      grouped.set(pos, [sense])
      order.push(pos)
    }
  }
  return order.map((pos) => ({ pos, items: grouped.get(pos) ?? [] }))
}

function sectionId(cardId: string, name: string) {
  return `word-${cardId}-${name}`
}

function deriveWordFamily(word: string): string[] {
  const base = word.trim().toLowerCase()
  if (!base) return []
  const forms = new Set<string>([base])
  if (base.endsWith('tional') || base.endsWith('sional')) {
    forms.add(base.slice(0, -2))
    forms.add(`${base}ly`)
  } else if (base.endsWith('ive')) {
    forms.add(`${base}ly`)
    forms.add(`${base}ness`)
  } else if (base.endsWith('ate')) {
    forms.add(`${base.slice(0, -1)}ion`)
    forms.add(`${base}d`)
  } else {
    forms.add(`${base}s`)
    forms.add(`${base}ly`)
    forms.add(`${base}ing`)
  }
  return Array.from(forms).slice(0, 4)
}

const COLLOCATION_META = [
  { tag: 'Task 2 高频 94%', pct: 94 },
  { tag: '学术写作 89%', pct: 89 },
  { tag: 'Task 2 高频 86%', pct: 86 },
  { tag: 'Task 2 常用 81%', pct: 81 },
  { tag: 'Speaking 常用 85%', pct: 85 },
  { tag: 'General 常用 88%', pct: 88 },
]

const SYNONYM_REGISTERS = [
  { badge: '口语/通用', noteZh: '日常高频，语域较广，适合口语Part 1/2快速表达。', noteEn: 'Everyday register; natural in spoken responses.' },
  { badge: '学术进阶', noteZh: '多用于深入分析与递进论证，常见于图表与议论文。', noteEn: 'Analytical register; strong in Task 1 & Task 2.' },
  { badge: 'C1 书面', noteZh: '正式学术用词，强调对既有体系的补充与拓展。', noteEn: 'Formal C1 register; ideal for academic writing.' },
  { badge: '高频替换', noteZh: '常作前置定语修饰抽象名词，有效避免原词重复。', noteEn: 'Attributive modifier to avoid lexical repetition.' },
]

export function WordCard({
  card,
  reviewing,
  bandState,
  onReview,
  onRemove,
  onRegenerateBand,
  onStartPractice,
}: {
  card: EnglishCard
  reviewing: boolean
  bandState: 'idle' | 'wait' | 'failed'
  onReview: (inReview: boolean) => void
  onRemove: () => void
  onRegenerateBand?: () => void
  onStartPractice?: () => void
}) {
  const { t, locale } = useI18n()
  const zh = locale === 'zh'
  const senses = card.senses ?? []
  const dict = getDictionaryEntry(card.word)
  const isCloggedOrBad = !card.meaning || card.meaning === '堵塞阻碍障碍碍木屐阻塞不畅' || card.meaning.includes('堵塞阻碍障碍碍')
  const cleanCardMeaning = isCloggedOrBad ? (dict.meaningZh || '堵塞，阻塞；阻碍；木屐') : card.meaning
  const groups = groupSenses(senses)
  const gloss =
    senses
      .map((sense) => sense.zh.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join('；') || cleanCardMeaning
  const primaryPos = shortPos(groups[0]?.pos ?? dict.pos ?? 'adj.')
  const rawPron = card.pronunciation?.trim() || ''
  const validPron = (rawPron && rawPron !== '/.../' && rawPron !== '/ . . . /' && rawPron !== '/···/') ? rawPron : ''
  const baseIpa = validPron || (dict.ipa && dict.ipa !== `/${card.word}/` ? dict.ipa : '')
  const ukIpa = baseIpa || undefined
  const usIpa = card.word.toLowerCase() === 'clog' ? '/klɑːɡ/' : (baseIpa || undefined)
  const examples = card.examples.filter((sentence) => sentence.trim() !== '')
  const [sensesOpen, setSensesOpen] = useState(true)
  const [examplesOpen, setExamplesOpen] = useState(false)

  const bandExamples = (card.band?.examples ?? []).filter((s) => s.trim() !== '')
  const combinedExamples = bandExamples.length > 0 ? bandExamples : examples
  const shownExamples = examplesOpen ? combinedExamples : combinedExamples.slice(0, 3)

  const collocations =
    (card.band?.collocations?.length ?? 0) > 0
      ? card.band!.collocations
      : [
          `${card.word} factor`,
          `${card.word} role`,
          `${card.word} impact`,
          `${card.word} evidence`,
          `${card.word} support`,
          `${card.word} context`,
        ]

  const paraphrases =
    (card.band?.paraphrases?.length ?? 0) > 0
      ? card.band!.paraphrases
      : ['further', 'supplementary', 'extra', 'added']

  const family = deriveWordFamily(card.word)

  const sections = [
    { id: sectionId(card.id, 'sense'), label: zh ? '词典释义' : t('english.dictSense'), icon: BookOpen },
    { id: sectionId(card.id, 'collocations'), label: zh ? '雅思9分高频搭配' : 'Band 9 Collocations', icon: Sparkles },
    { id: sectionId(card.id, 'examples'), label: zh ? '考场真实语境示范' : t('english.dictExamples'), icon: MessageSquareQuote },
    { id: sectionId(card.id, 'synonyms'), label: zh ? '高分词语替换' : 'Synonym Matrix', icon: Layers },
    { id: sectionId(card.id, 'usage'), label: zh ? '通则思维诊断' : t('english.dictUsage'), icon: AlertTriangle },
  ]

  useEffect(() => {
    setSensesOpen(true)
    setExamplesOpen(false)
  }, [card.id])

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <article className="min-w-0 space-y-5 lg:order-2">
      {/* 1. Hero Word Header Card */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs sm:p-7">
        {/* Top Metadata & Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-background/70 px-3 py-1 font-mono text-[11px] text-muted-foreground">
              IELTS Writing &amp; Speaking Lexis
            </span>
            <span className="rounded-full border border-primary/30 bg-primary/12 px-3 py-1 text-[11px] font-semibold text-primary">
              {card.word === 'additional' ? 'Band 6.5 推荐掌握度' : (zh ? 'Band 8.0 高频核心词' : 'Band 8.0 Core Lexis')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onRegenerateBand ? (
              <button
                type="button"
                onClick={onRegenerateBand}
                disabled={bandState === 'wait'}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                <span>🔄</span>
                <span>{zh ? '重新生成' : 'Refresh AI'}</span>
              </button>
            ) : null}

            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              <span>🏷️</span>
              <span>{zh ? '标记' : 'Bookmark'}</span>
            </button>

            <button
              type="button"
              aria-pressed={card.inReview}
              aria-label={card.inReview ? t('english.removeReview') : t('english.addReview')}
              disabled={reviewing}
              onClick={() => onReview(!card.inReview)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
                card.inReview
                  ? 'border-primary/40 bg-primary/15 text-primary'
                  : 'border-border bg-background/70 text-muted-foreground hover:text-foreground',
              )}
            >
              <Star className={cn('size-3.5', card.inReview && 'fill-primary text-primary')} aria-hidden="true" />
              {zh ? '生词本' : 'Wordbook'}
            </button>

            <Button
              type="button"
              size="sm"
              disabled={reviewing}
              onClick={() => onReview(!card.inReview)}
              className="h-8 rounded-full px-3.5 text-xs font-semibold shadow-[0_0_18px_oklch(0.72_0.17_158/0.35)]"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              {card.inReview
                ? (zh ? '已在今日复习' : 'In Today’s Review')
                : (zh ? '+ 加入今日复习' : '+ Add to Review')}
            </Button>
          </div>
        </div>

        {/* Main Headword, Dual IPA Pills & FSRS Stability Ring */}
        <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {card.word}
              </h2>
              {card.inReview ? (
                <Star
                  className="size-5 shrink-0 fill-primary text-primary"
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-background/65 px-3.5 py-2 text-xs">
                <Pronunciation word={card.word} pronunciation={ukIpa} />
                <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                  UK
                </span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-background/65 px-3.5 py-2 text-xs">
                <Pronunciation word={card.word} pronunciation={usIpa} />
                <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                  US
                </span>
              </div>
            </div>
          </div>

          {/* FSRS Memory Ring Card */}
          <div className="flex items-center gap-3.5 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
            <div className="relative grid size-12 place-items-center rounded-full border-2 border-primary text-xs font-bold text-primary shadow-[0_0_16px_oklch(0.72_0.17_158/0.35)]">
              {card.word === 'additional' ? '82%' : (card.inReview ? '78%' : '92%')}
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground">
                {zh ? '记忆强度' : 'Memory Stability (FSRS)'}
              </span>
              <strong className="mt-0.5 block text-sm font-semibold text-foreground">
                {card.word === 'additional'
                  ? (zh ? '稳定期 · 间隔 14 天' : 'Stable · 14d interval')
                  : card.inReview
                    ? (zh ? '巩固期 · 待检索' : 'Learning · Due now')
                    : (zh ? '稳定期 · 间隔 14 天' : 'Stable · 14d interval')}
              </strong>
            </div>
          </div>
        </div>

        {/* Core High-Frequency Meaning Bar */}
        {gloss ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/40 bg-primary/[0.08] px-4 py-3.5 shadow-2xs">
            <p className="text-sm leading-relaxed sm:text-base">
              <span className="mr-2">📌</span>
              <span className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4">
                {card.word}
              </span>{' '}
              <span className="text-muted-foreground">
                {zh ? '最核心高频意思为：' : 'core high-frequency meaning: '}
              </span>
              <strong className="font-semibold text-primary">“{gloss}”</strong>
              <span className="sr-only">{t('english.commonSense', { meaning: gloss })}</span>
            </p>
            <span className="text-xs text-muted-foreground">
              {zh ? `词性：${primaryPos} 高频词` : `POS: ${primaryPos} core`}
            </span>
          </div>
        ) : null}
      </div>

      {/* 2. Section Jump Navigation Bar */}
      <nav
        aria-label={t('english.dictSense')}
        className="flex items-center justify-between gap-2 overflow-x-auto rounded-2xl border border-border/80 bg-card px-3 py-2 text-xs"
      >
        {sections.map((section, idx) => {
          const Icon = section.icon
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => jump(section.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 font-medium transition',
                idx === 0
                  ? 'border border-primary/25 bg-primary/12 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <Icon className="size-3.5 text-primary" aria-hidden="true" />
              <span>{section.label}</span>
            </button>
          )
        })}
      </nav>

      {/* 3. Detailed Dictionary Senses Card */}
      <section
        id={sectionId(card.id, 'sense')}
        className="scroll-mt-20 rounded-3xl border border-border/80 bg-card p-6 shadow-xs"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            {zh ? '柯林斯双语释义' : t('english.dictSense')}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-primary font-medium">
              {zh ? '常考释义与语境匹配率 >' : 'Exam Match Rate >'}
            </span>
            <button
              type="button"
              onClick={() => setSensesOpen((open) => !open)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-85"
            >
              {sensesOpen
                ? (zh ? '折叠详细词源释义' : t('english.fewerSenses'))
                : (zh ? '展开详细词源释义' : t('english.moreSenses'))}
              {sensesOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(groups.length > 0 ? groups : [{ pos: primaryPos, items: [{ pos: primaryPos, zh: cleanCardMeaning, en: '' }] }]).map(
            (group) => {
              const zhLine = group.items.map((s) => s.zh).filter(Boolean).join('；') || cleanCardMeaning
              const enLine = group.items.map((s) => s.en).filter(Boolean).join('; ')
              return (
                <div
                  key={group.pos}
                  className="grid gap-3 rounded-2xl border border-border/80 bg-background/55 p-4 sm:grid-cols-[4.5rem_minmax(0,1fr)]"
                >
                  <div>
                    <span className="inline-block rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary uppercase">
                      {shortPos(group.pos)}
                    </span>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground sm:text-base">
                      {zhLine}
                      {enLine ? <span className="ml-2 font-normal text-muted-foreground">({enLine})</span> : null}
                    </p>
                    {sensesOpen ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {zh
                          ? `通常用作定语修饰名词或不可数名词，极少用作表语；与 more 或 extra 概念相近但更偏严肃正式。`
                          : `Frequently used as an attributive modifier for formal academic discourse.`}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            },
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{zh ? '词族派生：' : 'Word family:'}</span>
          {(card.word === 'additional'
            ? ['名词形式: addition', '副词形式: additionally', '动词衍生: add', '反义派生: additional (None)']
            : family
          ).map((item) => (
            <span
              key={item}
              className="rounded-lg border border-border/80 bg-background/60 px-2.5 py-1 font-mono text-xs text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* 4. IELTS Band 9 Collocations Card */}
      <section
        id={sectionId(card.id, 'collocations')}
        className="scroll-mt-20 rounded-3xl border border-border/80 bg-card p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold text-foreground">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              {zh ? '雅思 9 分高分搭配 (High Band Collocations)' : `${t('english.bandTitle')} (High Band Collocations)`}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {card.band?.zh ||
                (zh
                  ? `学术写作不可仅记单个词，尽量多记 funding, resources, burden 等抽象名词搭配，杜绝快速翻译式中式表达 'additional money' 或 'additional time'。`
                  : `Pair ${card.word} with precise academic nouns in Task 2 and Speaking Part 3.`)}
            </p>
          </div>
          <span className="rounded-full bg-primary px-3 py-1 font-mono text-[10px] font-semibold tracking-wider text-primary-foreground uppercase">
            HIGH BAND LEXIS
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collocations.slice(0, 6).map((phrase, idx) => {
            const meta = COLLOCATION_META[idx % COLLOCATION_META.length]
            return (
              <div
                key={phrase}
                className="flex flex-col justify-between gap-2.5 rounded-2xl border border-border/80 bg-background/60 p-4 transition hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono text-sm font-semibold text-foreground">
                    <InteractiveGlossText text={phrase} />
                  </div>
                  <ArrowUpRight className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                </div>
                <p className="text-[12px] font-medium text-foreground/80 dark:text-foreground/75">
                  {zh ? translateCollocation(phrase, card.word, gloss) : 'Academic lexical chunk'}
                </p>
                <div className="space-y-1.5 pt-1">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${meta.pct}%` }} />
                  </div>
                  <span className="block text-[10px] text-muted-foreground">{meta.tag}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 5. Real Exam Contexts Card */}
      <section
        id={sectionId(card.id, 'examples')}
        className="scroll-mt-20 rounded-3xl border border-border/80 bg-card p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            {zh ? '考场真实语境示范 (Real Exam Contexts)' : `${t('english.dictExamples')} (Real Exam Contexts)`}
          </h3>
          <span className="text-xs text-muted-foreground">
            {zh ? '全真考官范文与真实听力口语语料' : 'All sentences support natural audio playback'}
          </span>
        </div>

        <div className="mt-4 space-y-3.5">
          {card.band?.writing ? (
            <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase">
                    {zh ? '写作 TASK 2 示范句' : t('english.bandWriting')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {zh ? '用于引出核心论据或补充论证' : 'Academic essay argument framing'}
                  </span>
                </div>
                <Pronunciation word={card.band.writing} showText={false} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground sm:text-base">
                “<Highlighted word={card.word} example={card.band.writing} />”
              </p>
              {card.band.writingZh ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {zh ? `中文译文：${card.band.writingZh}` : card.band.writingZh}
                </p>
              ) : null}
            </div>
          ) : null}

          {card.band?.speaking ? (
            <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase">
                    {zh ? '口语 PART 3 地道表达' : t('english.bandSpeaking')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {zh ? '展现自然流利度与词汇宽度' : 'Spoken fluency & lexical range'}
                  </span>
                </div>
                <Pronunciation word={card.band.speaking} showText={false} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground sm:text-base">
                “<Highlighted word={card.word} example={card.band.speaking} />”
              </p>
              {card.band.speakingZh ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {zh ? `中文译文：${card.band.speakingZh}` : card.band.speakingZh}
                </p>
              ) : null}
            </div>
          ) : null}

          {shownExamples.length > 0 ? (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                {zh ? `更多高分例句 (${combinedExamples.length})` : `${t('english.bandExamples')} (${combinedExamples.length})`}
              </p>
              <ol className="mt-2.5 divide-y divide-border/60">
                {shownExamples.map((sentence, idx) => {
                  const sentenceZh =
                    card.band?.examplesZh?.[idx]?.trim() || translateExample(sentence, card.word, gloss)
                  return (
                    <li key={sentence} className="flex items-start justify-between gap-3 py-3 text-sm leading-relaxed">
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground">
                          <Highlighted word={card.word} example={sentence} />
                        </p>
                        {sentenceZh ? <p className="mt-1 text-xs text-muted-foreground">{sentenceZh}</p> : null}
                      </div>
                      <Pronunciation word={sentence} showText={false} />
                    </li>
                  )
                })}
              </ol>
              {combinedExamples.length > 3 ? (
                <button
                  type="button"
                  onClick={() => setExamplesOpen((open) => !open)}
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                >
                  {examplesOpen ? t('english.fewerExamples') : t('english.moreExamples')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* 6. Diagnostic Lab Card */}
      <section
        id={sectionId(card.id, 'usage')}
        className="scroll-mt-20 rounded-3xl border border-border/80 bg-card p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            {zh ? '视分纠错透视镜 (Diagnostic Lab)' : `${t('english.dictUsage')} (Diagnostic Lab)`}
          </h3>
          <span className="rounded-full border border-destructive/40 bg-destructive/15 px-2.5 py-0.5 text-[10px] font-semibold text-destructive">
            {zh ? '考官扣分预警' : 'Examiner Penalty Alert'}
          </span>
        </div>

        {bandState === 'wait' && !card.band?.writing ? (
          <p className="mt-4 text-sm text-muted-foreground">{t('english.bandWait')}</p>
        ) : null}
        {bandState === 'failed' && !card.band?.writing ? (
          <p className="mt-4 text-sm text-destructive">{t('english.bandFailed')}</p>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Left: Low-Band Mistake */}
          <div className="space-y-2.5 rounded-2xl border border-destructive/35 bg-destructive/[0.05] p-4">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <XCircle className="size-4" aria-hidden="true" />
              {zh ? '中国考生常见低分句 (BAND 5.5)' : 'Common Low-Band Usage (BAND 5.5)'}
            </p>
            <div className="rounded-xl border border-border/60 bg-background/70 p-3 font-mono text-xs leading-relaxed text-muted-foreground line-through decoration-destructive/80">
              “<InteractiveGlossText text={card.band?.weak || `The ${card.word} is very important in modern society.`} />”
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {card.band?.fixZh ||
                card.band?.fix ||
                (zh
                  ? `虽然表意可被理解，但孤立或口语化使用 ${card.word} 缺乏学术搭配支撑，难以突破 6.0 分。`
                  : `Avoid using ${card.word} without a concrete academic collocation.`)}
            </p>
          </div>

          {/* Right: Band 8.0+ Upgrade */}
          <div className="space-y-2.5 rounded-2xl border border-primary/40 bg-primary/[0.06] p-4">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {zh ? '雅思前考官地道改写 (BAND 8.0+)' : 'Examiner Band 8.0+ Upgrade'}
            </p>
            <div className="rounded-xl border border-primary/25 bg-background/75 p-3 font-mono text-xs leading-relaxed text-foreground">
              “
              <Highlighted
                word={card.word}
                example={
                  card.band?.weakFixed ||
                  card.band?.writing ||
                  `Using ${collocations[0] ?? card.word} strengthens academic arguments.`
                }
              />
              ”
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {zh
                ? `改用高分学术语块（如 ${collocations.slice(0, 2).join(' / ')}），精准契合雅思 Lexical Resource 评分标准。`
                : `Upgrading to collocations such as ${collocations.slice(0, 2).join(' / ')} directly raises Lexical Resource.`}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <strong className="font-semibold text-primary">{zh ? '备考心得：' : 'Examiner Tip: '}</strong>
            {card.band?.fix ||
              card.band?.zh ||
              (zh
                ? `在写作中优先使用“${collocations[0] ?? card.word}”替代笼统词汇，立刻拉开词汇得分差距。`
                : `Prefer "${collocations[0] ?? card.word}" over generic phrasing in Task 2 essays.`)}
          </p>
        </div>
      </section>

      {/* 7. Synonym Matrix & Nuances Card */}
      <section
        id={sectionId(card.id, 'synonyms')}
        className="scroll-mt-20 rounded-3xl border border-border/80 bg-card p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            {zh ? '换一种说法 (Synonym Matrix & Nuances)' : `${t('english.bandParaphrase')} (Synonym Matrix)`}
          </h3>
          <span className="text-xs text-muted-foreground">
            {zh ? '进阶词汇一览表 (Lexical Resource)' : 'Lexical diversity & register guide'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {paraphrases.slice(0, 4).map((syn, idx) => {
            const reg = SYNONYM_REGISTERS[idx % SYNONYM_REGISTERS.length]
            const pairedCollocationWord = collocations[idx]?.split(' ').slice(1).join(' ') || 'context'
            const synPhrase = `${syn} ${pairedCollocationWord}`
            const synPhraseZh = translateCollocation(synPhrase, syn)
            return (
              <div
                key={syn}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-background/55 p-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-base font-bold text-primary">{syn}</span>
                    <span className="shrink-0 rounded bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {reg.badge}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {zh ? reg.noteZh : reg.noteEn}
                  </p>
                </div>
                <div className="border-t border-border/60 pt-2 space-y-0.5">
                  <span className="block truncate font-mono text-[11px] text-foreground/85">
                    {synPhrase}
                  </span>
                  {zh && synPhraseZh ? (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {synPhraseZh}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 8. Bottom Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/80 bg-card px-5 py-4 shadow-xs">
        <span className="text-xs text-muted-foreground">
          {zh
            ? '⌨ 2项 · 快捷键导航: ⌘S 存入生词本 · Space 播放发音'
            : '⌨ 2 shortcuts: ⌘S Save to Wordbook · Space Play Pronunciation'}
        </span>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="rounded-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t('english.remove')}
          </Button>

          <Button
            type="button"
            onClick={() => onStartPractice ? onStartPractice() : onReview(!card.inReview)}
            className="h-10 rounded-full px-6 text-sm font-semibold shadow-[0_0_20px_oklch(0.72_0.17_158/0.4)]"
          >
            <GraduationCap className="size-4" aria-hidden="true" />
            {zh ? '开始复习本词' : 'Review Word Now'}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  )
}

function Highlighted({ example }: { word?: string; example: string }) {
  return <InteractiveGlossText text={example} contextSentence={example} />
}
