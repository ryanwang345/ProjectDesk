import { E2E_PREFIX } from '../support/commands'

// Exercises the AI loop with the demo provider, which answers offline and
// labels everything simulated. The run creates its own provider and cycle
// under the e2e prefix and removes them afterwards. If the target server
// requires PROJECT_DESK_ADMIN_TOKEN, pass it as E2E_ADMIN_TOKEN.

type Cycle = { id: string; title: string; updatedAt: string; workflowState: string }
type Provider = { id: string; name: string; isDefault: boolean }

let adminToken = ''
const adminHeaders = () => (adminToken ? { Authorization: `Bearer ${adminToken}` } : {})

describe('Project Desk AI loop', { tags: '@regression' }, () => {
  const providerName = `${E2E_PREFIX} demo provider`
  let title = ''
  let providerId = ''
  let previousDefault: string | null = null

  before(() => {
    cy.env<{ ADMIN_TOKEN?: string }>(['ADMIN_TOKEN']).then(({ ADMIN_TOKEN }) => {
      adminToken = ADMIN_TOKEN ?? ''
    })
    cy.request<Provider[]>('/api/providers').then((response) => {
      previousDefault = response.body.find((p) => p.isDefault)?.id ?? null
      for (const stale of response.body.filter((p) => p.name === providerName)) {
        cy.request({ method: 'DELETE', url: `/api/providers/${stale.id}`, headers: adminHeaders() })
      }
    })
    cy.request<Provider>({
      method: 'POST',
      url: '/api/providers',
      headers: adminHeaders(),
      body: { name: providerName, kind: 'demo', model: 'demo-deterministic', isDefault: true },
    }).then((response) => {
      providerId = response.body.id
    })
  })

  after(() => {
    cy.request<Cycle[]>('/api/cycles').then((response) => {
      for (const cycle of response.body.filter((c) => c.title.startsWith(`${E2E_PREFIX} ai`))) {
        cy.request('DELETE', `/api/cycles/${cycle.id}`)
      }
    })
    if (previousDefault && previousDefault !== providerId) {
      cy.request<Provider[]>('/api/providers').then((response) => {
        const restore = response.body.find((p) => p.id === previousDefault)
        if (restore) {
          cy.request({ method: 'PATCH', url: `/api/providers/${restore.id}`, headers: adminHeaders(), body: { ...restore, isDefault: true } })
        }
      })
    }
    if (providerId) {
      cy.request({ method: 'DELETE', url: `/api/providers/${providerId}`, headers: adminHeaders(), failOnStatusCode: false })
    }
  })

  beforeEach(() => {
    title = `${E2E_PREFIX} ai ${Date.now().toString(36)}-${Cypress._.random(1e6)}`
  })

  it('analyzes a signal, approves it, and generates a specification', () => {
    cy.visit('/loop')
    cy.contains('h1', 'The loop').should('be.visible')
    cy.get('[aria-busy="true"]').should('not.exist')
    cy.contains('button', 'Start a cycle').click()
    cy.get('#cycle-title').type(title)
    cy.get('#cycle-signal').type('The Search button renders unstyled in production but not in staging.')
    cy.contains('button', 'Add cycle').click()
    cy.contains('button[data-cycle-title]', title).should('be.visible')

    // Discover: Analyze with AI, then review hypotheses that are labeled as such.
    cy.get('[data-testid="ai-panel"]').within(() => {
      cy.contains('button', 'Analyze with AI').click()
    })
    cy.get('[data-testid="analysis-review"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="analysis-review"]').within(() => {
      cy.contains('Hypotheses (not confirmed)').should('be.visible')
      cy.contains('Simulated').should('be.visible')
      cy.contains('Proposed score 68').should('be.visible')
      cy.contains('button', 'Approve analysis').click()
    })

    // Approval applied the score and moved the cycle to Deliver.
    cy.get('[data-testid="analysis-review"]').should('not.exist')
    cy.contains('button[data-cycle-title]', title).should('contain', 'Deliver')
    cy.contains('button', 'Discover').click()
    cy.get('#cycle-score').should('have.value', '68')
    cy.get('#cycle-finding').should('contain.value', 'Hypothesis:')

    // Deliver: generate and approve a specification.
    cy.get('[data-testid="ai-panel"]').within(() => {
      cy.contains('button', 'Generate specification').click()
    })
    cy.get('[data-testid="artifact-specification"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="artifact-specification"]').within(() => {
      cy.contains('Specification v1').should('be.visible')
      cy.contains('Acceptance criteria').should('be.visible')
      cy.contains('button', 'Approve specification').click()
    })
    cy.get('[data-testid="artifact-specification"]').should('not.exist')
    cy.get('[data-testid="ai-panel"]').within(() => {
      cy.contains('button', 'Generate implementation plan').should('be.visible')
    })

    // The audit trail recorded the approvals.
    cy.request<Cycle[]>('/api/cycles').then((response) => {
      const cycle = response.body.find((c) => c.title === title)
      expect(cycle, 'cycle exists').to.not.equal(undefined)
      expect(cycle?.workflowState).to.equal('PLANNING')
      cy.request(`/api/events?cycle=${cycle?.id}&limit=50`).its('body').then((events: { kind: string }[]) => {
        const kinds = events.map((e) => e.kind)
        expect(kinds).to.include('analysis.approved')
        expect(kinds).to.include('artifact.approved')
      })
    })
  })

  it('keeps provider keys on the server and tests a connection', () => {
    cy.visit('/ai/settings')
    cy.contains('h1', 'AI settings').should('be.visible')
    cy.contains('[data-testid="provider-card"]', providerName).should('contain', 'Simulated')
    cy.contains('button', 'Add provider').click()
    cy.get('[data-testid="provider-form"]').within(() => {
      cy.get('#provider-name').type(`${providerName} form`)
      cy.get('#provider-kind').select('demo')
      cy.contains('button', 'Test connection').click()
    })
    cy.get('[data-testid="provider-test-result"]').should('contain', 'Connected').and('contain', 'simulated')
    cy.request<Provider[]>('/api/providers').then((response) => {
      for (const p of response.body) {
        expect(p).to.not.have.property('apiKey')
      }
    })
  })
})
