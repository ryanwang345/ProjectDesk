import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useI18n } from '@/i18n'
import { THEMES, type Theme } from '@/lib/themes'
import { useTheme } from '@/theme'

function Swatch({ colors }: { colors: Theme['colors'] }) {
  const slice = 100 / colors.length
  const stops = colors.map((color, index) => `${color} ${index * slice}% ${(index + 1) * slice}%`).join(', ')
  return <span className="size-5 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops})` }} aria-hidden="true" />
}

export function ThemePicker({ showName = false }: { showName?: boolean }) {
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const current = THEMES.find((item) => item.id === theme) ?? THEMES[0]

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(id: Theme['id']) {
    setTheme(id)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card text-sm shadow-sm ${showName ? 'max-w-56 px-2.5' : 'px-2'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('theme.menu')}
        onClick={() => setOpen((value) => !value)}
      >
        <Swatch colors={current.colors} />
        {showName ? <span className="hidden max-w-40 truncate sm:inline">{current.name}</span> : null}
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label={t('theme.menu')}
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-zinc-900 p-1.5 text-zinc-100 shadow-2xl"
        >
          {THEMES.map((item) => (
            <ThemeRow key={item.id} item={item} selected={item.id === theme} onChoose={choose} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ThemeRow({
  item,
  selected,
  onChoose,
}: {
  item: Theme
  selected: boolean
  onChoose: (id: Theme['id']) => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`flex w-full items-center gap-3 rounded-full px-2.5 py-2 text-left text-sm ${selected ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`}
      onClick={() => onChoose(item.id)}
    >
      <Swatch colors={item.colors} />
      <span>{item.name}</span>
    </button>
  )
}
