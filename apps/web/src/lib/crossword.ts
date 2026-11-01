export type Entry = { answer: string; clue: string }
export type PlacedEntry = Entry & { row: number; col: number; direction: 'across' | 'down'; number: number }
export type Crossword = { rows: number; cols: number; entries: PlacedEntry[]; cells: Record<string, { letter: string; number?: number }> }
export const cellKey = (row: number, col: number) => `${row},${col}`
export function entryCells(entry: PlacedEntry) {
  return [...entry.answer].map((_, i) => cellKey(entry.row + (entry.direction === 'down' ? i : 0), entry.col + (entry.direction === 'across' ? i : 0)))
}

// Pick a small, repeatable set of fixed letters for fill-in-the-framework puzzles.
// Sampling across entries keeps the hints spread around the grid.
export function starterCells(grid: Crossword, seed: string) {
  const result = new Set<string>()
  const target = Math.min(6, Math.max(4, Math.ceil(grid.entries.length * 0.65)))
  const hash = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
  for (let step = 0; result.size < target && step < grid.entries.length * 4; step++) {
    const entry = grid.entries[(hash + step * 5) % grid.entries.length]
    const keys = entryCells(entry)
    const innerLength = Math.max(1, keys.length - 2)
    result.add(keys[Math.min(keys.length - 1, 1 + ((hash + step * 7) % innerLength))])
  }
  return result
}

// Deterministic interlocking layouts. Every new word crosses an existing one;
// parallel touches and accidental extra words are rejected.
export function buildCrossword(entries: Entry[]): Crossword {
  let best: PlacedEntry[] = []
  for (let attempt = 0; attempt < 48; attempt++) {
    const sorted = [...entries].sort((a, b) => b.answer.length - a.answer.length)
    const first = sorted.splice(attempt % sorted.length, 1)[0]
    const pending = [first, ...sorted]
    const placed: PlacedEntry[] = []
    const cells = new Map<string, { letter: string; dirs: Set<string> }>()
    function place(entry: PlacedEntry) {
      placed.push(entry)
      entryCells(entry).forEach((key, i) => {
        const cell = cells.get(key) ?? { letter: entry.answer[i], dirs: new Set<string>() }
        cell.dirs.add(entry.direction)
        cells.set(key, cell)
      })
    }
    place({ ...pending.shift()!, row: 0, col: 0, direction: attempt % 2 ? 'down' : 'across', number: 0 })
    for (let pass = 0; pass < entries.length && pending.length; pass++) {
      for (let p = 0; p < pending.length; p++) {
        const entry = pending[p]
        let candidate: PlacedEntry | null = null
        let bestScore = Infinity
        for (const [key, cell] of cells) {
          const [r, c] = key.split(',').map(Number)
          for (const direction of ['across', 'down'] as const) {
            if (cell.dirs.has(direction)) continue
            for (let i = 0; i < entry.answer.length; i++) {
              if (entry.answer[i] !== cell.letter) continue
              const dr = direction === 'down' ? 1 : 0
              const dc = 1 - dr
              const row = r - dr * i, col = c - dc * i
              if (cells.has(cellKey(row - dr, col - dc)) || cells.has(cellKey(row + dr * entry.answer.length, col + dc * entry.answer.length))) continue
              let valid = true, crossings = 0
              for (let j = 0; j < entry.answer.length; j++) {
                const rr = row + dr * j, cc = col + dc * j
                const existing = cells.get(cellKey(rr, cc))
                if (existing) {
                  if (existing.letter !== entry.answer[j] || existing.dirs.has(direction)) { valid = false; break }
                  crossings++
                } else if (cells.has(cellKey(rr + dc, cc + dr)) || cells.has(cellKey(rr - dc, cc - dr))) { valid = false; break }
              }
              if (!valid) continue
              const points = [...cells.keys()].map((k) => k.split(',').map(Number))
              points.push([row, col], [row + dr * (entry.answer.length - 1), col + dc * (entry.answer.length - 1)])
              const height = Math.max(...points.map(([rr]) => rr)) - Math.min(...points.map(([rr]) => rr)) + 1
              const width = Math.max(...points.map(([, cc]) => cc)) - Math.min(...points.map(([, cc]) => cc)) + 1
              if (height > 25 || width > 25) continue
              const score = height * width + Math.abs(height - width) * 4 - crossings * 15
              if (score < bestScore) { bestScore = score; candidate = { ...entry, row, col, direction, number: 0 } }
            }
          }
        }
        if (candidate) { place(candidate); pending.splice(p--, 1) }
      }
    }
    if (placed.length > best.length) best = placed
    if (placed.length === entries.length) break
  }
  if (best.length !== entries.length) throw new Error('Could not place all crossword entries')
  const minRow = Math.min(...best.map((e) => e.row)), minCol = Math.min(...best.map((e) => e.col))
  best = best.map((e) => ({ ...e, row: e.row - minRow, col: e.col - minCol })).sort((a, b) => a.row - b.row || a.col - b.col)
  let number = 0, previous = ''
  const cells: Crossword['cells'] = {}
  for (const entry of best) {
    const start = cellKey(entry.row, entry.col)
    if (start !== previous) number++
    entry.number = number
    previous = start
    entryCells(entry).forEach((key, i) => { cells[key] = { ...cells[key], letter: entry.answer[i] } })
    cells[start].number = number
  }
  const coords = Object.keys(cells).map((key) => key.split(',').map(Number))
  return { rows: Math.max(...coords.map(([r]) => r)) + 1, cols: Math.max(...coords.map(([, c]) => c)) + 1, entries: best, cells }
}
