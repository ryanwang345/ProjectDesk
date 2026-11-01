import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight, Lightbulb, Pencil, Printer, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { LITERATURE_PUZZLES, type LiteraturePuzzle } from '@/lib/literature-puzzles'
import { buildCrossword, cellKey, entryCells, starterCells, type Crossword } from '@/lib/crossword'
import { cn } from '@/lib/utils'
import './literature-puzzles.css'

const layoutCache = new Map<string, Crossword>()
function getPuzzleLayout(puzzle: LiteraturePuzzle): Crossword {
  let grid = layoutCache.get(puzzle.id)
  if (!grid) {
    grid = buildCrossword(puzzle.entries)
    layoutCache.set(puzzle.id, grid)
  }
  return grid
}
const PAGE_SIZE = 12
const totalWordCount = LITERATURE_PUZZLES.reduce((sum, p) => sum + p.entries.length, 0)
const difficultyZh = { Easy: '入门', Medium: '进阶', Challenging: '挑战' }

function PaperGrid({ grid, shown = new Set<string>(), answers = false, print = false }: { grid: Crossword; shown?: Set<string>; answers?: boolean; print?: boolean }) {
  return <svg viewBox={`-1 -1 ${grid.cols * 24 + 2} ${grid.rows * 24 + 2}`} className="mx-auto block h-auto w-full max-w-80" aria-label="Word framework preview" role="img">
    {Object.entries(grid.cells).map(([key, cell]) => {
      const [row, col] = key.split(',').map(Number)
      return <g key={key}>
        <rect
          x={col * 24}
          y={row * 24}
          width="24"
          height="24"
          className={print ? undefined : 'fill-card stroke-border'}
          fill={print ? 'white' : undefined}
          stroke={print ? '#28362d' : undefined}
          strokeWidth={print ? '0.8' : '1'}
        />
        {(answers || shown.has(key)) && (
          <text
            x={col * 24 + 12}
            y={row * 24 + 18}
            textAnchor="middle"
            fontSize="13"
            fontWeight="600"
            className={print ? undefined : 'fill-foreground'}
            fill={print ? '#14291c' : undefined}
          >
            {cell.letter}
          </text>
        )}
      </g>
    })}
  </svg>
}

function WordBank({ puzzle, completed = new Set<string>(), compact = false, print = false }: { puzzle: LiteraturePuzzle; completed?: Set<string>; compact?: boolean; print?: boolean }) {
  const groups = useMemo(() => {
    const grouped = new Map<number, string[]>()
    for (const { answer } of puzzle.entries) grouped.set(answer.length, [...(grouped.get(answer.length) ?? []), answer])
    return [...grouped].sort(([a], [b]) => a - b).map(([length, words]) => [length, words.sort()] as const)
  }, [puzzle])
  return <div className={cn('grid text-left', compact ? 'grid-cols-2 gap-x-4 gap-y-2 text-[8px] leading-tight' : 'grid-cols-2 gap-4 sm:grid-cols-3')}>
    {groups.map(([length, words]) => <section key={length}>
      <h3 className={cn('font-bold', print ? 'text-[#14291c]' : 'text-foreground', compact ? 'mb-1' : 'mb-2 text-sm')}>{length} {length === 1 ? 'Letter' : 'Letters'}</h3>
      <ul className={cn(compact ? 'space-y-0.5' : 'space-y-1 text-sm')}>
        {words.map((word) => <li key={word} data-word={word} className={cn('tracking-wide', completed.has(word) ? 'text-muted-foreground line-through decoration-2' : print ? 'text-[#25362b]' : 'text-foreground')}>{compact ? word.toLowerCase() : word}</li>)}
      </ul>
    </section>)}
  </div>
}

function getPageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('ellipsis')
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total - 1) pages.push('ellipsis')
  pages.push(total)
  return pages
}

