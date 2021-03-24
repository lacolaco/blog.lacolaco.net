import { mount } from '@jscutlery/cypress-mount';
import { CustomElementsModule } from '@apps/elements/app/custom-elements/custom-elements.module';
import { LikeReactionButtonComponent } from '@apps/elements/app/custom-elements/like-reaction-button/like-reaction-button.component';

describe('LikeReactionButton', () => {
  test('favorite_border icon is rendered by default', () => {
    mount(LikeReactionButtonComponent, { imports: [CustomElementsModule] });

    cy.get('elements-favorite-border-icon');
  });

  test('favorite icon is rendered when already liked', () => {
    mount(LikeReactionButtonComponent, {
      imports: [CustomElementsModule],
      inputs: {
        isLiked: true,
      },
    });

    cy.get('elements-favorite-icon');
  });

  describe('liked count', () => {
    test('liked count is not rendered if count is 0', () => {
      mount(LikeReactionButtonComponent, {
        imports: [CustomElementsModule],
        inputs: {
          isLiked: false,
          count: 0,
        },
      });

      cy.contains('like').should('not.exist');
    });

    test('"1 like" is rendered if count is 1', () => {
      mount(LikeReactionButtonComponent, {
        imports: [CustomElementsModule],
        inputs: {
          isLiked: false,
          count: 1,
        },
      });

      cy.contains('1 like');
    });

    test('"2 likes" is rendered if count is 2', () => {
      mount(LikeReactionButtonComponent, {
        imports: [CustomElementsModule],
        inputs: {
          isLiked: false,
          count: 2,
        },
      });

      cy.contains('2 like');
    });
  });
});
