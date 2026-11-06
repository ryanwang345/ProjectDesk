import { cn } from '@/lib/utils'
import { STAGES, STAGE_META, type Stage } from '@/lib/loop'

const stageColor: Record<Stage, string> = {
  discover: 'bg-[oklch(0.55_0.12_250)] text-white',
  deliver: 'bg-[oklch(0.52_0.14_310)] text-white',
  validate: 'bg-[oklch(0.48_0.11_155)] text-white',
  rediscover: 'bg-[oklch(0.62_0.14_70)] text-white',
}

const stageStroke: Record<Stage, string> = {
  discover: 'oklch(0.55 0.12 250)',
  deliver: 'oklch(0.52 0.14 310)',
  validate: 'oklch(0.48 0.11 155)',
  rediscover: 'oklch(0.62 0.14 70)',
}

const ringRadius = 62
const ringLength = 2 * Math.PI * ringRadius
const ringQuarter = ringLength / 4
const ringGap = 16

type LoopRingProps = {
  stage: Stage | null
  hoursLabel: string
  detail: string
  onStage: (stage: Stage) => void
}

export function LoopRing({ stage, hoursLabel, detail, onStage }: LoopRingProps) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[22rem]">
      <svg viewBox="0 0 200 200" className="size-full" aria-hidden="true">
        <circle cx="100" cy="100" r={ringRadius} fill="none" stroke="oklch(0.92 0.01 90)" strokeWidth="14" />
        {STAGES.map((item, index) => (
          <circle
            key={item}
            cx="100"
            cy="100"
            r={ringRadius}
            fill="none"
            stroke={stageStroke[item]}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${ringQuarter - ringGap} ${ringLength - (ringQuarter - ringGap)}`}
            strokeDashoffset={-index * ringQuarter}
            opacity={stage === null || stage === item ? 1 : 0.4}
            transform="rotate(-90 100 100)"
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="max-w-28 text-center">
          <p className="font-display text-3xl tracking-tight">7×24</p>
          <p className="text-xs text-muted-foreground">{hoursLabel}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{detail}</p>
        </div>
      </div>
      {STAGES.map((item, index) => {
        const angle = (-Math.PI / 2) + index * (Math.PI / 2)
        const left = 50 + Math.cos(angle) * 46
        const top = 50 + Math.sin(angle) * 46
        const active = stage === item
        return (
          <button
            key={item}
            type="button"
            aria-pressed={active}
            onClick={() => onStage(item)}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-sm',
              active && stageColor[item],
              active && 'border-transparent',
            )}
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            {STAGE_META[item].label}
          </button>
        )
      })}
    </div>
  )
}
