import { E2E_PREFIX } from '../support/commands'

const STALE_AFTER_MS = 60 * 60 * 1000

function cardFor(name: string) {
  return cy.contains('[data-slot="card-title"]', name).closest('[data-slot="card"]')
}

describe('Project Desk cards', { tags: '@regression' }, () => {
  let name = ''

  before(() => {
    // Cards from runs that were killed before their cleanup ran.
    cy.listProjects().then((projects) => {
      const cutoff = Date.now() - STALE_AFTER_MS
      for (const project of projects) {
        if (project.name.startsWith(E2E_PREFIX) && Date.parse(project.updatedAt) < cutoff) {
          cy.request('DELETE', `/api/projects/${project.id}`)
        }
      }
    })
  })

  beforeEach(() => {
    name = `${E2E_PREFIX} ${Date.now().toString(36)}-${Cypress._.random(1e6)}`
  })

  afterEach(() => {
    cy.deleteProjectsStartingWith(name)
  })

  it('rejects a project without a name', () => {
    cy.visitDesk()
    cy.contains('button', 'Add a project').first().click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', 'Add project').click()
      cy.contains('Enter a name.').should('be.visible')
      cy.contains('button', 'Cancel').click()
    })
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('adds, edits, moves, and removes a project', () => {
    cy.intercept('POST', '/api/projects').as('create')
    cy.intercept('PATCH', '/api/projects/*').as('update')
    cy.intercept('DELETE', '/api/projects/*').as('remove')

    cy.visitDesk()
    cy.contains('button', 'Add a project').first().click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains('label', 'Name').click()
      cy.focused().type(name)
      cy.contains('label', 'Note').click()
      cy.focused().type('Created by the scheduled Cypress run.')
      cy.contains('button', 'Add project').click()
    })
    cy.wait('@create').its('response.statusCode').should('eq', 201)
    cy.get('#column-sketch').closest('section').within(() => {
      cardFor(name).should('contain', 'Created by the scheduled Cypress run.')
    })

    cy.get(`button[aria-label="Edit ${name}"]`).click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains('Edit project').should('be.visible')
      cy.contains('label', 'Note').click()
      cy.focused().clear().type('Edited by the scheduled Cypress run.')
      cy.contains('button', 'Save changes').click()
    })
    cy.wait('@update').its('response.statusCode').should('eq', 200)
    cardFor(name).should('contain', 'Edited by the scheduled Cypress run.')

    cy.get(`button[aria-label="Status for ${name}"]`).click()
    cy.contains('[role="option"]', 'Building').click()
    cy.wait('@update').its('response.body.status').should('eq', 'building')
    cy.get('#column-building').closest('section').within(() => {
      cardFor(name).should('exist')
    })

    cy.get(`button[aria-label="Remove ${name}"]`).click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains('Remove this project?').should('be.visible')
      cy.contains('button', 'Remove').click()
    })
    cy.wait('@remove').its('response.statusCode').should('eq', 204)
    cy.contains('[data-slot="card-title"]', name).should('not.exist')
    cy.listProjects().then((projects) => {
      expect(projects.map((project) => project.name)).not.to.include(name)
    })
  })
})
