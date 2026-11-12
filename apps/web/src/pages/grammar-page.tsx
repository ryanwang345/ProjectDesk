import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookCheck,
  BookMarked,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Flame,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  XCircle,
  Zap,
} from 'lucide-react'
import { Pronunciation } from '@/components/pronunciation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import {
  BAND_NINE_TEMPLATES,
  GRAMMAR_CATEGORIES,
  GRAMMAR_QUESTION_BANK,
  GRAMMAR_TOPICS,
  type GrammarBankQuestion,
  type GrammarCategory,
  type SentenceTemplate,
} from '@/lib/grammar-data'
import { cn } from '@/lib/utils'

export function GrammarPage() {
  const { locale } = useI18n()
  const zh = locale === 'zh'

  const [activeTab, setActiveTab] = useState<'topics' | 'clinic' | 'templates' | 'quiz'>('topics')
  const [selectedCategory, setSelectedCategory] = useState<GrammarCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBand, setSelectedBand] = useState<string>('all')
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(GRAMMAR_TOPICS[0].id)
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null)

  // In-topic mini-quiz state: topicId -> { qIdx: number, picked: number | null, checked: boolean }
  const [topicQuizState, setTopicQuizState] = useState<
    Record<string, { qIdx: number; picked: number | null; checked: boolean }>
  >({})

  // Question bank quiz states
  const [bankMode, setBankMode] = useState<'5-sprint' | '10-focus' | 'all' | 'mistakes'>('5-sprint')
  const [bankCategoryFilter, setBankCategoryFilter] = useState<GrammarCategory | 'all'>('all')
  const [bankCurrentIdx, setBankCurrentIdx] = useState(0)
  const [bankSelectedOpt, setBankSelectedOpt] = useState<number | null>(null)
  const [bankIsChecked, setBankIsChecked] = useState(false)
  const [bankScore, setBankScore] = useState(0)
  const [bankFinished, setBankFinished] = useState(false)
  const [wrongQuestionIds, setWrongQuestionIds] = useState<string[]>([])

  // Filter topics
  const filteredTopics = useMemo(() => {
    return GRAMMAR_TOPICS.filter((topic) => {
      if (selectedCategory !== 'all' && topic.category !== selectedCategory) return false
      if (selectedBand !== 'all' && !topic.bandTarget.includes(selectedBand)) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        topic.title.toLowerCase().includes(q) ||
        topic.titleEn.toLowerCase().includes(q) ||
        topic.formula.toLowerCase().includes(q) ||
        topic.summaryZh.toLowerCase().includes(q) ||
        topic.explanationZh.toLowerCase().includes(q) ||
        topic.goodExample.toLowerCase().includes(q)
      )
    })
  }, [selectedCategory, selectedBand, searchQuery])

  // Active question bank list based on mode & filter
  const activeQuestions = useMemo(() => {
    let pool = GRAMMAR_QUESTION_BANK
    if (bankCategoryFilter !== 'all') {
      pool = pool.filter((q) => q.category === bankCategoryFilter)
    }

    if (bankMode === 'mistakes') {
      return pool.filter((q) => wrongQuestionIds.includes(q.id))
    }
    if (bankMode === '5-sprint') {
      return pool.slice(0, 5)
    }
    if (bankMode === '10-focus') {
      return pool.slice(0, 10)
    }
    return pool
  }, [bankMode, bankCategoryFilter, wrongQuestionIds])

  const currentBankQuestion: GrammarBankQuestion | undefined = activeQuestions[bankCurrentIdx]

  function handleCopy(template: SentenceTemplate) {
    void navigator.clipboard.writeText(template.templateEn)
    setCopiedTemplateId(template.id)
    window.setTimeout(() => setCopiedTemplateId(null), 2000)
  }

  // Handle inline in-topic mini quiz
  function handleInlineQuizPick(topicId: string, optIdx: number) {
    const curr = topicQuizState[topicId]
    if (curr?.checked) return
    setTopicQuizState((prev) => ({
      ...prev,
      [topicId]: {
        qIdx: curr?.qIdx ?? 0,
        picked: optIdx,
        checked: false,
      },
    }))
  }

  function handleInlineQuizCheck(topicId: string) {
    const curr = topicQuizState[topicId]
    if (!curr || curr.picked === null) return
    setTopicQuizState((prev) => ({
      ...prev,
      [topicId]: {
        ...curr,
        checked: true,
      },
    }))
  }

  function handleInlineQuizNext(topicId: string, totalQuizzes: number) {
    const curr = topicQuizState[topicId]
    const nextIdx = ((curr?.qIdx ?? 0) + 1) % totalQuizzes
    setTopicQuizState((prev) => ({
      ...prev,
      [topicId]: {
        qIdx: nextIdx,
        picked: null,
        checked: false,
      },
    }))
  }

  // Question bank handlers
  function handleStartBankMode(mode: '5-sprint' | '10-focus' | 'all' | 'mistakes') {
    setBankMode(mode)
    setBankCurrentIdx(0)
    setBankSelectedOpt(null)
    setBankIsChecked(false)
    setBankScore(0)
    setBankFinished(false)
  }

  function handleBankSubmit() {
    if (bankSelectedOpt === null || !currentBankQuestion) return
    setBankIsChecked(true)
    const isCorrect = bankSelectedOpt === currentBankQuestion.correctIndex
    if (isCorrect) {
      setBankScore((s) => s + 1)
      // If was previously marked wrong, remove from mistakes
      setWrongQuestionIds((prev) => prev.filter((id) => id !== currentBankQuestion.id))
    } else {
      // Record wrong question
      setWrongQuestionIds((prev) => (prev.includes(currentBankQuestion.id) ? prev : [...prev, currentBankQuestion.id]))
    }
  }

  function handleBankNext() {
    if (bankCurrentIdx + 1 < activeQuestions.length) {
      setBankCurrentIdx((idx) => idx + 1)
      setBankSelectedOpt(null)
      setBankIsChecked(false)
    } else {
      setBankFinished(true)
    }
  }

  function handleRestartBank() {
    setBankCurrentIdx(0)
    setBankSelectedOpt(null)
    setBankIsChecked(false)
    setBankScore(0)
    setBankFinished(false)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* 1. Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card/90 to-primary/[0.04] p-6 shadow-sm sm:p-8">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-semibold text-primary">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              <span>{zh ? '雅思 7.5 - 9.0 语法维度标准' : 'IELTS Grammatical Range & Accuracy (GRA)'}</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {zh ? '雅思高分语法特训工作台' : 'IELTS High-Band Grammar Workbench'}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {zh
                ? '精准攻克省略 if 虚拟倒装、强调裂句、学术分词短语与谨慎语气（Hedging），同时手术式修复逗号拼接、主谓不一致与中式英语，让考官眼前一亮。'
                : 'Master inverted conditionals, cleft focus structures, participle clauses, and academic hedging while eliminating comma splices and subject-verb mismatches.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-background/70 px-4 py-2.5 text-center shadow-2xs">
              <span className="font-mono text-lg font-bold text-primary">{GRAMMAR_TOPICS.length}</span>
              <span className="text-[11px] text-muted-foreground">{zh ? '核心专题' : 'Core Topics'}</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-background/70 px-4 py-2.5 text-center shadow-2xs">
              <span className="font-mono text-lg font-bold text-amber-500">{GRAMMAR_QUESTION_BANK.length}</span>
              <span className="text-[11px] text-muted-foreground">{zh ? '题库考题' : 'Questions'}</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-background/70 px-4 py-2.5 text-center shadow-2xs">
              <span className="font-mono text-lg font-bold text-emerald-500">Band 8.5+</span>
              <span className="text-[11px] text-muted-foreground">{zh ? '高分目标' : 'Target Band'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Primary Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('topics')}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition',
            activeTab === 'topics'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'border border-border/70 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground',
          )}
        >
          <BookMarked className="size-3.5" aria-hidden="true" />
          <span>{zh ? '语法精讲与句式矩阵' : 'Grammar Deep-Dive'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quiz')}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition',
            activeTab === 'quiz'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'border border-border/70 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground',
          )}
        >
          <BookCheck className="size-3.5" aria-hidden="true" />
          <span>{zh ? '全真语法题库与自测' : 'Grammar Question Bank'}</span>
          <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-mono">
            {GRAMMAR_QUESTION_BANK.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clinic')}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition',
            activeTab === 'clinic'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'border border-border/70 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground',
          )}
        >
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          <span>{zh ? '写作避坑与病句诊所' : 'Error Diagnosis Clinic'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition',
            activeTab === 'templates'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'border border-border/70 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground',
          )}
        >
          <Zap className="size-3.5" aria-hidden="true" />
          <span>{zh ? '雅思 9 分句式模板库' : 'Band 9 Sentence Templates'}</span>
        </button>
      </div>

      {/* TAB 1: TOPICS (DEEP DIVE WITH INLINE MINI-QUIZZES) */}
      {activeTab === 'topics' && (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col gap-4 rounded-3xl border border-border/80 bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:p-5">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {GRAMMAR_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition',
                      isSelected
                        ? 'bg-primary/20 text-primary border border-primary/40 font-semibold'
                        : 'border border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {zh ? cat.labelZh : cat.labelEn}
                  </button>
                )
              })}
            </div>

            {/* Search input & Band filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 sm:w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={zh ? '搜索语法规则、句式公式...' : 'Search grammar formulas...'}
                  className="h-8 w-full rounded-full border border-border bg-background/80 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-hidden"
                />
              </div>

              <select
                value={selectedBand}
                onChange={(e) => setSelectedBand(e.target.value)}
                className="h-8 rounded-full border border-border bg-card px-2.5 text-xs text-muted-foreground focus:border-primary/50 focus:outline-hidden"
              >
                <option value="all">{zh ? '全部目标分数' : 'All Band Levels'}</option>
                <option value="7.0">Band 7.0+</option>
                <option value="7.5">Band 7.5+</option>
                <option value="8.0">Band 8.0+</option>
                <option value="8.5">Band 8.5+</option>
              </select>
            </div>
          </div>

          {/* Topics List */}
          <div className="space-y-4">
            {filteredTopics.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                {zh ? '未找到符合条件的语法专题，请尝试换一个关键词。' : 'No grammar topics matched your filter.'}
              </div>
            ) : (
              filteredTopics.map((topic) => {
                const isExpanded = expandedTopicId === topic.id
                const topicQuizzes = topic.quizzes ?? [topic.quiz]
                const state = topicQuizState[topic.id] ?? { qIdx: 0, picked: null, checked: false }
                const currentQuiz = topicQuizzes[state.qIdx % topicQuizzes.length]
                const totalMiniQuizzes = topicQuizzes.length

                return (
                  <article
                    key={topic.id}
                    className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs transition hover:border-primary/30"
                  >
                    {/* Collapsible Card Header */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setExpandedTopicId(isExpanded ? null : topic.id)
                        }
                      }}
                      className="flex cursor-pointer items-start justify-between gap-4 p-5 sm:p-6"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-primary/40 bg-primary/10 font-mono text-primary text-[10px]">
                            {topic.bandTarget}
                          </Badge>
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {topic.ieltsApplication}
                          </span>
                        </div>
                        <h2 className="font-display text-lg font-bold text-foreground">
                          {topic.title}
                        </h2>
                        <p className="font-mono text-xs text-primary/90">
                          {topic.formula}
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {zh ? topic.summaryZh : topic.summaryEn}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground sm:inline hidden">
                          {isExpanded ? (zh ? '收起精讲' : 'Collapse') : (zh ? '展开精讲' : 'Deep Dive')}
                        </span>
                        <div className="rounded-full bg-muted p-1 text-muted-foreground">
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detailed Breakdown */}
                    {isExpanded && (
                      <div className="space-y-6 border-t border-border/70 bg-background/40 p-5 sm:p-6">
                        {/* Explanation & Scoring Reason */}
                        <div className="space-y-2">
                          <h4 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                            <Lightbulb className="size-4 text-amber-500" aria-hidden="true" />
                            <span>{zh ? '考官视角与提分机理' : 'Examiner Rationale & Scoring Mechanics'}</span>
                          </h4>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {topic.explanationZh}
                          </p>
                        </div>

                        {/* Bad vs Good Comparative Analysis */}
                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Low Band / Flawed sentence */}
                          <div className="flex flex-col justify-between rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-destructive">
                                <XCircle className="size-3.5" aria-hidden="true" />
                                <span>{zh ? '平淡 / 常见错误（Band 5.5 - 6.0）' : 'Common Mistake / Weak Expression'}</span>
                              </div>
                              <p className="font-mono text-xs text-foreground/90">
                                “{topic.badExample}”
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {topic.badExampleZh}
                              </p>
                            </div>
                            <div className="mt-3 border-t border-destructive/20 pt-2 text-[10px] text-destructive/80">
                              <strong>{zh ? '失分诱因：' : 'Flaw: '}</strong>
                              {topic.badReason}
                            </div>
                          </div>

                          {/* High Band Upgraded sentence */}
                          <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                  <span>{zh ? '雅思学术高分升级（Band 8.0 - 9.0）' : 'Academic Upgrade (Band 8.0+)'}</span>
                                </div>
                                <Pronunciation word={topic.goodExample} showText={false} />
                              </div>
                              <p className="font-mono text-xs font-medium text-emerald-950 dark:text-emerald-200">
                                “{topic.goodExample}”
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {topic.goodExampleZh}
                              </p>
                            </div>
                            <div className="mt-3 border-t border-emerald-500/20 pt-2 text-[10px] text-emerald-700 dark:text-emerald-400">
                              <strong>{zh ? '提分精髓：' : 'Upgrade: '}</strong>
                              {topic.goodUpgradeReason}
                            </div>
                          </div>
                        </div>

                        {/* Real-Exam Example Sentences with Pronunciation */}
                        <div className="space-y-3">
                          <h4 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                            <BookOpen className="size-4 text-primary" aria-hidden="true" />
                            <span>{zh ? '真实考场高阶范例与原声音频' : 'Real-Exam Authentic Contexts & Audio'}</span>
                          </h4>
                          <div className="space-y-2.5">
                            {topic.examples.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3.5"
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  {item.contextTag && (
                                    <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary">
                                      {item.contextTag}
                                    </span>
                                  )}
                                  <p className="font-mono text-xs text-foreground/90 leading-relaxed">
                                    {item.en}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {item.zh}
                                  </p>
                                </div>
                                <Pronunciation word={item.en} showText={false} />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Interactive In-Card Mini Quiz */}
                        <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4.5 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary">
                                <GraduationCap className="size-3.5" />
                                {zh ? '专题随堂小测试' : 'Topic Mini-Quiz'}
                              </span>
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                                {state.qIdx + 1} / {totalMiniQuizzes}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {state.checked && (
                                <Badge
                                  variant={state.picked === currentQuiz.correctIndex ? 'default' : 'destructive'}
                                  className="text-[10px]"
                                >
                                  {state.picked === currentQuiz.correctIndex
                                    ? (zh ? '回答正确 ✓' : 'Correct ✓')
                                    : (zh ? '回答有误 ✗' : 'Incorrect ✗')}
                                </Badge>
                              )}
                              {totalMiniQuizzes > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleInlineQuizNext(topic.id, totalMiniQuizzes)}
                                  className="h-6 gap-1 rounded-full px-2 text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  <span>{zh ? '换一题' : 'Next Quiz'}</span>
                                  <RefreshCw className="size-2.5" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-medium text-foreground">
                              {currentQuiz.question}
                            </p>
                            {zh && currentQuiz.questionZh && (
                              <p className="text-[11px] text-muted-foreground">{currentQuiz.questionZh}</p>
                            )}
                          </div>

                          <div className="space-y-1.5 pt-1">
                            {currentQuiz.options.map((opt, optIdx) => {
                              const isPicked = state.picked === optIdx
                              const isCorrect = optIdx === currentQuiz.correctIndex
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  disabled={state.checked}
                                  onClick={() => handleInlineQuizPick(topic.id, optIdx)}
                                  className={cn(
                                    'w-full text-left rounded-xl border p-2.5 text-xs transition flex items-start gap-2.5',
                                    !state.checked
                                      ? isPicked
                                        ? 'border-primary bg-primary/10 text-primary font-medium'
                                        : 'border-border/70 bg-card hover:bg-card/80 text-foreground/90'
                                      : isCorrect
                                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-medium'
                                        : isPicked
                                          ? 'border-destructive bg-destructive/10 text-destructive'
                                          : 'border-border/50 bg-card/40 text-muted-foreground opacity-60',
                                  )}
                                >
                                  <span className="font-mono text-[11px] opacity-70">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </span>
                                  <span className="min-w-0 flex-1">{opt}</span>
                                </button>
                              )
                            })}
                          </div>

                          {state.checked && (
                            <div className="rounded-xl border border-border/80 bg-muted/40 p-3 text-xs space-y-1">
                              <p className="font-medium text-foreground">{zh ? '解析依据：' : 'Rationale: '}</p>
                              <p className="text-[11px] leading-relaxed text-muted-foreground">
                                {currentQuiz.explanation}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2">
                            <span className="text-[11px] text-muted-foreground">
                              💡 <strong>{zh ? '应试锦囊：' : 'Tip: '}</strong>
                              {topic.examTips}
                            </span>

                            {!state.checked && (
                              <Button
                                size="sm"
                                disabled={state.picked === null}
                                onClick={() => handleInlineQuizCheck(topic.id)}
                                className="h-7 rounded-full px-3.5 text-xs"
                              >
                                {zh ? '校验答案' : 'Check'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FULL QUESTION BANK & MASTERY */}
      {activeTab === 'quiz' && (
        <div className="space-y-6">
          {/* Bank Mode Switcher Banner */}
          <div className="flex flex-col gap-4 rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/[0.04] via-card to-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
                <h2 className="font-display text-base font-bold text-foreground">
                  {zh ? '全真语法题库测试中心' : 'Grammar Question Bank & Drills'}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {zh
                  ? '精选题库直击倒装、让步、分词、学术谨慎语气与高频硬伤错误，智能错题收录。'
                  : 'High-yield examination items spanning inversion, clauses, hedging, and high-frequency writing pitfalls.'}
              </p>
            </div>

            {/* Mode selection buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={bankMode === '5-sprint' ? 'default' : 'outline'}
                onClick={() => handleStartBankMode('5-sprint')}
                className="h-8 gap-1.5 rounded-full text-xs"
              >
                <Flame className="size-3 text-amber-500" />
                <span>{zh ? '5 题速测' : '5-Item Sprint'}</span>
              </Button>
              <Button
                size="sm"
                variant={bankMode === '10-focus' ? 'default' : 'outline'}
                onClick={() => handleStartBankMode('10-focus')}
                className="h-8 gap-1.5 rounded-full text-xs"
              >
                <Zap className="size-3 text-primary" />
                <span>{zh ? '10 题强化' : '10-Item Focus'}</span>
              </Button>
              <Button
                size="sm"
                variant={bankMode === 'all' ? 'default' : 'outline'}
                onClick={() => handleStartBankMode('all')}
                className="h-8 gap-1.5 rounded-full text-xs"
              >
                <Layers className="size-3" />
                <span>{zh ? `全真模考 (${GRAMMAR_QUESTION_BANK.length})` : 'All Questions'}</span>
              </Button>
              {wrongQuestionIds.length > 0 && (
                <Button
                  size="sm"
                  variant={bankMode === 'mistakes' ? 'default' : 'outline'}
                  onClick={() => handleStartBankMode('mistakes')}
                  className={cn(
                    'h-8 gap-1.5 rounded-full text-xs',
                    bankMode === 'mistakes' ? 'bg-destructive text-destructive-foreground' : 'border-destructive/40 text-destructive',
                  )}
                >
                  <XCircle className="size-3" />
                  <span>{zh ? `错题本 (${wrongQuestionIds.length})` : `Mistakes (${wrongQuestionIds.length})`}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Category Filter for Bank */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">{zh ? '分类筛选：' : 'Category: '}</span>
            {GRAMMAR_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setBankCategoryFilter(cat.id)
                  setBankCurrentIdx(0)
                  setBankSelectedOpt(null)
                  setBankIsChecked(false)
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition',
                  bankCategoryFilter === cat.id
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'border border-border/80 bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                {zh ? cat.labelZh : cat.labelEn}
              </button>
            ))}
          </div>

          {/* Active Question Box */}
          <div className="max-w-2xl mx-auto space-y-6">
            {activeQuestions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-12 text-center space-y-3">
                <CheckCircle2 className="size-8 mx-auto text-emerald-500" />
                <p className="text-sm font-medium text-foreground">
                  {zh ? '暂无符合题目的练习项（若在错题本模式，说明你目前没有未解决错题）！' : 'No items match this filter.'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStartBankMode('5-sprint')}
                  className="rounded-full text-xs"
                >
                  {zh ? '返回 5 题速测' : 'Start 5-Item Sprint'}
                </Button>
              </div>
            ) : !bankFinished && currentBankQuestion ? (
              <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
                {/* Progress Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      {zh
                        ? `考题 ${bankCurrentIdx + 1} / ${activeQuestions.length}`
                        : `Question ${bankCurrentIdx + 1} of ${activeQuestions.length}`}
                    </span>
                    <Badge variant="outline" className="border-primary/30 text-[10px]">
                      {currentBankQuestion.bandTarget}
                    </Badge>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {currentBankQuestion.difficulty}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {zh ? `当前得分: ${bankScore}` : `Score: ${bankScore}`}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${((bankCurrentIdx + 1) / activeQuestions.length) * 100}%` }}
                  />
                </div>

                {/* Question Prompt */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-semibold text-primary uppercase">
                      {currentBankQuestion.topicTitle}
                    </span>
                    <Pronunciation word={currentBankQuestion.question} showText={false} />
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground leading-snug">
                    {currentBankQuestion.question}
                  </h3>
                  {zh && currentBankQuestion.questionZh && (
                    <p className="text-xs text-muted-foreground">{currentBankQuestion.questionZh}</p>
                  )}
                </div>

                {/* Options List */}
                <div className="space-y-2">
                  {currentBankQuestion.options.map((opt, oIdx) => {
                    const isPicked = bankSelectedOpt === oIdx
                    const isCorrect = oIdx === currentBankQuestion.correctIndex
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        disabled={bankIsChecked}
                        onClick={() => setBankSelectedOpt(oIdx)}
                        className={cn(
                          'w-full text-left rounded-2xl border p-3.5 text-xs transition flex items-start gap-3',
                          !bankIsChecked
                            ? isPicked
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border/80 bg-background hover:border-primary/40 text-foreground'
                            : isCorrect
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-medium'
                              : isPicked
                                ? 'border-destructive bg-destructive/10 text-destructive'
                                : 'border-border/50 bg-card/40 text-muted-foreground opacity-60',
                        )}
                      >
                        <span className="font-mono text-xs font-semibold opacity-70">
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        <span className="min-w-0 flex-1 leading-relaxed">{opt}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Explanation & Trap Alert */}
                {bankIsChecked && (
                  <div className="space-y-2.5 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <HelpCircle className="size-3.5 text-primary" />
                      <span>{zh ? '考点详解与规则依据' : 'Grammar Rationale'}</span>
                    </div>
                    <p className="leading-relaxed text-muted-foreground">
                      {currentBankQuestion.explanation}
                    </p>
                    {currentBankQuestion.trapReason && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
                        <strong>⚠️ {zh ? '考官陷阱警示：' : 'Examiner Trap: '}</strong>
                        {currentBankQuestion.trapReason}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions footer */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    {zh ? '每做一题，立即生成权威考情解析' : 'Instant diagnostic explanation'}
                  </span>

                  {!bankIsChecked ? (
                    <Button
                      disabled={bankSelectedOpt === null}
                      onClick={handleBankSubmit}
                      className="rounded-full px-5 text-xs"
                    >
                      {zh ? '提交判定' : 'Submit'}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleBankNext}
                      className="rounded-full px-5 text-xs gap-1.5"
                    >
                      <span>
                        {bankCurrentIdx + 1 === activeQuestions.length
                          ? (zh ? '查看成绩报告' : 'View Results')
                          : (zh ? '下一题' : 'Next Question')}
                      </span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Finish Screen */
              <div className="rounded-3xl border border-border/80 bg-card p-8 text-center space-y-5 shadow-xs">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Award className="size-8 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-xl font-bold text-foreground">
                    {zh ? '测试训练顺利完成！' : 'Drill Completed!'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {zh
                      ? `本次训练共 ${activeQuestions.length} 道题目，你的最终得分是：`
                      : `You answered ${bankScore} out of ${activeQuestions.length} questions correctly.`}
                  </p>
                </div>

                <div className="font-mono text-4xl font-bold text-primary">
                  {bankScore} / {activeQuestions.length}
                </div>

                <div className="max-w-md mx-auto text-xs text-muted-foreground leading-relaxed">
                  {Math.round((bankScore / (activeQuestions.length || 1)) * 100) >= 80 ? (
                    <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {zh
                        ? '🎉 极佳！你对雅思 8.0+ 倒装、分词从句与学术谨慎用语的把握已相当精准。'
                        : 'Outstanding control of advanced academic grammatical structures!'}
                    </p>
                  ) : (
                    <p>
                      {zh
                        ? '建议多回看错题，并结合“语法精讲与句式矩阵”中的真题例句加深记忆。'
                        : 'Review incorrect items and strengthen conceptual foundations in the Deep-Dive tab.'}
                    </p>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={handleRestartBank}
                    variant="outline"
                    className="rounded-full gap-2 text-xs"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>{zh ? '重新练习此模式' : 'Retry Mode'}</span>
                  </Button>
                  {wrongQuestionIds.length > 0 && (
                    <Button
                      onClick={() => handleStartBankMode('mistakes')}
                      className="rounded-full gap-2 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      <XCircle className="size-3.5" />
                      <span>{zh ? `攻坚错题 (${wrongQuestionIds.length})` : 'Review Mistakes'}</span>
                    </Button>
                  )}
                  <Button
                    onClick={() => setActiveTab('topics')}
                    variant="secondary"
                    className="rounded-full gap-2 text-xs"
                  >
                    <BookMarked className="size-3.5" />
                    <span>{zh ? '回看语法专题' : 'Back to Lessons'}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ERROR CLINIC */}
      {activeTab === 'clinic' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-destructive/20 bg-destructive/[0.03] p-6 space-y-2">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              <span>{zh ? '雅思写作高频病句与失分陷阱诊所' : 'Common IELTS Writing Pitfalls & Surgical Fixes'}</span>
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {zh
                ? '直击中国考生大作文最致命的 3 类硬伤：逗号拼接（Comma Splice）、主谓一致性失控（Subject-Verb Agreement）与极端武断语气（Overgeneralized Dogmatism）。'
                : 'Surgical error correction focusing on punctuation splices, modifier agreement, and absolute tone.'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {GRAMMAR_TOPICS.filter((t) => t.category === 'errors' || t.category === 'hedging').map((topic) => (
              <div
                key={topic.id}
                className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive font-mono text-[10px]">
                      {topic.bandTarget}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground font-mono">{topic.ieltsApplication}</span>
                  </div>
                  <h3 className="font-display font-bold text-sm text-foreground">{topic.title}</h3>
                </div>

                <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-3.5 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-destructive">
                    <XCircle className="size-3.5" />
                    <span>{zh ? '典型病句：' : 'Flawed sentence: '}</span>
                  </div>
                  <p className="font-mono text-foreground/90 font-medium">“{topic.badExample}”</p>
                  <p className="text-[11px] text-muted-foreground">{topic.badReason}</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      <span>{zh ? '高分手术级修正：' : 'Surgical Upgrade: '}</span>
                    </div>
                    <Pronunciation word={topic.goodExample} showText={false} />
                  </div>
                  <p className="font-mono text-foreground font-medium">“{topic.goodExample}”</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{topic.goodUpgradeReason}</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/30 px-3.5 py-2 text-[11px] text-muted-foreground">
                  <strong>{zh ? '规避公式：' : 'Formula: '}</strong>
                  <code className="font-mono text-primary text-[11px]">{topic.formula}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: BAND 9 TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-primary/20 bg-primary/[0.03] p-6 space-y-2">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              <span>{zh ? '雅思 9 分经典句式模板与实战骨架' : 'Band 9 Sentence Templates & Academic Frames'}</span>
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {zh
                ? '提炼自剑桥雅思考官范文的高分句型骨架。包含让步反驳、政策失察警示性倒装、图表鲜明对立对比等结构，支持一键复制到剪贴板。'
                : 'Ready-to-use syntactic frameworks derived from official examiner sample essays for Task 1 and Task 2.'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {BAND_NINE_TEMPLATES.map((tpl) => {
              const isCopied = copiedTemplateId === tpl.id
              return (
                <div
                  key={tpl.id}
                  className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-mono text-[10px]">
                          {tpl.taskType}
                        </Badge>
                        <span className="font-display font-bold text-sm text-foreground">{tpl.title}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(tpl)}
                        className="h-7 gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {isCopied ? (
                          <>
                            <Check className="size-3 text-emerald-500" />
                            <span className="text-emerald-500">{zh ? '已复制' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>{zh ? '复制骨架' : 'Copy'}</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <span className="inline-block text-[11px] text-muted-foreground">{tpl.usage}</span>
                  </div>

                  {/* Template Frame */}
                  <div className="rounded-2xl border border-primary/20 bg-background/80 p-3.5 space-y-1">
                    <span className="font-mono text-[10px] font-semibold text-primary uppercase">
                      {zh ? '语法骨架 (Frame)' : 'Syntax Frame'}
                    </span>
                    <p className="font-mono text-xs font-semibold text-foreground/95 leading-relaxed">
                      {tpl.templateEn}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{tpl.templateZh}</p>
                  </div>

                  {/* Concrete Realization */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase">
                        {zh ? '实战真题范句 (Model Realization)' : 'Model Realization'}
                      </span>
                      <Pronunciation word={tpl.exampleEn} showText={false} />
                    </div>
                    <p className="font-mono text-xs text-foreground/90 leading-relaxed">
                      “{tpl.exampleEn}”
                    </p>
                    <p className="text-[11px] text-muted-foreground">{tpl.exampleZh}</p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {tpl.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
