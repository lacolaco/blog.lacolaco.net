import { Injector, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';

import { AppComponent } from './app.component';
import { CustomElementsModule } from './custom-elements/custom-elements.module';
import { LikeReactionButtonComponent } from './custom-elements/like-reaction-button/like-reaction-button.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, CustomElementsModule],
  providers: [],
})
export class AppModule {
  constructor(private readonly injector: Injector) {}
  ngDoBootstrap() {
    window.customElements.define(
      'like-reaction-button',
      createCustomElement(LikeReactionButtonComponent, {
        injector: this.injector,
      })
    );
  }
}
