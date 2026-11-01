describe('680 News live radio', () => {
  beforeEach(() => {
    cy.visit('/radio', {
      onBeforeLoad(win) {
        win.localStorage.setItem('projectdesk.locale', 'zh')
      },
    })
  })

  it('renders the station header, player and clock', () => {
    cy.contains('h1', '680 NewsRadio Toronto').should('be.visible')
    cy.contains('CFTR 680 AM').should('be.visible')
    cy.get('button[aria-label="收听 680 News 直播"]').should('be.visible')
    cy.contains('The 680 News Clock').should('be.visible')
  })

  it('switches clock segments and shows lexis and liaisons', () => {
    cy.contains('button', 'Top Headlines').first().click()
    cy.contains('Original broadcast transcript').should('be.visible')
    cy.contains('Liaisons & Reductions').should('be.visible')
    cy.contains('680 新闻高频词汇').should('be.visible')
  })

  it('toggles bilingual view', () => {
    cy.contains('button', '双语对照').click()
    cy.contains('button', '纯英沉浸').should('be.visible')
  })
})
