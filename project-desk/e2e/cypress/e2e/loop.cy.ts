import { E2E_PREFIX } from '../support/commands'

type Cycle = {
  id: string
  title: string
  updatedAt: string
}

const STALE_AFTER_MS = 60 * 60 * 1000

function deleteCyclesStartingWith(prefix: string) {
  if (!prefix.startsWith(E2E_PREFIX)) {
    throw new Error(`Refusing to delete cycles outside the ${E2E_PREFIX} prefix`)
  }
  cy.request<Cycle[]>('/api/cycles').then((response) => {
    for (const cycle of response.body.filter((item) => item.title.startsWith(prefix))) {
      cy.request('DELETE', `/api/cycles/${cycle.id}`)
    }
  })
}

describe('Project Desk loop', { tags: '@regression' }, () => {
  let title = ''

  before(() => {
    cy.request<Cycle[]>('/api/cycles').then((response) => {
      const cutoff = Date.now() - STALE_AFTER_MS
      for (const cycle of response.body) {
        if (cycle.title.startsWith(E2E_PREFIX) && Date.parse(cycle.updatedAt) < cutoff) {
          cy.request('DELETE', `/api/cycles/${cycle.id}`)
        }
      }
    })
  })

  beforeEach(() => {
    title = `${E2E_PREFIX} loop ${Date.now().toString(36)}-${Cypress._.random(1e6)}`
  })

  afterEach(() => {
    deleteCyclesStartingWith(title)
  })

  it('carries a signal through delivery into the next cycle', () => {
    const lesson = 'Move the paywall until after the first task.'

    cy.visit('/loop')
    cy.contains('h1', 'The loop').should('be.visible')
    cy.get('[aria-busy="true"]').should('not.exist')
    cy.contains('button', 'Start a cycle').click()
    cy.get('#cycle-title').type(title)
    cy.get('#cycle-signal').type('Activation fell after the paywall.')
    cy.contains('button', 'Add cycle').click()

    cy.contains('button[data-cycle-title]', title).should('be.visible')
    cy.contains('button', 'Deliver').click()
    cy.contains('label', 'Code commit').find('input').check()
    cy.contains('label', 'Tests').find('input').check()
    cy.contains('button', 'Save this cycle').click()
    cy.contains('button[data-cycle-title]', title).should('contain', 'Deliver')
    cy.contains('Inside 24 hours').should('be.visible')

    cy.contains('button', 'Rediscover').click()
    cy.get('#cycle-lesson').type(lesson)
    cy.contains('button', 'Start the next cycle').click()
    cy.get('#cycle-signal').should('have.value', lesson)
    cy.contains('button[data-cycle-title]', `Next: ${title}`).should('contain', 'Discover')
  })
})