export function LiteraturePuzzlesPage() {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState('All')
  const [page, setPage] = useState(1)
  const selected = LITERATURE_PUZZLES.find((puzzle) => puzzle.id === params.get('puzzle'))
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LITERATURE_PUZZLES.filter((puzzle) => `${puzzle.title} ${puzzle.author}`.toLowerCase().includes(q) && (difficulty === 'All' || puzzle.difficulty === difficulty))
  }, [query, difficulty])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const paginated = useMemo(() => filtered.slice(startIndex, startIndex + PAGE_SIZE), [filtered, startIndex])
  const pageNumbers = useMemo(() => getPageNumbers(currentPage, totalPages), [currentPage, totalPages])

  function goToPage(nextPage: number) {
    setPage(Math.max(1, Math.min(totalPages, nextPage)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (selected) return <PuzzlePlayer key={selected.id} puzzle={selected} grid={getPuzzleLayout(selected)} onBack={() => setParams({})} />
  if (params.has('puzzle')) return <div className="space-y-4 rounded-3xl border border-border bg-card p-8"><h1 className="font-display text-2xl">{zh ? '未找到这个谜题' : 'Puzzle not found'}</h1><Button onClick={() => setParams({})}>{zh ? '返回谜题库' : 'Back to the collection'}</Button></div>
  return <div className="mx-auto max-w-6xl space-y-6" data-testid="puzzle-library">
    <header className="space-y-3 py-2">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary"><BookOpen className="size-4" />{zh ? '观察 · 拼写 · 连接' : 'Look · Spell · Connect'}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{zh ? '经典文学单词框架谜题' : 'Classic Literature Word Frameworks'}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{zh ? '把词库中的文学单词填入相互交错的框架。根据单词长度和给出的字母，找出每个单词的位置。可在线完成或打印练习。' : 'Fit every literature word into the interlocking framework. Use word lengths and the starter letters to discover where each word belongs, then solve online or print a worksheet.'}</p>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="rounded-full border border-border bg-card px-3 py-1.5">{LITERATURE_PUZZLES.length} {zh ? '部经典' : 'classic books'}</span><span className="rounded-full border border-border bg-card px-3 py-1.5">{totalWordCount} {zh ? '个文学单词' : 'literature words'}</span><span className="rounded-full border border-border bg-card px-3 py-1.5">{zh ? '可打印 · 无需 API' : 'Print-friendly · No API needed'}</span></div>
    </header>
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center">
      <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5"><Search className="size-4 text-muted-foreground" aria-hidden="true" /><span className="sr-only">{zh ? '搜索书名或作者' : 'Search books or authors'}</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={zh ? '搜索书名或作者…' : 'Search a book or author…'} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">{zh ? '难度' : 'Difficulty'}<select value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1) }} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground">{['All', 'Easy', 'Medium', 'Challenging'].map((value) => <option key={value} value={value}>{zh ? (value === 'All' ? '全部' : difficultyZh[value as keyof typeof difficultyZh]) : value}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
      <span>{filtered.length} {zh ? '个谜题' : 'puzzles in this collection'}</span>
      {filtered.length > 0 && (
        <span>
          {zh
            ? `第 ${startIndex + 1}–${Math.min(startIndex + PAGE_SIZE, filtered.length)} 个 · 第 ${currentPage}/${totalPages} 页`
            : `Showing ${startIndex + 1}–${Math.min(startIndex + PAGE_SIZE, filtered.length)} · Page ${currentPage} of ${totalPages}`}
        </span>
      )}
    </div>
    <div className="space-y-5">
      {paginated.map((puzzle) => <PuzzleCard key={puzzle.id} puzzle={puzzle} grid={getPuzzleLayout(puzzle)} />)}
      {filtered.length === 0 && <div className="rounded-3xl border border-dashed border-border p-10 text-center"><p className="text-muted-foreground">{zh ? '没有匹配的谜题。尝试其他书名或难度。' : 'No matching puzzles. Try another title or difficulty.'}</p><Button variant="outline" className="mt-4" onClick={() => { setQuery(''); setDifficulty('All'); setPage(1) }}>{zh ? '清除筛选' : 'Clear filters'}</Button></div>}
    </div>
    {totalPages > 1 && (
      <nav aria-label={zh ? '谜题分页' : 'Puzzle pagination'} className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
        <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="gap-1">
          <ChevronLeft className="size-4" />
          <span>{zh ? '上一页' : 'Previous'}</span>
        </Button>
        {pageNumbers.map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-xs text-muted-foreground" aria-hidden="true">
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === currentPage ? 'default' : 'outline'}
              size="sm"
              onClick={() => goToPage(item)}
              aria-current={item === currentPage ? 'page' : undefined}
              className="min-w-9"
            >
              {item}
            </Button>
          ),
        )}
        <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} className="gap-1">
          <span>{zh ? '下一页' : 'Next'}</span>
          <ChevronRight className="size-4" />
        </Button>
      </nav>
    )}
  </div>
}

