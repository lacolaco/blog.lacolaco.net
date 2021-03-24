import { mount } from "@jscutlery/cypress-mount";
import { AppComponent } from "@apps/elements/app/app.component";

describe("AppComponent", () => {
  beforeEach(() => {
    mount(AppComponent);
  });

  test("works", () => {
    cy.contains("Welcome");
  });
});
