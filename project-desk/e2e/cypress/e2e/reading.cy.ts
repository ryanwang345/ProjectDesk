describe('IELTS Reading Practice Module', { tags: '@regression' }, () => {
  it('opens IELTS Reading from the primary header and switches modules and tabs', () => {
    cy.visitDesk()
    cy.get('nav[aria-label="Primary"]').contains('a', 'IELTS Reading').click()
    cy.location('pathname').should('eq', '/reading')
    cy.contains('h1', 'IELTS Reading Practice & Exam Studio').should('be.visible')

    // Academic full test should be visible by default
    cy.get('[data-testid="reading-test-card-academic-full-1"]').should('be.visible')

    // Switch to General Training
    cy.get('[data-testid="module-general"]').click()
    cy.get('[data-testid="reading-test-card-general-full-1"]').should('be.visible')

    // Switch back to Academic and check Individual Passages & Question Type Practice tabs
    cy.get('[data-testid="module-academic"]').click()
    cy.get('[data-testid="tab-passages"]').click()
    cy.get('[data-testid="reading-test-card-academic-passage-1"]').should('be.visible')

    cy.get('[data-testid="tab-question-types"]').click()
    cy.get('[data-testid="reading-test-card-drill-tfng-ynng"]').should('be.visible')
  })

  it('redacts protected answer keys during an active session, supports Practice check, and scores submission', () => {
    cy.intercept('POST', '/api/reading/sessions').as('startSession')
    cy.intercept('POST', '/api/reading/sessions/*/check').as('checkQuestion')
    cy.intercept('POST', '/api/reading/sessions/*/submit').as('submitSession')

    cy.visit('/reading')
    cy.get('[data-testid="tab-question-types"]').click()
    cy.get('[data-testid="start-practice-drill-tfng-ynng"]').click()

    cy.wait('@startSession').then((interception) => {
      expect(interception.response?.statusCode).to.eq(201)
      const questions = interception.response?.body?.test?.questions ?? []
      expect(questions.length).to.be.greaterThan(0)
      for (const q of questions) {
        expect(q.correctAnswer).to.eq(undefined)
        expect(q.explanation).to.eq(undefined)
      }
    })

    // Split-screen exam view is visible
    cy.get('[data-testid="reading-exam-view"]').should('be.visible')
    cy.get('[data-testid="reading-timer"]').should('be.visible')

    // Answer Q1 (TRUE) and check immediately in Practice Mode
    cy.get('[role="radiogroup"]').first().contains('button', /^TRUE$/).click()
    cy.contains('button', 'Check Answer').first().click()
    cy.wait('@checkQuestion').its('response.statusCode').should('eq', 200)

    // Submit the session and verify Results & Analytics screen
    cy.get('[data-testid="reading-submit-button"]').click()
    cy.wait('@submitSession').its('response.statusCode').should('eq', 200)

    cy.get('[data-testid="reading-results-view"]').should('be.visible')
    cy.get('[data-testid="reading-band-score"]').should('be.visible')
    cy.contains('Unofficial Band Estimate').should('be.visible')
  })

  it('supports responsive mobile tabbed layout between Passage and Questions', () => {
    cy.viewport('iphone-x')
    cy.visit('/reading')
    cy.get('[data-testid="start-practice-academic-full-1"]').click()

    cy.get('[data-testid="reading-exam-view"]').should('be.visible')
    cy.contains('button', 'Questions (0/40)').click()
    cy.get('#reading-q-ac1-q1').should('be.visible')
    cy.screenshot('reading-exam-mobile', { capture: 'viewport' })
    cy.contains('button', 'Reading Passage').click()
  })

  it('auto-submits when the countdown timer expires in Exam Mode', () => {
    cy.request('GET', '/api/reading/tests').then((res) => {
      const tests = res.body as Array<{ id: string; slug: string }>
      const drill = tests.find((t) => t.slug === 'drill-tfng-ynng') ?? tests[0]
      expect(Boolean(drill)).to.eq(true)

      // Start an exam session with a 2-second duration to verify timer expiration
      cy.intercept('POST', '/api/reading/sessions', (req) => {
        req.body.durationSeconds = 2
      }).as('shortExam')
      cy.intercept('POST', '/api/reading/sessions/*/submit').as('autoSubmit')

      cy.visit('/reading')
      cy.get('[data-testid="tab-question-types"]').click()
      cy.get('[data-testid="start-exam-drill-tfng-ynng"]').click()
      cy.get('[data-testid="reading-begin-exam"]').click()

      cy.wait('@shortExam').its('response.statusCode').should('eq', 201)
      cy.wait('@autoSubmit', { timeout: 8000 }).its('response.statusCode').should('eq', 200)
      cy.get('[data-testid="reading-results-view"]').should('be.visible')
    })
  })

  it('provides full-length new papers and module-specific passage and type practice', () => {
    cy.request('GET', '/api/reading/tests').then(({ body }) => {
      const tests = body as Array<{ slug: string; durationSeconds: number; questionCount: number; passages: Array<{ wordCount: number }> }>
      for (const slug of ['academic-full-2', 'general-full-2']) {
        const paper = tests.find((test) => test.slug === slug)
        expect(paper, slug).to.exist
        expect(paper?.durationSeconds).to.eq(3600)
        expect(paper?.questionCount).to.eq(40)
        expect(paper?.passages).to.have.length(3)
        const words = paper?.passages.reduce((sum, p) => sum + p.wordCount, 0) ?? 0
        expect(words).to.be.within(2150, slug.startsWith('general') ? 2375 : 2750)
      }
    })
    cy.visit('/reading')
    cy.get('[data-testid="reading-test-card-academic-full-2"]').should('be.visible')
    cy.get('[data-testid="tab-passages"]').click()
    cy.get('[data-testid="reading-test-card-academic-full-2-passage-1"]').should('be.visible')
    cy.get('[data-testid="module-general"]').click()
    cy.get('[data-testid="reading-test-card-general-full-2-passage-1"]').should('be.visible')
    cy.get('[data-testid="tab-question-types"]').click()
    cy.get('[data-testid="reading-test-card-general-full-2-drill-tfng"]').should('be.visible')
    cy.get('[data-testid="reading-test-card-academic-full-2-drill-tfng"]').should('not.exist')
  })

  it('briefs the candidate, locks assistance, and reviews unanswered and flagged questions before submission', () => {
    cy.intercept('POST', '/api/reading/sessions').as('startExam')
    cy.intercept('POST', '/api/reading/sessions/*/submit').as('submitExam')
    cy.visit('/reading')
    cy.get('[data-testid="start-exam-academic-full-2"]').click()
    cy.get('[data-testid="reading-exam-briefing"]').should('be.visible').and('contain', '60 minutes')
    cy.get('[data-testid="reading-exam-view"]').should('not.exist')
    cy.get('[data-testid="reading-begin-exam"]').click()
    cy.wait('@startExam').then(({ response }) => {
      expect(response?.body.session.durationSeconds).to.eq(3600)
      for (const q of response?.body.test.questions ?? []) {
        expect(q.correctAnswer).to.eq(undefined)
        expect(q.evidenceQuote).to.eq(undefined)
        expect(q.explanation).to.eq(undefined)
      }
      const sessionId = response?.body.session.id as string
      cy.request({ method: 'POST', url: `/api/reading/sessions/${sessionId}/check`, body: { questionId: 'academic-full-2-q1', userAnswer: 'TRUE' }, failOnStatusCode: false }).its('status').should('eq', 400)
      cy.request({ method: 'POST', url: '/api/reading/ai/explain', body: { sessionId, questionId: 'academic-full-2-q1' }, failOnStatusCode: false }).its('status').should('eq', 400)
    })
    cy.contains('button', 'AI Vocab').should('not.exist')
    cy.get('[data-testid="reading-exam-view"]').should(($exam) => {
      const rect = $exam[0].getBoundingClientRect()
      const viewport = $exam[0].ownerDocument.defaultView!
      expect(rect.top).to.eq(0)
      expect(rect.left).to.eq(0)
      expect(rect.width).to.eq(viewport.innerWidth)
      expect(rect.height).to.eq(viewport.innerHeight)
    })
    cy.contains('button', 'Check Answer').should('not.exist')
    cy.contains('button', /^Pause$/).should('not.exist')
    cy.get('[role="radiogroup"][aria-label="Question 1"]').contains('button', /^TRUE$/).click()
    cy.get('[aria-label="Flag question 1 for review"]').click()
    cy.screenshot('reading-exam-desktop', { capture: 'viewport' })
    cy.get('[data-testid="reading-submit-button"]').click()
    cy.get('[data-testid="reading-submit-review"]').should('contain', '39 unanswered').and('contain', '1 flagged')
    cy.get('[data-testid="reading-submit-review"]').contains('button', /^2$/).click()
    cy.get('#reading-q-academic-full-2-q2').should('be.visible')
    cy.get('[data-testid="reading-submit-button"]').click()
    cy.get('[data-testid="reading-confirm-submit"]').click()
    cy.wait('@submitExam').its('response.body.session.score').should('eq', 1)
    cy.get('[data-testid="reading-results-view"]').should('be.visible')
    cy.contains('button', 'Practice Again').click()
    cy.get('[data-testid="reading-exam-briefing"]').should('be.visible')
  })

  it('restores saved answers after reloading without resetting the exam clock', () => {
    cy.intercept('PATCH', '/api/reading/sessions/*').as('saveAnswers')
    cy.intercept('GET', '/api/reading/sessions/*').as('resumeExam')
    cy.visit('/reading')
    cy.get('[data-testid="start-exam-academic-full-2"]').click()
    cy.get('[data-testid="reading-begin-exam"]').click()
    cy.get('[role="radiogroup"][aria-label="Question 1"]').contains('button', /^TRUE$/).click()
    cy.wait('@saveAnswers').its('response.statusCode').should('eq', 200)
    cy.get('[data-testid="reading-timer"]').should('not.contain', '60:00')
    cy.reload()
    cy.wait('@resumeExam').its('response.body.session.elapsedSeconds').should('be.gte', 0)
    cy.get('[role="radiogroup"][aria-label="Question 1"]').contains('button', /^TRUE$/).should('have.attr', 'aria-checked', 'true')
    cy.get('[data-testid="reading-progress"]').should('contain', '1/40')
    cy.get('[data-testid="reading-timer"]').should('not.contain', '60:00')
  })

  it('locks answers at expiry and retries a failed automatic submission', () => {
    let submissions = 0
    cy.intercept('POST', '/api/reading/sessions', (req) => { req.body.durationSeconds = 2 })
    cy.intercept('POST', '/api/reading/sessions/*/submit', (req) => {
      submissions++
      if (submissions === 1) req.reply({ statusCode: 503, body: { error: 'Temporary failure' } })
    }).as('expiredSubmit')
    cy.visit('/reading')
    cy.get('[data-testid="tab-question-types"]').click()
    cy.get('[data-testid="start-exam-drill-tfng-ynng"]').click()
    cy.get('[data-testid="reading-begin-exam"]').click()
    cy.wait('@expiredSubmit', { timeout: 8000 }).its('response.statusCode').should('eq', 503)
    cy.contains('[role="alert"]', 'retrying automatically').should('be.visible')
    cy.get('[role="radiogroup"]').first().find('button').should('be.disabled')
    cy.wait('@expiredSubmit', { timeout: 10000 }).its('response.statusCode').should('eq', 200)
    cy.get('[data-testid="reading-results-view"]').should('be.visible')
  })
})