function PuzzleCard({ puzzle, grid }: { puzzle: LiteraturePuzzle; grid: Crossword }) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const starters = starterCells(grid, puzzle.id)
  return <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-xs" data-testid={`puzzle-card-${puzzle.id}`}>
    <div className="grid md:grid-cols-[minmax(260px,0.9fr)_1.1fr]">
      <Link to={`?puzzle=${puzzle.id}`} aria-label={`${zh ? '打开' : 'Open'} ${puzzle.title}`} className="flex items-center justify-center border-b border-border bg-muted/35 p-5 transition hover:bg-muted/55 md:border-r md:border-b-0">
        <div className="w-full max-w-80 space-y-3 rounded-2xl border border-border/80 bg-background/95 p-4 text-foreground shadow-sm" aria-hidden="true"><p className="font-semibold text-primary">{puzzle.title} word puzzle</p><p className="text-[9px] text-muted-foreground">Fill the words in the framework.</p><PaperGrid grid={grid} shown={starters} /><WordBank puzzle={puzzle} compact /></div>
      </Link>
      <div className="flex flex-col items-start justify-center gap-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{zh ? difficultyZh[puzzle.difficulty] : puzzle.difficulty}</span><span>{puzzle.year}</span><span>·</span><span>8 {zh ? '个单词' : 'words'}</span></div>
        <div><h2 className="font-display text-2xl leading-tight text-primary sm:text-3xl">{puzzle.title}</h2><p className="mt-2 text-sm text-muted-foreground">{puzzle.author}</p></div>
        <p className="text-sm leading-relaxed text-muted-foreground">{puzzle.description}</p>
        <p className="border-l-2 border-primary/30 pl-3 text-sm leading-relaxed text-foreground/85">{zh ? '根据长度和提示字母，把 8 个单词全部放入框架。' : 'Use the lengths and starter letters to fit all 8 words into the framework.'}</p>
        <Button asChild className="mt-1 min-h-12 w-full rounded-xl text-sm"><Link to={`?puzzle=${puzzle.id}`}><Pencil className="size-4" />{zh ? '开始单词谜题' : 'Start word puzzle'}</Link></Button>
      </div>
    </div>
  </article>
}

type SavedPuzzle = { letters: Record<string, string>; hints: number }
function seedLetters(grid: Crossword, starters: Set<string>) {
  return Object.fromEntries([...starters].map((key) => [key, grid.cells[key].letter]))
}
function readProgress(id: string, grid: Crossword, starters: Set<string>): SavedPuzzle {
  const fixed = seedLetters(grid, starters)
  try {
    const saved = JSON.parse(localStorage.getItem(`projectdesk.wordframe.v1.${id}`) ?? '{}')
    const letters = Object.fromEntries(Object.entries(saved.letters ?? {}).filter(([key, letter]) => grid.cells[key] && typeof letter === 'string' && /^[A-Z]$/.test(letter))) as Record<string, string>
    return { letters: { ...letters, ...fixed }, hints: Number.isInteger(saved.hints) && saved.hints >= 0 ? saved.hints : 0 }
  } catch { return { letters: fixed, hints: 0 } }
}

