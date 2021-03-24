import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'elements-favorite-border-icon',
  templateUrl: './favorite-border.component.svg',
  styleUrls: ['./favorite-border.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoriteBorderIconComponent {}
