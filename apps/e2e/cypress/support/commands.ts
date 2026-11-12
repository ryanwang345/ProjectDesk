type Project = {
  id: string
  name: string
  note: string
  status: 'sketch' | 'building' | 'shipped'
  updatedAt: string
}

// Every card the suite creates starts with this prefix. Cleanup only deletes
// cards that match it, because the target desk holds real projects.
export const E2E_PREFIX = '[cypress-e2e]'

declare global {
  namespace Cypress {
    interface Chainable {
      visitDesk(): Chainable<void>
      listProjects(): Chainable<Project[]>
      deleteProjectsStartingWith(prefix: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('visitDesk', () => {
  cy.visit('/')
  cy.contains('h1', 'The desk').should('be.visible')
  cy.get('[aria-busy="true"]').should('not.exist')
})

Cypress.Commands.add('listProjects', () => {
  return cy
    .request<Project[]>('/api/projects')
    .its('body')
})

Cypress.Commands.add('deleteProjectsStartingWith', (prefix: string) => {
  if (!prefix.startsWith(E2E_PREFIX)) {
    throw new Error(`Refusing to delete projects outside the ${E2E_PREFIX} prefix`)
  }
  cy.listProjects().then((projects) => {
    for (const project of projects.filter((item) => item.name.startsWith(prefix))) {
      cy.request('DELETE', `/api/projects/${project.id}`)
    }
  })
})
