import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'elements-favorite-border-icon',
  templateUrl: './favorite-border.component.svg',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoriteBorderIconComponent {}
