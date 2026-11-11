import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookCheck,
  BookMarked,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Search,
  Sparkles,
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
  GRAMMAR_TOPICS,
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

  // Interactive Quiz state
  const [quizIdx, setQuizIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [isAnswerChecked, setIsAnswerChecked] = useState(false)
  const [quizScore, setQuizScore] = useState(0)
  const [quizFinished, setQuizFinished] = useState(false)

  // Inline topic quiz states (topicId -> { picked: number, checked: boolean })
  const [topicQuizState, setTopicQuizState] = useState<Record<string, { picked: number | null; checked: boolean }>>({})

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

  function handleCopy(template: SentenceTemplate) {
    void navigator.clipboard.writeText(template.templateEn)
    setCopiedTemplateId(template.id)
    window.setTimeout(() => setCopiedTemplateId(null), 2000)
  }

  function handleInlineQuizPick(topicId: string, optIdx: number) {
    if (topicQuizState[topicId]?.checked) return
    setTopicQuizState((prev) => ({
      ...prev,
      [topicId]: { picked: optIdx, checked: false },
    }))
  }

  function handleInlineQuizCheck(topicId: string) {
    setTopicQuizState((prev) => ({
      ...prev,
      [topicId]: { picked: prev[topicId]?.picked ?? null, checked: true },
    }))
  }

  function handleNextGlobalQuiz() {
    if (quizIdx + 1 < GRAMMAR_TOPICS.length) {
      setQuizIdx((prev) => prev + 1)
      setSelectedOption(null)
      setIsAnswerChecked(false)
    } else {
      setQuizFinished(true)
    }
  }

  function handleRestartGlobalQuiz() {
    setQuizIdx(0)
    setSelectedOption(null)
    setIsAnswerChecked(false)
    setQuizScore(0)
    setQuizFinished(false)
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
              <span className="font-mono text-lg font-bold text-emerald-500">Band 8.5</span>
              <span className="text-[11px] text-muted-foreground">{zh ? '最高句式目标' : 'Target Band'}</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-background/70 px-4 py-2.5 text-center shadow-2xs">
              <span className="font-mono text-lg font-bold text-foreground">{BAND_NINE_TEMPLATES.length}</span>
              <span className="text-[11px] text-muted-foreground">{zh ? '实战模板' : 'Templates'}</span>
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
          <span>{zh ? '随堂自测与考点攻克' : 'Grammar Mastery Quiz'}</span>
        </button>
      </div>

      {/* TAB 1: TOPICS (DEEP DIVE) */}
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
                const topicQuiz = topicQuizState[topic.id]
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

                        {/* Inline Practice Quiz */}
                        <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4.5 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary">
                              <GraduationCap className="size-3.5" />
                              {zh ? '专题随堂诊断 (Diagnostic Check)' : 'Mini Diagnostic'}
                            </span>
                            {topicQuiz?.checked && (
                              <Badge
                                variant={topicQuiz.picked === topic.quiz.correctIndex ? 'default' : 'destructive'}
                                className="text-[10px]"
                              >
                                {topicQuiz.picked === topic.quiz.correctIndex
                                  ? (zh ? '回答正确 ✓' : 'Correct ✓')
                                  : (zh ? '回答有误 ✗' : 'Incorrect ✗')}
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs font-medium text-foreground">
                            {topic.quiz.question}
                          </p>
                          {zh && topic.quiz.questionZh && (
                            <p className="text-[11px] text-muted-foreground">{topic.quiz.questionZh}</p>
                          )}

                          <div className="space-y-1.5 pt-1">
                            {topic.quiz.options.map((opt, optIdx) => {
                              const isPicked = topicQuiz?.picked === optIdx
                              const isCorrect = optIdx === topic.quiz.correctIndex
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() => handleInlineQuizPick(topic.id, optIdx)}
                                  className={cn(
                                    'w-full text-left rounded-xl border p-2.5 text-xs transition flex items-start gap-2.5',
                                    !topicQuiz?.checked
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

                          <div className="flex items-center justify-between pt-2">
                            <span className="text-[11px] text-muted-foreground">
                              💡 <strong>{zh ? '应试锦囊：' : 'Tip: '}</strong>
                              {topic.examTips}
                            </span>
                            {!topicQuiz?.checked && topicQuiz?.picked !== null && topicQuiz?.picked !== undefined && (
                              <Button
                                size="sm"
                                onClick={() => handleInlineQuizCheck(topic.id)}
                                className="h-7 rounded-full text-xs"
                              >
                                {zh ? '核对答案' : 'Check'}
                              </Button>
                            )}
                          </div>

                          {topicQuiz?.checked && (
                            <div className="mt-2 rounded-xl bg-background/80 p-3 text-[11px] leading-relaxed text-muted-foreground border border-border/60">
                              <strong className="text-foreground">{zh ? '解析：' : 'Analysis: '}</strong>
                              {topic.quiz.explanation}
                            </div>
                          )}
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

      {/* TAB 2: CLINIC (ERROR DIAGNOSIS) */}
      {activeTab === 'clinic' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-destructive/20 bg-destructive/[0.02] p-6 space-y-2">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              <span>{zh ? '雅思写作中式常见病句诊所' : 'IELTS Writing Sentence Clinic'}</span>
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {zh
                ? '考官在批阅 Task 2 时，语法错误通常分为“致命性失分错误”（Comma splice、主谓不一致、悬垂分词）与“口语化生硬表达”。本诊所提供手术式重写对比与避坑指南。'
                : 'Interactive diagnosis of high-risk grammatical errors that cap Grammatical Range & Accuracy at Band 5.5-6.0.'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {GRAMMAR_TOPICS.filter((t) => t.category === 'errors' || t.category === 'hedging').map((topic) => (
              <div
                key={topic.id}
                className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-semibold text-sm text-foreground">{topic.title}</span>
                    <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px]">
                      {zh ? '高频踩雷' : 'High Risk'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {topic.summaryZh}
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-3 text-xs space-y-1">
                    <span className="font-mono text-[10px] font-semibold text-destructive uppercase">
                      {zh ? '❌ 典型病句 / 学生原句' : '❌ Student Error'}
                    </span>
                    <p className="font-mono text-foreground/90">“{topic.badExample}”</p>
                    <p className="text-[11px] text-muted-foreground">{topic.badReason}</p>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                        {zh ? '✓ 手术式学术重构' : '✓ Band 8.5+ Surgical Fix'}
                      </span>
                      <Pronunciation word={topic.goodExample} showText={false} />
                    </div>
                    <p className="font-mono text-foreground font-medium">“{topic.goodExample}”</p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{topic.goodUpgradeReason}</p>
                  </div>
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

      {/* TAB 3: BAND 9 TEMPLATES */}
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

      {/* TAB 4: QUIZ & MASTERY */}
      {activeTab === 'quiz' && (
        <div className="max-w-2xl mx-auto space-y-6">
          {!quizFinished ? (
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
              {/* Progress Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">
                    {zh ? `题目 ${quizIdx + 1} / ${GRAMMAR_TOPICS.length}` : `Question ${quizIdx + 1} of ${GRAMMAR_TOPICS.length}`}
                  </span>
                  <Badge variant="outline" className="text-[10px] border-primary/30">
                    {GRAMMAR_TOPICS[quizIdx].bandTarget}
                  </Badge>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {zh ? `得分: ${quizScore}` : `Score: ${quizScore}`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${((quizIdx + 1) / GRAMMAR_TOPICS.length) * 100}%` }}
                />
              </div>

              {/* Question */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono font-semibold text-primary uppercase">
                  {GRAMMAR_TOPICS[quizIdx].title}
                </span>
                <h3 className="font-display text-base font-bold text-foreground">
                  {GRAMMAR_TOPICS[quizIdx].quiz.question}
                </h3>
                {zh && GRAMMAR_TOPICS[quizIdx].quiz.questionZh && (
                  <p className="text-xs text-muted-foreground">{GRAMMAR_TOPICS[quizIdx].quiz.questionZh}</p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2">
                {GRAMMAR_TOPICS[quizIdx].quiz.options.map((opt, oIdx) => {
                  const isPicked = selectedOption === oIdx
                  const isCorrect = oIdx === GRAMMAR_TOPICS[quizIdx].quiz.correctIndex
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={isAnswerChecked}
                      onClick={() => setSelectedOption(oIdx)}
                      className={cn(
                        'w-full text-left rounded-2xl border p-3.5 text-xs transition flex items-start gap-3',
                        !isAnswerChecked
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

              {/* Explanation & Action */}
              {isAnswerChecked && (
                <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <HelpCircle className="size-3.5 text-primary" />
                    <span>{zh ? '考点详解与规则依据' : 'Grammar Rationale'}</span>
                  </div>
                  <p className="leading-relaxed text-muted-foreground">
                    {GRAMMAR_TOPICS[quizIdx].quiz.explanation}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-muted-foreground">
                  💡 {GRAMMAR_TOPICS[quizIdx].examTips}
                </span>

                {!isAnswerChecked ? (
                  <Button
                    disabled={selectedOption === null}
                    onClick={() => {
                      if (selectedOption === null) return
                      setIsAnswerChecked(true)
                      if (selectedOption === GRAMMAR_TOPICS[quizIdx].quiz.correctIndex) {
                        setQuizScore((prev) => prev + 1)
                      }
                    }}
                    className="rounded-full px-5 text-xs"
                  >
                    {zh ? '提交并判定' : 'Submit'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNextGlobalQuiz}
                    className="rounded-full px-5 text-xs gap-1.5"
                  >
                    <span>{quizIdx + 1 === GRAMMAR_TOPICS.length ? (zh ? '查看成绩' : 'View Results') : (zh ? '下一题' : 'Next Question')}</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-border/80 bg-card p-8 text-center space-y-5 shadow-xs">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <GraduationCap className="size-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-xl font-bold text-foreground">
                  {zh ? '语法自测圆满完成！' : 'Quiz Completed!'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {zh
                    ? `本次自测总分 ${GRAMMAR_TOPICS.length} 分，你的最终得分是：`
                    : `You answered ${quizScore} out of ${GRAMMAR_TOPICS.length} questions correctly.`}
                </p>
              </div>

              <div className="font-mono text-4xl font-bold text-primary">
                {quizScore} / {GRAMMAR_TOPICS.length}
              </div>

              <p className="max-w-md mx-auto text-xs text-muted-foreground leading-relaxed">
                {quizScore >= 7
                  ? (zh ? '卓越表现！你对雅思 8.0+ 倒装虚拟、裂句与学术谨慎语气掌握极为娴熟。' : 'Outstanding mastery of advanced IELTS syntactic structures!')
                  : (zh ? '打好基础，多回看“病句诊所”与“精讲矩阵”，注意避免逗号粘连与悬垂从句。' : 'Keep practicing with the Sentence Clinic to eliminate punctuation and modifier errors.')}
              </p>

              <div className="pt-2 flex justify-center gap-3">
                <Button
                  onClick={handleRestartGlobalQuiz}
                  variant="outline"
                  className="rounded-full gap-2 text-xs"
                >
                  <RotateCcw className="size-3.5" />
                  <span>{zh ? '重新挑战' : 'Retry Quiz'}</span>
                </Button>
                <Button
                  onClick={() => setActiveTab('topics')}
                  className="rounded-full gap-2 text-xs"
                >
                  <BookMarked className="size-3.5" />
                  <span>{zh ? '返回精讲' : 'Back to Lessons'}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
