import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Check,
  Clock,
  Cpu,
  Flame,
  Play,
  Star,
  Target,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { updateLearningProfile } from '@/lib/api'
import type { EnglishCard } from '@/lib/english'
import { LESSONS_PER_UNIT, currentLesson, lessonCount, lessonWords, type LessonProgress } from '@/lib/lesson'
import { QUESTION_TYPE_LABELS, type BestNextActivity, type DailyStudyStep, type LearningPlanResponse } from '@/lib/reading'
import { cn } from '@/lib/utils'

export function SmartDailyCoach({
  plan,
  cards,
  progress,
  onStartLesson,
  onStartSrs,
  onRefreshPlan,
}: {
  plan: LearningPlanResponse | null
  cards: EnglishCard[]
  progress: LessonProgress
  onStartLesson: (lessonIndex: number) => void
  onStartSrs: () => void
  onRefreshPlan: () => void
}) {
  const { t, locale } = useI18n()
  const zh = locale === 'zh'
  const navigate = useNavigate()
  const [updatingSettings, setUpdatingSettings] = useState(false)

  const totalLessons = lessonCount(cards.length)
  const activeLesson = currentLesson(progress.completed, totalLessons)
  const activeUnit = Math.min(Math.floor(activeLesson / LESSONS_PER_UNIT), Math.max(1, Math.ceil(totalLessons / LESSONS_PER_UNIT)) - 1)
  const unitRootWord = lessonWords(cards, activeUnit * LESSONS_PER_UNIT)[0]?.word ?? 'abandon'
  const masteredWords = Math.max(progress.completed.length * 5, cards.filter((c) => c.inReview).length)

  // Provide a deterministic fallback plan while loading or in unit tests that don't stub /api/learning/plan
  const reviewCards = cards.filter((c) => c.inReview)
  const effectiveDue = plan?.srs.dueNow ?? reviewCards.length
  const effectiveTracked = plan?.srs.totalTracked ?? Math.max(effectiveDue, progress.completed.length * 5 || 5)

  const nextActivity: BestNextActivity = plan?.nextActivity ?? {
    id: effectiveDue > 0 ? 'srs_review' : 'vocab_lesson',
    kind: effectiveDue > 0 ? 'srs' : 'vocab_lesson',
    title:
      effectiveDue > 0
        ? `Review ${effectiveDue} due vocabulary words in context`
        : `Start Contextual Vocabulary Lesson ${activeLesson + 1}`,
    titleZh:
      effectiveDue > 0
        ? `在语境中复习 ${effectiveDue} 个到期核心词`
        : `开始第 ${activeLesson + 1} 课语境词汇精学`,
    reason:
      effectiveDue > 0
        ? `System detected ${effectiveDue} words from your lessons and reading have reached their optimal FSRS recall point. Active retrieval right now multiplies long-term stability.`
        : `Master 5 core IELTS words in context with Band 9 collocations and active recall.`,
    reasonZh:
      effectiveDue > 0
        ? `系统检测到你在课程与阅读中积累的 ${effectiveDue} 个词汇已达到 FSRS 最佳抗遗忘复习点。现在进行主动上下文检索能成倍提升远期记忆稳定性。`
        : `掌握第 ${activeLesson + 1} 课的 5 个核心词及其雅思高分搭配，并自动排入 FSRS 间隔复习队列。`,
    cognitivePrinciple: 'Spaced Retrieval & Desirable Difficulty (FSRS)',
    cognitivePrincipleZh: '间隔重复与合意困难 (FSRS主动检索)',
    estimatedMinutes: 3,
    ctaLabel: effectiveDue > 0 ? 'Start Spaced Recall' : `Start Lesson ${activeLesson + 1}`,
    ctaLabelZh: effectiveDue > 0 ? '开始间隔复习' : `开始第 ${activeLesson + 1} 课`,
    lessonIndex: activeLesson,
    dueCount: effectiveDue,
  }

  const profile = plan?.profile ?? {
    dailyMinutes: 20,
    targetBand: 7.0,
    preferredModule: 'academic' as const,
    timezone: 'UTC',
  }

  const srs = plan?.srs ?? {
    dueNow: effectiveDue,
    totalTracked: effectiveTracked,
    learningCount: effectiveDue,
    youngCount: progress.completed.length * 3,
    matureCount: progress.completed.length * 2,
    retention7d: 71.4,
    reviewsToday: 0,
  }

  const proficiency = plan?.proficiency ?? {
    sufficientEvidence: false,
    questionsAnswered: 0,
    estimatedBandRange: 'Calibrating (15+ questions needed)',
    cefrLevel: 'CALIBRATING',
    confidenceNote: 'You have answered 0 reading questions so far. Complete at least 15 questions across passages before we estimate an unofficial IELTS band range.',
    confidenceNoteZh: '目前已作答 0 道阅读题。需至少完成 15 道题目后，系统才会给出基于真实样本的非官方雅思分数区间估计。',
    weakestSkill: 'matching_headings' as const,
  }

  const dailySession = plan?.dailySession ?? {
    targetMinutes: profile.dailyMinutes,
    completedMinutes: 0,
    steps: [
      {
        id: 'step-srs',
        kind: 'srs' as const,
        stepNumber: 1,
        title: `Spaced Recall (${srs.dueNow} due)`,
        titleZh: '间隔检索复习',
        subtitle: 'Active retrieval before memory decay, deepening long-term synaptic retention.',
        subtitleZh: '在遗忘临界点前主动回忆，深化长期突触记忆。',
        minutes: 4,
        status: srs.dueNow > 0 ? ('ready' as const) : ('completed' as const),
        dueCount: srs.dueNow,
      },
      {
        id: 'step-vocab',
        kind: 'vocab_lesson' as const,
        stepNumber: 2,
        title: `Contextual Vocabulary · Lesson ${activeLesson + 1}`,
        titleZh: `语境词汇精学 · 第 ${activeLesson + 1} 课`,
        subtitle: 'Master 5 core words with academic collocations, error avoidance & contextual usage.',
        subtitleZh: '掌握 5 个核心词的高分学术搭配、逻辑避错与语境造句。',
        minutes: 6,
        status: 'ready' as const,
        lessonIndex: activeLesson,
      },
      {
        id: 'step-reading',
        kind: 'reading_daily' as const,
        stepNumber: 3,
        title: '5-Question IELTS Reading Excerpt',
        titleZh: '每日5题雅思阅读精练',
        subtitle: '5 authentic-style passage questions focused on evidence location & paraphrase.',
        subtitleZh: '5道真题级同源题，专注证据定位与同义替换识别。',
        minutes: 6,
        status: 'ready' as const,
      },
      {
        id: 'step-mistakes',
        kind: 'mistakes' as const,
        stepNumber: 4,
        title: 'Targeted Mistake Remediation',
        titleZh: '错题诊断与重做',
        subtitle: 'Locate passage evidence chains and eliminate FALSE / NOT GIVEN traps.',
        subtitleZh: '定位原文证据链，消除 FALSE / NOT GIVEN 等高频陷阱。',
        minutes: 4,
        status: 'ready' as const,
        openMistakes: 0,
      },
    ],
  }

  // Word chips to preview inside the hero card
  const chipSource = reviewCards.length > 0 ? reviewCards : lessonWords(cards, activeLesson)
  const visibleChips = chipSource.slice(0, 4)
  const extraChipCount = Math.max(0, (nextActivity.dueCount ?? chipSource.length) - visibleChips.length)

  function triggerActivity(act: BestNextActivity) {
    if (act.kind === 'srs') {
      onStartSrs()
      return
    }
    if (act.kind === 'vocab_lesson') {
      onStartLesson(act.lessonIndex ?? activeLesson)
      return
    }
    if (act.kind === 'mistakes') {
      navigate('/reading?focus=mistakes')
      return
    }
    navigate('/reading')
  }

  function triggerStep(step: DailyStudyStep) {
    if (step.kind === 'srs') {
      onStartSrs()
      return
    }
    if (step.kind === 'vocab_lesson') {
      onStartLesson(step.lessonIndex ?? activeLesson)
      return
    }
    if (step.kind === 'mistakes') {
      navigate('/reading?focus=mistakes')
      return
    }
    navigate('/reading')
  }

  async function handleMinutesChange(minutes: number) {
    if (updatingSettings || minutes === profile.dailyMinutes) return
    setUpdatingSettings(true)
    try {
      await updateLearningProfile({
        dailyMinutes: minutes,
        targetBand: profile.targetBand,
        preferredModule: profile.preferredModule,
      })
      onRefreshPlan()
    } finally {
      setUpdatingSettings(false)
    }
  }

  async function handleTargetBandChange(band: number) {
    if (updatingSettings || band === profile.targetBand) return
    setUpdatingSettings(true)
    try {
      await updateLearningProfile({
        dailyMinutes: profile.dailyMinutes,
        targetBand: band,
        preferredModule: profile.preferredModule,
      })
      onRefreshPlan()
    } finally {
      setUpdatingSettings(false)
    }
  }

  const weakSkillLabel = proficiency.weakestSkill
    ? QUESTION_TYPE_LABELS[proficiency.weakestSkill]?.[zh ? 'zh' : 'en'] ?? proficiency.weakestSkill
    : zh
      ? '段落标题配对 (Headings)'
      : 'Matching Headings'

  const dueProgressPct = srs.totalTracked > 0 ? Math.min(100, Math.round((srs.dueNow / Math.max(1, srs.totalTracked)) * 100)) : 0
  const retentionPct = srs.retention7d ?? 71.4

  return (
    <section
      aria-labelledby="best-next-activity-heading"
      className="mb-6 space-y-5"
      data-testid="smart-daily-coach"
    >
      {/* Band 1: Top Workbench Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/80 bg-card px-6 py-5 shadow-xs">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              {zh ? 'FSRS 算法已就绪' : 'FSRS Engine Ready'}
            </span>
            <span className="text-muted-foreground">
              {zh ? `雅思冲分目标 · ${t('english.immersive')}` : `IELTS Target · ${t('english.immersive')}`}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {zh ? `${t('english.title')} · 沉浸式阶梯精读` : `${t('english.title')} · Immersive Step Reading`}
            </h1>
            <span className="text-xs text-muted-foreground sm:text-sm">
              {zh
                ? `第 ${activeUnit + 1} 单元 / ${unitRootWord} 词根链`
                : `Unit ${activeUnit + 1} / ${unitRootWord} chain`}
            </span>
          </div>
        </div>

        {/* Right 3-metric pill box */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/80 bg-background/60 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary/14 text-primary">
              <Flame className="size-4" aria-hidden="true" />
            </span>
            <div>
              <span className="block text-[10px] text-muted-foreground">{zh ? '连续' : 'Streak'}</span>
              <strong className="font-display text-sm font-semibold text-foreground">
                {t('english.streak', { n: progress.streak })}
              </strong>
            </div>
          </div>

          <div className="h-6 w-px bg-border/70" aria-hidden="true" />

          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary/14 text-primary">
              <Star className="size-4" aria-hidden="true" />
            </span>
            <div>
              <span className="block text-[10px] text-muted-foreground">{zh ? '总点数' : 'Total XP'}</span>
              <strong className="font-display text-sm font-semibold text-foreground">
                {t('english.xp', { n: progress.xp })}
              </strong>
            </div>
          </div>

          <div className="h-6 w-px bg-border/70" aria-hidden="true" />

          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary/14 text-primary">
              <Target className="size-4" aria-hidden="true" />
            </span>
            <div>
              <span className="block text-[10px] text-muted-foreground">{zh ? '今日掌握' : 'Mastered'}</span>
              <strong className="font-display text-sm font-semibold text-foreground">
                {masteredWords} {zh ? '词' : 'words'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Band 2: Two-Column Hero Recommendation + Diagnostic & Memory Status */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Your Best Next Learning Activity (7 cols) */}
        <div
          className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-xs sm:p-7 lg:col-span-7"
          data-testid="best-next-activity-card"
        >
          <Cpu
            className="pointer-events-none absolute top-6 right-6 size-32 text-primary/10 sm:size-36"
            strokeWidth={1.1}
            aria-hidden="true"
          />

          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
                <Zap className="size-3.5" aria-hidden="true" />
                {zh ? '当前最佳复习行动' : 'Your Best Next Learning Activity'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                <Clock className="size-3 text-primary" aria-hidden="true" />
                {zh ? nextActivity.cognitivePrincipleZh : nextActivity.cognitivePrinciple}
              </span>
            </div>

            <h2
              id="best-next-activity-heading"
              className="font-display text-2xl leading-snug font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              {zh ? nextActivity.titleZh : nextActivity.title}
            </h2>

            <p
              className="max-w-xl text-sm leading-relaxed text-muted-foreground"
              data-testid="best-next-activity-reason"
            >
              {zh ? nextActivity.reasonZh : nextActivity.reason}
            </p>

            {visibleChips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {visibleChips.map((card) => (
                  <span
                    key={card.id}
                    className="rounded-lg border border-border/80 bg-background/75 px-3 py-1 font-mono text-xs text-foreground"
                  >
                    {card.word}
                  </span>
                ))}
                {extraChipCount > 0 ? (
                  <span className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-muted-foreground">
                    +{extraChipCount} {zh ? '更多' : 'more'}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="relative z-10 mt-6 flex flex-wrap items-center gap-4 pt-2">
            <Button
              onClick={() => triggerActivity(nextActivity)}
              className="h-11 rounded-full px-6 text-sm font-semibold shadow-[0_0_24px_oklch(0.72_0.17_158/0.4)]"
              data-testid="start-best-next-activity"
            >
              {zh ? nextActivity.ctaLabelZh : nextActivity.ctaLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5 text-primary" aria-hidden="true" />
              {zh
                ? `预计耗时 ${nextActivity.estimatedMinutes} 分钟 · 4选1 语境真题题干`
                : `~${nextActivity.estimatedMinutes} min · 4-choice contextual cloze`}
            </span>
          </div>
        </div>

        {/* Right: Diagnostic & Memory Status (5 cols) */}
        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border/80 bg-card p-6 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-primary/14 text-primary">
                <Activity className="size-4" aria-hidden="true" />
              </span>
              <h3 className="font-display text-base font-semibold text-foreground">
                {zh ? '能力诊断与记忆状态' : 'Diagnostic & Memory Status'}
              </h3>
            </div>
            <span className="rounded-full border border-border bg-background/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {proficiency.cefrLevel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/80 bg-background/60 p-3.5">
              <p className="text-xs text-muted-foreground">{zh ? 'FSRS 待复习' : 'Due for Recall'}</p>
              <p className="mt-1.5 font-display text-2xl font-semibold text-foreground" data-testid="srs-due-count">
                {srs.dueNow}
                <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">
                  / {srs.totalTracked} {zh ? '词' : 'words'}
                </span>
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(15, dueProgressPct)}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/60 p-3.5">
              <p className="text-xs text-muted-foreground">{zh ? '7日记忆留存' : '7-Day Retention'}</p>
              <p className="mt-1.5 font-display text-2xl font-semibold text-primary">
                {srs.retention7d !== undefined ? `${srs.retention7d}%` : `${retentionPct}%`}
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(20, retentionPct))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-border/60 bg-background/40 p-3.5 text-xs leading-relaxed">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">
                {zh ? '阅读诊断区间' : 'Reading Band Est.'}
              </span>
              <span className="font-mono text-[11px] font-semibold text-foreground">
                {zh
                  ? `已作答 ${proficiency.questionsAnswered} / 15 题`
                  : `${proficiency.questionsAnswered} / 15 answered`}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {zh ? proficiency.confidenceNoteZh : proficiency.confidenceNote}
            </p>
            <p className="pt-0.5 text-[11px] text-muted-foreground">
              {zh ? '当前优先突破技能：' : 'Priority skill focus: '}
              <button
                type="button"
                onClick={() => navigate('/reading')}
                className="font-medium text-primary underline underline-offset-4 hover:opacity-85"
              >
                {weakSkillLabel}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Band 3: Today's High-Efficiency Study Loop */}
      <div
        className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs"
        data-testid="smart-daily-session"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              {zh ? '今日高效学习闭环' : 'Today’s High-Efficiency Study Loop'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {zh
                ? `已完成 ${dailySession.completedMinutes} / ${dailySession.targetMinutes} 分钟 · 检索 → 习得 → 练习 → 纠错`
                : `${dailySession.completedMinutes} / ${dailySession.targetMinutes} min completed · Recall → Learn → Practice → Remediate`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              <Target className="size-3.5 text-primary" aria-hidden="true" />
              <span>{zh ? '目标：' : 'Goal:'}</span>
              <label htmlFor="target-band-select" className="sr-only">
                {zh ? '目标雅思分数' : 'Target IELTS Band'}
              </label>
              <select
                id="target-band-select"
                aria-label={zh ? '目标雅思分数' : 'Target IELTS Band'}
                disabled={updatingSettings}
                value={profile.targetBand}
                onChange={(e) => handleTargetBandChange(Number(e.target.value))}
                className="bg-transparent font-medium text-foreground outline-none"
                data-testid="target-band-select"
              >
                {[6.0, 6.5, 7.0, 7.5, 8.0, 8.5].map((b) => (
                  <option key={b} value={b} className="bg-card text-foreground">
                    {zh ? `目标 ${b.toFixed(1)} 分` : `Band ${b.toFixed(1)}`}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="inline-flex rounded-full border border-border bg-background/70 p-0.5"
              role="group"
              aria-label={zh ? '每日学习时长' : 'Daily study duration'}
            >
              {[10, 15, 20].map((min) => (
                <button
                  key={min}
                  type="button"
                  disabled={updatingSettings}
                  aria-pressed={profile.dailyMinutes === min}
                  onClick={() => handleMinutesChange(min)}
                  data-testid={`daily-minutes-${min}`}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition',
                    profile.dailyMinutes === min
                      ? 'bg-primary text-primary-foreground shadow-[0_0_14px_oklch(0.72_0.17_158/0.4)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {min}m
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {dailySession.steps.map((step) => {
            const done = step.status === 'completed'
            const isFeatured = step.kind === 'vocab_lesson'
            let footerStatus = zh ? '点击开始' : 'Ready to start'
            if (step.kind === 'srs') {
              footerStatus = done
                ? (zh ? '今日已清空' : 'All due reviewed')
                : (zh ? `待执行 (${step.dueCount ?? srs.dueNow} 词)` : `Pending (${step.dueCount ?? srs.dueNow} due)`)
            } else if (step.kind === 'vocab_lesson') {
              footerStatus = done
                ? (zh ? '今日已完成' : 'Completed today')
                : (zh ? '进行中 · 推荐优先' : 'In progress · Priority')
            } else if (step.kind === 'reading_daily') {
              footerStatus = done
                ? (zh ? '今日挑战已完成' : 'Completed today')
                : (zh ? '5道真题同源段' : '5-question excerpt')
            } else if (step.kind === 'mistakes') {
              footerStatus =
                (step.openMistakes ?? 0) > 0
                  ? (zh ? `${step.openMistakes} 道待攻克词/句` : `${step.openMistakes} open mistakes`)
                  : (zh ? '错题本已清空' : 'No open mistakes')
            }

            return (
              <div
                key={step.id}
                onClick={() => triggerStep(step)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    triggerStep(step)
                  }
                }}
                data-testid={`daily-step-${step.kind}`}
                className={cn(
                  'group flex cursor-pointer flex-col justify-between gap-4 rounded-2xl border p-4 text-left transition',
                  isFeatured
                    ? 'border-primary/40 bg-primary/[0.06] hover:border-primary/60'
                    : 'border-border/80 bg-background/55 hover:border-primary/40 hover:bg-background/80',
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'grid size-7 place-items-center rounded-full text-xs font-semibold',
                        done || isFeatured
                          ? 'bg-primary text-primary-foreground shadow-[0_0_14px_oklch(0.72_0.17_158/0.45)]'
                          : 'border border-border bg-card text-muted-foreground',
                      )}
                    >
                      {done ? <Check className="size-3.5" aria-hidden="true" /> : step.stepNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" aria-hidden="true" />
                      {step.minutes} {zh ? '分钟' : 'min'}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {zh ? step.titleZh : step.title}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {zh ? step.subtitleZh : step.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      step.kind === 'srs' || isFeatured ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {footerStatus}
                  </span>
                  <span
                    className={cn(
                      'grid size-8 place-items-center rounded-full transition',
                      isFeatured
                        ? 'bg-primary text-primary-foreground shadow-[0_0_14px_oklch(0.72_0.17_158/0.45)]'
                        : 'border border-border bg-card text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground',
                    )}
                  >
                    {isFeatured ? (
                      <Play className="size-3.5 fill-current" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
