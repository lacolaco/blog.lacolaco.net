import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'elements-favorite-icon',
  templateUrl: './favorite.component.svg',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoriteIconComponent {}
