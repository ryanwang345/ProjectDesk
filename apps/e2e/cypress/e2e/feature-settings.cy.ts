const storageKey = 'projectdesk.features.v1'
const features = ['learn', 'words', 'puzzles', 'grammar', 'reading', 'listening', 'radio', 'me', 'desk', 'about']

function visitWithFlags(url: string, flags: Record<string, boolean> = {}, locale = 'en') {
  cy.visit(url, { onBeforeLoad(win) {
    win.localStorage.setItem('projectdesk.locale', locale)
    win.localStorage.setItem(storageKey, JSON.stringify(flags))
  } })
}

describe('Page settings and URL access', { tags: '@regression' }, () => {
  beforeEach(() => {
    // The shared hover dictionary reads vocabulary even outside vocabulary pages.
    cy.intercept('GET', '/api/english', { body: [] })
    cy.intercept('GET', '/api/learning/progress*', { body: { xp: 0, streak: 0, completed: [], weekly: [], legacyImported: true } })
    cy.intercept('GET', '/api/learning/plan*', { statusCode: 503, body: { error: 'No test plan' } })
  })

  it('saves switches, removes navigation links, blocks direct visits and allows re-enabling', () => {
    visitWithFlags('/settings')
    cy.get('#feature-grammar').should('have.attr', 'aria-checked', 'true').click()
    cy.get('nav a[href="/grammar"]').should('not.exist')
    cy.reload()
    cy.get('#feature-grammar').should('have.attr', 'aria-checked', 'false')
    cy.visit('/grammar')
    cy.get('[data-testid="feature-disabled"]').should('contain', 'This page is disabled')
    cy.contains('a', 'Open Settings').click()
    cy.get('#feature-grammar').click().should('have.attr', 'aria-checked', 'true')
    cy.get('nav a[href="/grammar"]').filter(':visible').click()
    cy.get('[data-testid="feature-disabled"]').should('not.exist')
    cy.location('pathname').should('eq', '/grammar')
    cy.get('main').should('not.contain', 'Loading module')
  })

  const cases: Array<[string, string[]]> = [
    ['learn', ['/', '/english', '/english?tab=learn', '/english?tab=practice', '/english?tab=unknown']],
    ['words', ['/english?tab=words', '/?tab=words', '/words', '/vocabulary']],
    ['puzzles', ['/puzzles', '/puzzles?puzzle=alice']],
    ['grammar', ['/grammar', '/GRAMMAR/']],
    ['reading', ['/reading', '/english?tab=reading', '/?tab=reading']],
    ['listening', ['/listening']],
    ['radio', ['/radio']],
    ['me', ['/me', '/english?tab=me']],
    ['desk', ['/desk', '/board']],
    ['about', ['/about']],
  ]
  for (const [feature, urls] of cases) {
    it(`blocks every URL for disabled ${feature} before mounting page content`, () => {
      // No page-specific data should be fetched by a disabled page.
      cy.intercept('GET', '/api/english/examples*', () => { throw new Error('Disabled page fetched sentence examples') })
      cy.intercept('GET', '/api/projects', () => { throw new Error('Disabled page fetched projects') })
      for (const url of urls) {
        visitWithFlags(url, { [feature]: false })
        cy.get('[data-testid="feature-disabled"]').should('be.visible')
        cy.get('main').find('textarea, audio, video').should('not.exist')
      }
    })
  }

  it('keeps Settings reachable when every optional page is disabled on mobile', () => {
    cy.viewport('iphone-x')
    visitWithFlags('/settings', {}, 'zh')
    for (const feature of features) cy.get(`#feature-${feature}`).click()
    cy.get('[role="switch"][aria-checked="false"]').should('have.length', features.length)
    cy.get('nav a').filter(':visible').should('have.length', 1).and('have.attr', 'href', '/settings')
    cy.reload()
    cy.get('[role="switch"][aria-checked="false"]').should('have.length', features.length)
    cy.get('nav a[href="/settings"]').filter(':visible').should('contain', '设置')
    cy.contains('button', '检索词库').should('not.exist')
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth + 1))
    cy.screenshot('feature-settings-mobile', { capture: 'viewport' })
    cy.visit('/')
    cy.get('[data-testid="feature-disabled"]').should('be.visible')
    cy.contains('a', '打开设置').click()
    cy.get('#feature-words').click().should('have.attr', 'aria-checked', 'true')
  })

  it('blocks an already open page when another tab disables it', () => {
    visitWithFlags('/about')
    cy.get('[data-testid="feature-disabled"]').should('not.exist')
    cy.window().then((win) => {
      const value = JSON.stringify({ about: false })
      win.localStorage.setItem(storageKey, value)
      win.dispatchEvent(new win.StorageEvent('storage', { key: storageKey, newValue: value }))
    })
    cy.get('[data-testid="feature-disabled"]').should('be.visible')
    cy.get('nav a[href="/about"]').should('not.exist')
  })

  it('handles invalid saved preferences and supports keyboard switching', () => {
    cy.visit('/settings', { onBeforeLoad(win) {
      win.localStorage.setItem('projectdesk.locale', 'en')
      win.localStorage.setItem(storageKey, '{broken')
    } })
    cy.get('[role="switch"][aria-checked="true"]').should('have.length', features.length)
    cy.get('#feature-reading').focus()
    cy.press(Cypress.Keyboard.Keys.SPACE)
    cy.get('#feature-reading').should('have.attr', 'aria-checked', 'false')
    cy.get('nav a[href="/reading"]').should('not.exist')
    cy.screenshot('feature-settings-desktop', { capture: 'viewport' })
  })
})
