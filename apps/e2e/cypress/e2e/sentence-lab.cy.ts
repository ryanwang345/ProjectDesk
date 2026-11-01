const lab = '#word-school-usage'
const example = { id: 1, text: 'She goes to school every day.', author: 'CK', url: 'https://tatoeba.org/en/sentences/show/1', license: 'CC BY 2.0 FR', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/' }

function openLab(locale: 'en' | 'zh' = 'en', examples = [example]) {
  cy.intercept('GET', '/api/english', { body: [{
    id: 'school', word: 'school', meaning: '学校', examples: [], pronunciation: '/skuːl/',
    inReview: false, generated: false, updatedAt: '2026-11-15T00:00:00Z', senses: [],
    band: { collocations: [], writing: '', speaking: '', weak: '', fix: '', paraphrases: [], zh: '' },
  }] })
  cy.intercept('GET', '/api/learning/plan*', { statusCode: 503, body: { error: 'No test plan' } })
  cy.intercept('GET', '/api/learning/progress*', { body: { xp: 0, streak: 0, completed: [], weekly: [], legacyImported: true } })
  cy.intercept('POST', '/api/english/*/band', () => { throw new Error('Vocabulary must not auto-generate AI notes') })
  cy.intercept('POST', '/api/english/*/senses', () => { throw new Error('Vocabulary must not auto-generate AI senses') })
  cy.intercept('GET', '/api/english/examples?word=school', { body: { examples } }).as('examples')
  cy.visit('/english?tab=words&word=school', { onBeforeLoad(win) { win.localStorage.setItem('projectdesk.locale', locale) } })
  cy.wait('@examples')
  cy.get(lab).scrollIntoView()
}

describe('Sentence practice without AI', { tags: '@regression' }, () => {
  it('applies a selected suggestion and rechecks the edited sentence', () => {
    let checks = 0
    cy.intercept('POST', '/api/english/evaluate', (req) => {
      checks++
      expect(req.body).to.deep.eq({ word: 'school', sentence: checks === 1 ? 'She go to school.' : 'She goes to school.' })
      req.reply({ body: { source: 'languagetool', usedWord: true, matches: checks === 1 ? [{ message: 'Use goes with she.', offset: 4, length: 2, replacements: [{ value: 'goes' }], rule: { id: 'AGREEMENT', issueType: 'grammar' } }] : [] } })
    }).as('check')
    openLab()
    cy.get(lab).within(() => {
      cy.get('textarea').type('She go to school.')
      cy.contains('button', 'Check sentence').click()
      cy.wait('@check')
      cy.contains('Use goes with she.').should('be.visible')
      cy.get('textarea').should('have.value', 'She go to school.')
      cy.contains('button', 'Use: goes').click()
      cy.get('textarea').should('have.value', 'She goes to school.')
      cy.contains('Use goes with she.').should('not.exist')
      cy.contains('button', 'Check sentence').click()
      cy.wait('@check')
      cy.contains('No issues detected by the available rules.').should('be.visible')
      cy.contains('Band 8').should('not.exist')
      cy.get('a').contains('Tatoeba · CK').should('have.attr', 'href', example.url)
      cy.get('a').contains(example.license).should('have.attr', 'href', example.licenseUrl)
    })
    cy.get(lab).screenshot('sentence-lab-desktop')
  })

  it('keeps failed checks distinct from clean sentences and supports retry', () => {
    cy.intercept('POST', '/api/english/evaluate', { statusCode: 503, body: { error: 'Unavailable' } }).as('failedCheck')
    openLab()
    cy.get(lab).within(() => {
      cy.get('textarea').type('I go to school.')
      cy.contains('button', 'Check sentence').click()
      cy.wait('@failedCheck')
      cy.get('[role="alert"]').should('contain', 'unavailable')
      cy.contains('No issues detected').should('not.exist')
      cy.contains('button', 'Check sentence').should('be.enabled')
    })
    cy.intercept('POST', '/api/english/evaluate', { body: { source: 'languagetool', usedWord: true, matches: [] } }).as('retryCheck')
    cy.get(lab).contains('button', 'Check sentence').click()
    cy.wait('@retryCheck')
    cy.get(lab).contains('No issues detected').should('be.visible')
  })

  it('invalidates old suggestions when the learner edits during a check', () => {
    cy.intercept('POST', '/api/english/evaluate', { delay: 800, body: { source: 'languagetool', usedWord: false, matches: [] } }).as('slowCheck')
    openLab()
    cy.get(lab).within(() => {
      cy.get('textarea').type('I agree.')
      cy.contains('button', 'Check sentence').click()
      cy.get('textarea').clear().type('I go to school.')
      cy.wait('@slowCheck')
      cy.contains('target word').should('not.exist')
      cy.contains('No issues detected').should('not.exist')
      cy.contains('button', 'Check sentence').should('be.enabled')
    })
  })

  it('shows empty example searches and a missing target word in Chinese on mobile', () => {
    cy.viewport('iphone-x')
    cy.intercept('POST', '/api/english/evaluate', { body: { source: 'languagetool', usedWord: false, matches: [] } }).as('check')
    openLab('zh', [])
    cy.get(lab).within(() => {
      cy.contains('暂未找到包含该词的已校对例句。').should('be.visible')
      cy.get('textarea').type('I agree.')
      cy.contains('button', '检查语法与拼写').click()
      cy.wait('@check')
      cy.contains('未找到目标词').should('be.visible')
      cy.get('textarea').should('have.value', 'I agree.')
    })
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth + 1))
    cy.get(lab).screenshot('sentence-lab-mobile')
  })

  it('plays example sentences with device speech without calling AI audio', () => {
    let audioCalls = 0
    cy.intercept('/api/english/speech', (req) => {
      audioCalls++
      req.reply({ body: { available: true } })
    })
    openLab()
    cy.window().then((win) => {
      cy.stub(win.speechSynthesis, 'getVoices').returns([{ name: 'Local English', lang: 'en-US', localService: true }] as SpeechSynthesisVoice[])
      cy.stub(win.speechSynthesis, 'cancel')
      cy.stub(win.speechSynthesis, 'resume')
      cy.stub(win, 'SpeechSynthesisUtterance').callsFake((text: string) => ({ text }))
      cy.stub(win.speechSynthesis, 'speak').callsFake((utter: SpeechSynthesisUtterance) => {
        utter.onstart?.call(utter, new win.Event('start') as SpeechSynthesisEvent)
      }).as('deviceSpeak')
    })
    cy.get(lab).find(`[data-pronunciation="${example.text}"] button`).click()
    cy.get('@deviceSpeak').should('have.been.calledOnce').its('firstCall.args.0.text').should('eq', example.text)
    cy.then(() => expect(audioCalls).to.eq(0))
  })
})