function PuzzlePlayer({ puzzle, grid, onBack }: { puzzle: LiteraturePuzzle; grid: Crossword; onBack: () => void }) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const starters = useMemo(() => starterCells(grid, puzzle.id), [grid, puzzle.id])
  const [progress, setProgress] = useState(() => readProgress(puzzle.id, grid, starters))
  const [selected, setSelected] = useState(0)
  const selectedRef = useRef(0)
  function selectEntry(index: number) { selectedRef.current = index; setSelected(index) }
  const [checked, setChecked] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [customize, setCustomize] = useState(false)
  const [title, setTitle] = useState(`${puzzle.title} word puzzle`)
  const [printStarters, setPrintStarters] = useState(true)
  const [answerKey, setAnswerKey] = useState(false)
  const refs = useRef<Record<string, HTMLInputElement | null>>({})
  const active = grid.entries[selected]
  const activeCells = entryCells(active)
  const { letters } = progress
  const allKeys = Object.keys(grid.cells)
  const editableKeys = allKeys.filter((key) => !starters.has(key))
  const filled = editableKeys.filter((key) => letters[key]).length
  const incorrect = editableKeys.filter((key) => letters[key] && letters[key] !== grid.cells[key].letter)
  const complete = allKeys.every((key) => letters[key] === grid.cells[key].letter)
  const completedWords = new Set(grid.entries.filter((entry) => entryCells(entry).every((key) => letters[key] === grid.cells[key].letter)).map((entry) => entry.answer))
  useEffect(() => {
    try { localStorage.setItem(`projectdesk.wordframe.v1.${puzzle.id}`, JSON.stringify(progress)); setSaveError(false) }
    catch { setSaveError(true) }
  }, [progress, puzzle.id])
  function chooseCell(key: string, toggle = false) {
    const candidates = grid.entries.map((entry, index) => ({ index, keys: entryCells(entry) })).filter(({ keys }) => keys.includes(key))
    if (!entryCells(grid.entries[selectedRef.current]).includes(key) || toggle) selectEntry((toggle ? candidates.find(({ index }) => index !== selectedRef.current) : candidates[0])?.index ?? selectedRef.current)
  }
  function write(key: string, value: string) {
    const text = value.toUpperCase().replace(/[^A-Z]/g, '')
    if (!text || starters.has(key)) return
    const selectedEntry = grid.entries[selectedRef.current]
    const entry = entryCells(selectedEntry).includes(key) ? selectedEntry : grid.entries.find((candidate) => entryCells(candidate).includes(key))!
    const keys = entryCells(entry)
    const start = text.length === keys.length ? 0 : keys.indexOf(key)
    const next = { ...letters }
    ;[...text].slice(0, keys.length - start).forEach((letter, index) => {
      const target = keys[start + index]
      if (!starters.has(target)) next[target] = letter
    })
    setProgress({ ...progress, letters: next }); setChecked(false)
    const nextKey = keys.slice(start + Math.max(1, text.length)).find((candidate) => !starters.has(candidate))
    if (nextKey) refs.current[nextKey]?.focus()
  }
  function clearCell(key: string) {
    if (starters.has(key)) return
    const next = { ...letters }; delete next[key]
    setProgress({ ...progress, letters: next }); setChecked(false)
  }
  function hint() {
    const key = activeCells.find((candidate) => !starters.has(candidate) && letters[candidate] !== grid.cells[candidate].letter)
    if (key) { setProgress({ letters: { ...letters, [key]: grid.cells[key].letter }, hints: progress.hints + 1 }); setChecked(false); refs.current[key]?.focus() }
  }
  function reset() {
    if (window.confirm(zh ? '清除这个谜题的所有进度？提示字母会保留。' : 'Clear your progress? Starter letters will remain.')) {
      setProgress({ letters: seedLetters(grid, starters), hints: 0 }); setChecked(false)
    }
  }
  return <div className="mx-auto max-w-6xl space-y-5" data-testid="puzzle-player">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="size-4" />{zh ? '所有文学谜题' : 'All literature puzzles'}</button>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{puzzle.author} · {puzzle.year}</p><h1 className="font-display text-3xl font-semibold text-primary">{title || `${puzzle.title} word puzzle`}</h1><p className="mt-2 text-sm text-muted-foreground">{zh ? '把词库中的单词填入框架。' : 'Fill the words in the framework.'}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setCustomize(!customize)} aria-expanded={customize}><SlidersHorizontal className="size-4" />{zh ? '自定义' : 'Customize'}</Button><Button onClick={() => window.print()}><Printer className="size-4" />{zh ? '打印' : 'Print'}</Button></div></header>
    {customize && <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-card p-4 text-sm"><label className="flex min-w-0 flex-1 flex-col gap-1">{zh ? '打印标题' : 'Worksheet title'}<input maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 rounded-lg border border-border bg-background p-2" /></label><label className="flex items-center gap-2"><input type="checkbox" checked={printStarters} onChange={(event) => setPrintStarters(event.target.checked)} />{zh ? '打印提示字母' : 'Print starter letters'}</label><label className="flex items-center gap-2"><input type="checkbox" checked={answerKey} onChange={(event) => setAnswerKey(event.target.checked)} />{zh ? '打印答案页' : 'Print answer key'}</label></div>}
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>{filled}/{editableKeys.length} {zh ? '格已填写' : 'open cells filled'}</span><span>{progress.hints} {zh ? '次字母提示' : 'letter hints used'}</span><span>{saveError ? (zh ? '无法保存进度' : 'Progress could not be saved') : (zh ? '进度保存在此浏览器' : 'Progress saved in this browser')}</span></div>
    {complete && <p role="status" className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-primary"><Check className="size-5" />{zh ? '完成了！所有单词均正确。' : 'Puzzle complete! Every word is correct.'}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="min-w-0 space-y-4 rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="rounded-xl bg-primary/10 p-3 text-sm leading-relaxed" aria-live="polite"><strong>{zh ? '已选择：' : 'Selected slot:'}</strong> {active.answer.length} {zh ? `个字母 · ${active.direction === 'across' ? '横向' : '纵向'}` : `letters · ${active.direction}`}</div>
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-muted/25 p-3 sm:p-4" data-testid="crossword-grid">
          <div className="mx-auto grid w-full max-w-xl" style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(23px, 1fr))`, minWidth: grid.cols * 23 }}>
            {Array.from({ length: grid.rows * grid.cols }, (_, index) => {
              const row = Math.floor(index / grid.cols), col = index % grid.cols, key = cellKey(row, col), cell = grid.cells[key]
              if (!cell) return <div key={key} className="aspect-square" />
              const invalid = checked && incorrect.includes(key)
              const fixed = starters.has(key)
              return <div key={key} className={cn('relative aspect-square border border-border/90 bg-background', activeCells.includes(key) && 'border-primary/40 bg-primary/15', fixed && (activeCells.includes(key) ? 'bg-primary/20' : 'bg-muted/80'), invalid && 'outline-2 -outline-offset-2 outline-destructive')}>
                <input ref={(element) => { refs.current[key] = element }} data-cell={key} data-starter={fixed || undefined} value={letters[key] ?? ''} readOnly={fixed} aria-label={`${fixed ? 'Starter letter, ' : ''}row ${row + 1}, column ${col + 1}`} aria-invalid={invalid} autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text"
                  onFocus={(event) => { chooseCell(key); event.target.select() }} onDoubleClick={() => chooseCell(key, true)}
                  onChange={(event) => { if (!event.target.value) clearCell(key); else write(key, event.target.value.slice(-1)) }}
                  onPaste={(event) => { event.preventDefault(); write(key, event.clipboardData.getData('text')) }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); chooseCell(key, true) }
                    if (event.key === 'Backspace') { event.preventDefault(); const position = activeCells.indexOf(key); const previous = [...activeCells.slice(0, position)].reverse().find((candidate) => !starters.has(candidate)); if (letters[key] && !fixed) clearCell(key); else if (previous) { clearCell(previous); refs.current[previous]?.focus() } }
                    if (event.key.startsWith('Arrow')) {
                      event.preventDefault()
                      const dr = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
                      const dc = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
                      const next = cellKey(row + dr, col + dc)
                      if (grid.cells[next]) { const entryIndex = grid.entries.findIndex((candidate) => candidate.direction === (dr ? 'down' : 'across') && entryCells(candidate).includes(next)); if (entryIndex >= 0) selectEntry(entryIndex); refs.current[next]?.focus() }
                    }
                  }} className={cn('h-full w-full bg-transparent text-center font-mono text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:text-lg', fixed && 'cursor-default font-bold text-primary')} />
              </div>
            })}
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{zh ? '点击一个格子选择横向或纵向单词，然后输入字母。双击交叉格或按 Enter 可切换方向。浅色格中的字母是固定提示。' : 'Click a cell to select an across or down word, then type. Double-click a crossing or press Enter to switch direction. Letters in shaded cells are fixed starters.'}</p>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setChecked(true)}><Check className="size-4" />{zh ? '检查答案' : 'Check answers'}</Button><Button variant="outline" onClick={hint} disabled={activeCells.every((key) => starters.has(key) || letters[key] === grid.cells[key].letter)}><Lightbulb className="size-4" />{zh ? '提示一个字母' : 'Reveal a letter'}</Button><Button variant="ghost" onClick={reset}><RotateCcw className="size-4" />{zh ? '重置' : 'Reset'}</Button></div>
        {checked && !complete && <p role="status" className="text-sm text-muted-foreground">{zh ? `${incorrect.length} 格不正确，${editableKeys.length - filled} 格尚未填写。` : `${incorrect.length} incorrect cells; ${editableKeys.length - filled} still empty.`}</p>}
      </section>
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{zh ? '词库' : 'Word bank'}</p><h2 className="mt-1 font-display text-2xl text-primary">{zh ? '按字母数分类' : 'Grouped by length'}</h2></div><WordBank puzzle={puzzle} completed={completedWords} /><p className="mt-6 text-xs leading-relaxed text-muted-foreground">{zh ? '完成一个单词后，它会自动划掉。' : 'A word is crossed out when it is correctly placed.'}</p></section>
    </div>
    <a href={`https://www.gutenberg.org/ebooks/${puzzle.bookId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4">{zh ? '阅读原著 · Project Gutenberg' : 'Explore the book · Project Gutenberg'}<ArrowUpRight className="size-3" /></a>
    {createPortal(<div className="literature-print"><h1>{title || `${puzzle.title} word puzzle`}</h1><p>{puzzle.author} · {puzzle.year}</p><p className="print-instruction">Fill the words in the framework.</p><p className="print-name">Name: __________________________ Date: ______________</p><PaperGrid grid={grid} shown={printStarters ? starters : new Set()} print /><WordBank puzzle={puzzle} print /><p className="print-credit">LinguaDesk · Literature word framework · {puzzle.entries.length} words</p>{answerKey && <div className="print-answer-key"><h1>{title || puzzle.title} — Answer key</h1><PaperGrid grid={grid} answers print /><WordBank puzzle={puzzle} print /></div>}</div>, document.body)}
  </div>
}
