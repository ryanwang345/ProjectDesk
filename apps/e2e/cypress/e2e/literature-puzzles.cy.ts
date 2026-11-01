import { LITERATURE_PUZZLES } from '../../../web/src/lib/literature-puzzles'
import { buildCrossword, cellKey, entryCells, starterCells } from '../../../web/src/lib/crossword'

function openPuzzles(query = '', locale = 'en') {
  cy.visit(`/puzzles${query}`, { onBeforeLoad(win) {
    win.localStorage.setItem('projectdesk.locale', locale)
    win.localStorage.removeItem('projectdesk.features.v1')
  } })
}
function paste(text: string) {
  cy.focused().trigger('paste', { clipboardData: { getData: () => text } })
}

describe('Literature word frameworks', { tags: '@regression' }, () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/english', { body: [] })
    cy.intercept('GET', '/api/learning/progress*', { body: { xp: 0, streak: 0, completed: [], weekly: [], legacyImported: true } })
  })

  it('provides twelve valid connected grids with no unintended letter runs', () => {
    expect(LITERATURE_PUZZLES).to.have.length(12)
    for (const puzzle of LITERATURE_PUZZLES) {
      const grid = buildCrossword(puzzle.entries)
      const starters = starterCells(grid, puzzle.id)
      expect(grid.entries.length, puzzle.id).to.eq(puzzle.entries.length)
      expect(new Set(grid.entries.map((e) => e.answer)).size).to.eq(puzzle.entries.length)
      expect(starters.size, `${puzzle.id} starter letters`).to.be.within(4, 6)
      for (const key of starters) expect(grid.cells[key], `${puzzle.id} starter ${key}`).to.exist
      const visited = new Set<string>()
      const pending = [Object.keys(grid.cells)[0]]
      while (pending.length) {
        const key = pending.pop()!
        if (visited.has(key)) continue
        visited.add(key)
        const [r, c] = key.split(',').map(Number)
        for (const next of [cellKey(r - 1, c), cellKey(r + 1, c), cellKey(r, c - 1), cellKey(r, c + 1)]) if (grid.cells[next] && !visited.has(next)) pending.push(next)
      }
      expect(visited.size, `${puzzle.id} connected`).to.eq(Object.keys(grid.cells).length)
      for (const entry of grid.entries) {
        expect(entry.answer).to.match(/^[A-Z]+$/)
        expect(entryCells(entry).map((key) => grid.cells[key].letter).join('')).to.eq(entry.answer)
        expect(grid.cells[cellKey(entry.row, entry.col)].number).to.eq(entry.number)
      }
      for (const key of Object.keys(grid.cells)) {
        const [r, c] = key.split(',').map(Number)
        for (const direction of ['across', 'down'] as const) {
          const dr = direction === 'down' ? 1 : 0, dc = 1 - dr
          if (grid.cells[cellKey(r - dr, c - dc)]) continue
          let run = '', i = 0
          while (grid.cells[cellKey(r + dr * i, c + dc * i)]) {
            run += grid.cells[cellKey(r + dr * i, c + dc * i)].letter
            i += 1
          }
          if (run.length > 1) expect(grid.entries.some((e) => e.row === r && e.col === c && e.direction === direction && e.answer === run), `${puzzle.id}: unexpected run ${run}`).to.eq(true)
        }
      }
    }
  })

  it('shows worksheet-style frameworks and word banks, then filters the collection', () => {
    openPuzzles()
    cy.get('[data-testid^="puzzle-card-"]').should('have.length', 12)
    cy.get('[data-testid="puzzle-card-alice"]').within(() => {
      cy.contains('Fill the words in the framework.').should('be.visible')
      cy.contains('5 Letters').should('be.visible')
      cy.get('[data-word="ALICE"]').should('exist')
      cy.contains('8 words').should('be.visible')
    })
    cy.get('input[placeholder="Search a book or author…"]').type('Austen')
    cy.get('[data-testid^="puzzle-card-"]').should('have.length', 1).and('contain', 'Pride and Prejudice')
    cy.get('main select').select('Easy')
    cy.contains('No matching puzzles').should('be.visible')
    cy.contains('button', 'Clear filters').click()
    cy.get('[data-testid^="puzzle-card-"]').should('have.length', 12)
    cy.screenshot('literature-library-desktop', { capture: 'viewport' })
  })

  it('uses fixed starter letters, saves progress, crosses off words and completes a puzzle', () => {
    openPuzzles('?puzzle=alice')
    const grid = buildCrossword(LITERATURE_PUZZLES[0].entries)
    const starters = starterCells(grid, 'alice')
    const alice = grid.entries.find((entry) => entry.answer === 'ALICE')!
    const aliceCell = entryCells(alice).find((key) => !starters.has(key))!
    cy.get(`input[data-cell="${aliceCell}"]`).focus()
    paste('ZZZZZ')
    cy.contains('button', 'Check answers').click()
    cy.get('input[aria-invalid="true"]').should('have.length.greaterThan', 0)
    cy.reload()
    cy.get('input[data-cell]').filter((_, el) => (el as HTMLInputElement).value === 'Z').should('have.length.greaterThan', 0)
    for (const entry of grid.entries) {
      const keys = entryCells(entry)
      const uniqueEditable = keys.find((key) => !starters.has(key) && grid.entries.filter((candidate) => entryCells(candidate).includes(key)).length === 1)
      const editable = uniqueEditable ?? keys.find((key) => !starters.has(key))!
      cy.get(`input[data-cell="${editable}"]`).focus()
      paste(entry.answer.toLowerCase())
    }
    cy.get('[data-word="ALICE"]').should('have.class', 'line-through')
    cy.contains('Puzzle complete! Every word is correct.').should('be.visible')
    cy.contains('button', 'Check answers').click()
    cy.get('input[aria-invalid="true"]').should('not.exist')
    cy.reload()
    cy.contains('Puzzle complete!').should('be.visible')
    cy.screenshot('literature-solved-desktop', { capture: 'viewport' })
  })

  it('reveals one letter, customizes the printable worksheet and resets only this puzzle', () => {
    openPuzzles('?puzzle=hamlet')
    const grid = buildCrossword(LITERATURE_PUZZLES.find((puzzle) => puzzle.id === 'hamlet')!.entries)
    const starters = starterCells(grid, 'hamlet')
    cy.contains('button', 'Reveal a letter').click()
    cy.contains('1 letter hints used').should('be.visible')
    cy.get('input[data-cell]').filter((_, el) => Boolean((el as HTMLInputElement).value)).should('have.length', starters.size + 1)
    cy.get('input[data-starter="true"]').should('have.length', starters.size).and('have.attr', 'readonly')
    cy.contains('button', 'Customize').click()
    cy.contains('label', 'Worksheet title').find('input').clear().type('My Hamlet word puzzle')
    cy.contains('label', 'Print answer key').find('input').check()
    cy.get('.literature-print').should('not.be.visible').and('contain', 'My Hamlet word puzzle').and('contain', 'Fill the words in the framework.').and('contain', 'Answer key')
    cy.window().then((win) => {
      cy.stub(win, 'print').as('print')
      const confirm = cy.stub(win, 'confirm')
      confirm.onFirstCall().returns(false)
      confirm.onSecondCall().returns(true)
      cy.wrap(confirm).as('confirm')
    })
    cy.contains('button', /^Print$/).click()
    cy.get('@print').should('have.been.calledOnce')
    cy.contains('button', 'Reset').click()
    cy.contains('1 letter hints used').should('exist')
    cy.contains('button', 'Reset').click()
    cy.get('@confirm').should('have.been.calledTwice')
    cy.get('input[data-cell]:not([data-starter])').each(($input) => expect($input.val()).to.eq(''))
    cy.get('input[data-starter="true"]').each(($input) => expect($input.val()).to.match(/^[A-Z]$/))
  })

  it('supports a narrow Chinese mobile layout and handles missing puzzles', () => {
    cy.viewport('iphone-x')
    openPuzzles('?puzzle=pride-prejudice', 'zh')
    cy.get('[data-testid="puzzle-player"]').should('be.visible')
    const puzzle = LITERATURE_PUZZLES.find((item) => item.id === 'pride-prejudice')!
    const grid = buildCrossword(puzzle.entries)
    const starters = starterCells(grid, puzzle.id)
    const darcy = grid.entries.find((entry) => entry.answer === 'DARCY')!
    const editable = entryCells(darcy).find((key) => !starters.has(key) && grid.entries.filter((candidate) => entryCells(candidate).includes(key)).length === 1)!
    cy.get(`input[data-cell="${editable}"]`).focus()
    paste('DARCY')
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth + 1))
    cy.screenshot('literature-player-mobile', { capture: 'viewport' })
    openPuzzles('?puzzle=not-a-book')
    cy.contains('Puzzle not found').should('be.visible')
    cy.contains('button', 'Back to the collection').click()
    cy.get('[data-testid="puzzle-library"]').should('be.visible')
  })
})
