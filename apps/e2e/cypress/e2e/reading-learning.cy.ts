import type { ReadingQuestion, ReadingSessionBundle } from '../../../web/src/lib/reading'

function answer(question: ReadingQuestion, value?: string) {
  cy.get(`button[aria-label="Question ${question.number}"]`).click()
  const container = `#reading-q-${question.id}`
  if (question.type === 'tfng' || question.type === 'ynng') {
    cy.get(container).contains('button', new RegExp(`^${value ?? (question.type === 'tfng' ? 'TRUE' : 'YES')}$`)).click()
  } else if (question.type === 'multiple_choice') {
    const option = value ?? 'A'
    cy.get(container).find('[role="radio"]').filter((_, element) => element.textContent?.trim().startsWith(`${option}.`) ?? false).click()
  } else if (question.type.startsWith('matching')) {
    cy.get(container).find('select').select(value ?? 'A')
  } else cy.get(container).find('input[type="text"]').clear().type(value ?? 'incorrect')
}

function englishDefinitions() {
  // Vocabulary enrichment is unrelated to this persistence test and must not
  // trigger paid provider calls in an isolated workspace.
  cy.intercept('POST', '/api/english/*/band', { statusCode: 503, body: { error: 'No provider configured in this test workspace' } })
}

describe('Reading learning experience', { tags: '@regression' }, () => {
  const writingTest = Cypress.expose('allowLearningWrites') ? it : it.skip

  it('keeps the seven learning sections in order and works on mobile', () => {
    cy.visit('/reading')
    cy.get('[data-testid="daily-reading-card"]').should('be.visible')
    const sections = ['reading-welcome','daily-reading-card','reading-continue','reading-recommendations','reading-weekly-activity','reading-library','reading-learning-review']
    cy.get('[data-testid="reading-welcome"]').parent().then(($dashboard) => {
      const positions = sections.map((id) => Array.from($dashboard[0].children).findIndex((element) => element.getAttribute('data-testid') === id))
      expect(positions.every((value) => value >= 0)).to.eq(true)
      expect(positions).to.deep.eq([...positions].sort((a,b)=>a-b))
    })
    cy.get('[data-testid="reading-performance-details"]').should('not.have.attr', 'open')
    cy.get('[data-testid="tab-full-tests"]').focus().type('{rightarrow}')
    cy.get('[data-testid="tab-passages"]').should('have.focus').and('have.attr', 'aria-selected', 'true')
    cy.get('[data-testid="tab-passages"]').type('{leftarrow}')
    cy.get('[data-testid="tab-full-tests"]').should('have.focus')
    cy.scrollTo('top')
    cy.screenshot('reading-learning-desktop', { capture: 'viewport' })
    cy.viewport('iphone-x')
    cy.get('[data-testid="module-general"]').click()
    cy.get('[data-testid="reading-test-card-general-full-1"]').should('exist')
    cy.get('[data-testid="daily-reading-card"] button').should('be.visible')
    cy.document().then((document) => expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth + 1))
    cy.scrollTo('top')
    cy.screenshot('reading-learning-mobile', { capture: 'viewport' })
  })

  it('shows unknown progress during an outage and recovers through Retry', () => {
    cy.intercept('GET', '/api/learning/progress*', { statusCode: 503, body: { error: 'Temporarily unavailable' } }).as('progressUnavailable')
    cy.visit('/reading')
    cy.wait('@progressUnavailable')
    cy.contains('[role="alert"]', 'Your learning progress could not be loaded').should('be.visible')
    cy.get('[data-testid="learning-xp"]').should('have.text', '—')
    cy.get('[data-testid="start-daily-reading"]').should('be.disabled')
    cy.get('[data-testid="reading-continue"]').should('contain', 'Checking your saved practice')
    cy.get('[data-testid="reading-recommendations"]').should('not.contain', '% accuracy')
    cy.intercept('GET', '/api/learning/progress*', (request) => request.continue()).as('progressRestored')
    cy.contains('[role="alert"] button', 'Retry').click()
    cy.wait('@progressRestored')
    cy.get('[data-testid="start-daily-reading"]').should('be.enabled')
    cy.get('[data-testid="learning-xp"]').should('not.have.text', '—')
    cy.get('[data-testid="tab-ai-generator"]').click()
    cy.get('#ai-launch-mode').select('exam').should('have.value', 'exam')
  })

  writingTest('persists a daily attempt, rewards it once, reviews real mistakes, and shares XP with vocabulary', () => {
    let started: ReadingSessionBundle
    let completed: ReadingSessionBundle
    let xpBefore = 0
    cy.intercept('POST', '/api/reading/daily*').as('daily')
    cy.intercept('PATCH', '/api/reading/sessions/*').as('save')
    cy.intercept('POST', '/api/reading/sessions/*/submit').as('submit')
    cy.intercept('POST', '/api/reading/mistakes/review').as('review')
    cy.request('/api/learning/progress').then(({body}) => { xpBefore = body.xp })
    cy.visit('/reading')
    cy.get('[data-testid="start-daily-reading"]').click()
    cy.wait('@daily').then(({response}) => {
      started = response?.body as ReadingSessionBundle
      expect(started.session.kind).to.eq('daily')
      expect(started.test.questions).to.have.length(5)
      expect(started.session.status, 'use a fresh isolated test workspace').to.eq('active')
      for (const question of started.test.questions ?? []) expect(question.correctAnswer).to.eq(undefined)
      answer(started.test.questions![0])
    })
    cy.wait('@save').its('response.statusCode').should('eq', 200)
    cy.contains('button', 'Exit to Dashboard').click()
    cy.get('[data-testid="daily-reading-card"]').should('contain', '1 / 5')
    cy.reload()
    cy.get('[data-testid="daily-reading-card"]').should('contain', '1 / 5')
    cy.get('[data-testid="start-daily-reading"]').click()
    cy.wait('@daily').then(({response}) => {
      const resumed = response?.body as ReadingSessionBundle
      expect(resumed.session.id).to.eq(started.session.id)
      expect(Object.keys(resumed.session.answers)).to.have.length(1)
      for (const question of resumed.test.questions!.slice(1)) answer(question)
    })
    cy.get('[data-testid="reading-submit-button"]').click()
    cy.wait('@submit').then(({response}) => {
      completed = response?.body as ReadingSessionBundle
      expect(completed.session.status).to.eq('submitted')
      expect(completed.session.xpEarned).to.eq(completed.session.score * 10)
      expect(completed.session.results!.questions.filter((question) => !question.correct).length).to.be.greaterThan(0)
    })
    cy.get('[data-testid="reading-learning-summary"]').should('be.visible')
    cy.get('[data-testid="reading-band-score"]').should('not.exist')
    cy.then(() => {
      cy.request('POST', `/api/reading/sessions/${started.session.id}/submit`, {answers:{}}).its('body.session.xpEarned').should('eq', completed.session.xpEarned)
      cy.request('/api/learning/progress').then(({body})=>expect(body.xp).to.eq(xpBefore + completed.session.xpEarned!))
    })
    cy.contains('button', 'Find my next step').click()
    cy.get('[data-testid="reading-weekly-activity"]').should('contain', '1/7')
    cy.get('[data-testid="reading-learning-review"]').scrollIntoView()
    cy.get('[data-testid="retry-reading-mistakes"]').should('be.enabled').click()
    cy.wait('@review').then(({response}) => {
      const reviewed = response!.body as ReadingSessionBundle
      for (const question of reviewed.test.questions ?? []) answer(question)
    })
    cy.get('[data-testid="reading-exam-view"]').should('be.visible')
    cy.get('[data-testid="reading-submit-button"]').click()
    cy.wait('@submit').then(({response})=>expect(response?.body.session.kind).to.eq('mistake_review'))
    cy.contains('button', 'Find my next step').click()
    cy.get('[data-testid="reading-improvement-feedback"]').should('contain', 'retries')
    cy.request('/api/learning/progress').then(({body}) => {
      cy.visit('/english?tab=me')
      cy.contains(`${body.xp} XP`).should('be.visible')
    })
  })

  writingTest('saves a genuine passage word with context into the shared vocabulary review', () => {
    englishDefinitions()
    let bundle: ReadingSessionBundle
    let cardId = ''
    let term = ''
    cy.intercept('POST', '/api/reading/sessions').as('start')
    cy.intercept('POST', '/api/reading/vocabulary').as('saveWord')
    cy.visit('/reading')
    cy.get('[data-testid="start-practice-academic-full-2"]').click()
    cy.wait('@start').then(({response}) => {
      bundle = response?.body as ReadingSessionBundle
      term = bundle.test.passages[0].paragraphs[0].text.split(/\s+/)[0].replace(/[^a-z]/gi, '')
      cy.contains('button', /^Vocabulary$/).click()
      cy.get('input[placeholder*="Type or select"]').type(term)
    })
    cy.get('[data-testid="reading-vocab-definition"]').type('A vocabulary item retained with its original reading context.')
    cy.get('[data-testid="save-reading-vocabulary"]').click()
    cy.wait('@saveWord').then(({response}) => { expect(response?.statusCode).to.eq(200); cardId = response?.body.id })
    cy.contains('[role="status"]', 'Passage context saved').should('be.visible')
    cy.then(() => {
      cy.request('/api/reading/vocabulary').then(({body}) => {
        const saved = (body as Array<{cardId:string;context:string}>).find((word) => word.cardId === cardId)
        expect(saved?.context).to.eq(bundle.test.passages[0].paragraphs[0].text)
      })
      cy.visit(`/english?tab=words&word=${cardId}`)
      cy.contains('h2', term).should('be.visible')
      cy.request('/api/english').then(({body}) => expect((body as Array<{id:string;inReview:boolean}>).find((card) => card.id === cardId)?.inReview).to.eq(true))
    })
  })
})
