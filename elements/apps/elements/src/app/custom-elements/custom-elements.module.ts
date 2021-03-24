import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LikeReactionButtonComponent } from './like-reaction-button/like-reaction-button.component';
import { IconsModule } from '../shared/icons/icons.module';

@NgModule({
  declarations: [LikeReactionButtonComponent],
  imports: [CommonModule, IconsModule],
  exports: [LikeReactionButtonComponent],
})
export class CustomElementsModule {}
