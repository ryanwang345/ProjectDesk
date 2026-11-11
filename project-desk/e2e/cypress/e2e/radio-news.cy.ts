describe('Local Radio News feature', () => {
  beforeEach(() => {
    cy.visit('/radio')
  })

  it('renders radio news stations and default broadcast', () => {
    cy.contains('h1', '本地英语广播电台').should('be.visible')
    cy.contains('button', 'Metro 98.5 FM').should('be.visible')
    cy.contains('button', 'BBC World Service 91.3 FM').should('be.visible')
    cy.contains('button', 'Eco-Horizon 104.2 FM').should('be.visible')
    cy.contains('button', 'Capital Culture 95.8 FM').should('be.visible')

    // Default broadcast header
    cy.contains('98.5 FM').should('be.visible')
    cy.contains('晨间都市简报：市民公共安全登记与商业步行街慢行系统').should('be.visible')
  })

  it('allows switching stations and categories', () => {
    cy.contains('button', 'Eco-Horizon 104.2 FM').click()
    cy.contains('104.2 FM').should('be.visible')
    cy.contains('前沿生态专栏：地下风道制冷科技与传统土管被动式散热').should('be.visible')

    // Filter category
    cy.contains('button', '全球生态').click()
    cy.contains('button', 'World Insight').should('be.visible')
  })

  it('provides player controls and interactive bilingual transcript with dictionary words', () => {
    // Check player audio controls
    cy.get('button[title*="播放"]').should('be.visible')
    cy.get('button[title*="快退"]').should('be.visible')
    cy.get('button[title*="快进"]').should('be.visible')

    // Check transcript segments
    cy.contains('电台原声同步文稿').should('be.visible')
    cy.contains('button', '双语对照').should('be.visible')

    // Check lexis spotlight
    cy.contains('电台重点词汇与考点').should('be.visible')
    cy.contains('theft').should('be.visible')
  })
})
