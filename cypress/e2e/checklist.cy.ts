describe("Smart Dynamic Checklist", () => {
  it("loads the builder and allows adding a step", () => {
    cy.visit("/")
    cy.contains("Checklist builder")
    cy.contains("+ Add step").click()
    cy.get("input").first().type("Test step")
    cy.contains("Test step")
  })

  it("switches to runner mode", () => {
    cy.visit("/")
    cy.contains("Runner mode").click()
    cy.contains("Checklist runner")
  })
})
