import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FavoriteIconComponent } from './favorite/favorite.component';
import { FavoriteBorderIconComponent } from './favorite-border/favorite-border.component';

@NgModule({
  declarations: [FavoriteIconComponent, FavoriteBorderIconComponent],
  imports: [CommonModule],
  exports: [FavoriteIconComponent, FavoriteBorderIconComponent],
})
export class IconsModule {}
