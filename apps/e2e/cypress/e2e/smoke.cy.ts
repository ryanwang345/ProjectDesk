describe('Project Desk smoke', { tags: '@smoke' }, () => {
  it('nginx answers its health check', () => {
    cy.request('/healthz').then((response) => {
      expect(response.status).to.eq(200)
      expect(String(response.body).trim()).to.eq('ok')
    })
  })

  it('the Go API reaches Postgres', () => {
    cy.request('/api/healthz').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.deep.eq({ status: 'ok' })
    })
  })

  it('loads the desk without a storage problem', () => {
    cy.visitDesk()
    cy.contains('[role="status"]', 'could not reach the Go API').should('not.exist')
    cy.contains('button', 'Add a project').should('be.visible')
  })

  it('opens the about page from the header', () => {
    cy.visitDesk()
    cy.get('nav[aria-label="Primary"]').contains('a', 'How it runs').click()
    cy.location('pathname').should('eq', '/about')
    cy.contains('h1', 'How it runs').should('be.visible')
  })

  it('serves the app for unknown paths and shows the 404 page', () => {
    cy.visit('/no-such-page-from-cypress')
    cy.contains('h1', 'This path is not on the desk').should('be.visible')
    cy.contains('a', 'Back to the desk').click()
    cy.location('pathname').should('eq', '/')
  })
})
