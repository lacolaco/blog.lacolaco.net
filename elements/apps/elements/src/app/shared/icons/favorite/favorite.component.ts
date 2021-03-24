import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'elements-favorite-icon',
  templateUrl: './favorite.component.svg',
  styleUrls: ['./favorite.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoriteIconComponent {}
