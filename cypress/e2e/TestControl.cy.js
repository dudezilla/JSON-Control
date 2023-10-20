describe('Controls', () => {
  it('TestControl - loads in browser without error', () => {
    cy.visit('http://localhost:3000/TestControl.html')
  })
  it('Browserify or Control the abtract class - loads in browser without error', () => {
    cy.visit('http://localhost:3000/browserify.html')
  })
  it('Boolean Control - loads in browser without error', () => {
    cy.visit('http://localhost:3000/BooleanControl.html')
  })
  it('Boolean Control - loads in browser without error', () => {
    cy.visit('http://localhost:3000/BooleanControl.html')
  })
  it('Cypress - VerboseBooleanControl -loads and truth values are accurate', () => {
    cy.visit('http://localhost:3000/Cypress.html')
    let selector = 'input#root__still_stats__still_stats'
    let textSelector = 'label#root__still_stats'
    cy.get(selector, { timeout: 2000 }).as('selected')
    cy.get(textSelector, { timeout: 2000 }).as('text')
    cy.get('@selected').should('not.be.checked')
    cy.get('@text').should('have.text', 'false')
    cy.get('@selected').click()
    cy.get('@selected').should('be.checked')
    cy.get('@text').should('have.text', 'true')
  })
})