import type { EnglishCard } from '../../../web/src/lib/english'

type WorldEntry = { word: string; meaning: string; kind: string; definition: string; examples: string[] }

function openLibrary(locale: 'en' | 'zh', mobile = false) {
  if (mobile) cy.viewport('iphone-x')
  cy.fixture('world-vocabulary.json').then((entries: WorldEntry[]) => {
    const cards: EnglishCard[] = entries.map((entry) => ({
      id: entry.word, word: entry.word, meaning: entry.meaning, examples: entry.examples,
      pronunciation: '', generated: true, inReview: false, updatedAt: '2026-11-09T00:00:00Z',
      senses: [{ pos: entry.kind, en: entry.definition, zh: entry.meaning }],
      band: { collocations: [], writing: '', speaking: '', weak: '', fix: '', paraphrases: [], zh: '' },
    }))
    cy.intercept('GET', '/api/english', { body: cards })
    cy.intercept('GET', '/api/english/speech', { body: { available: false } })
    cy.intercept('GET', '/api/learning/plan*', { statusCode: 503, body: { error: 'No test learning plan' } })
    cy.intercept('GET', '/api/learning/progress*', { body: {
      xp: 0, streak: 0, lastDay: '', completed: [], timezone: 'UTC', weekly: [], legacyImported: true,
    } })
    // Use the real authored seed content without invoking enrichment providers.
    cy.intercept('POST', '/api/english/*/band', { statusCode: 503, body: { error: 'Enrichment disabled in this test' } })
    cy.visit('/english?tab=words&word=aquifer', { onBeforeLoad(win) {
      win.localStorage.setItem('projectdesk.locale', locale)
    } })
  })
}

describe('World vocabulary library', { tags: '@regression' }, () => {
  it('finds authored world words in English and Chinese and displays all ten examples', () => {
    openLibrary('en')
    cy.get('[data-testid="vocabulary-total"]').should('contain', '60 words saved')
    cy.get('[data-testid="vocabulary-review-total"]').should('have.text', '0 words')
    cy.contains('h2', /^aquifer$/).should('be.visible')
    cy.contains('An underground layer of rock or sediment that stores and carries water.').should('exist')
    cy.get('#english-search').type('biodiversity')
    cy.get('li button').contains('biodiversity').click()
    cy.contains('h2', /^biodiversity$/).should('be.visible')
    cy.get('#word-biodiversity-examples').within(() => {
      cy.contains('The survey records biodiversity in the woodland.').should('exist')
      cy.contains('button', /More examples/i).click()
      cy.contains('The restoration project aims to improve biodiversity along the river.').should('exist')
    })
    cy.get('#english-search').clear().type('海水')
    cy.get('li button').contains('desalination').click()
    cy.contains('h2', /^desalination$/).should('be.visible')
    cy.contains('li button', 'desalination').should('not.contain', 'Mastered')
  })

  it('reports real counts and empty search results in the Chinese mobile library', () => {
    openLibrary('zh', true)
    cy.get('[data-testid="vocabulary-total"]').should('have.text', '已收录 60 词')
    cy.get('[data-testid="vocabulary-review-total"]').should('have.text', '0 词')
    cy.get('#english-search').type('含水层')
    cy.get('li button').contains('aquifer').should('be.visible')
    cy.get('#english-search').clear().type('zzzz-no-matching-word')
    cy.contains('当前字母：A · 共 0 词').should('exist')
    cy.get('[data-testid="vocabulary-total"]').should('have.text', '已收录 60 词')
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth + 1))
  })

  it('keeps an empty saved library empty instead of mixing in sample cards', () => {
    openLibrary('en')
    cy.get('[data-testid="vocabulary-total"]').should('contain', '60 words saved')
    cy.intercept('GET', '/api/english', { body: [] }).as('emptyLibrary')
    cy.reload()
    cy.wait('@emptyLibrary')
    cy.get('[data-testid="vocabulary-total"]').should('have.text', '0 words saved')
    cy.get('[data-testid="vocabulary-review-total"]').should('have.text', '0 words')
    cy.contains('li button', 'abandon').should('not.exist')
  })
})
