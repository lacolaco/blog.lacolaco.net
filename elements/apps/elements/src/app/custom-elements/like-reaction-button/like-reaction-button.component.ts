import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'elements-like-reaction-button',
  templateUrl: './like-reaction-button.component.html',
  styleUrls: ['./like-reaction-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LikeReactionButtonComponent {
  @Input()
  isLiked = false;

  @Input()
  count = 0;

  readonly likeCountPluralMap = {
    '=1': '1 like',
    other: '# likes',
  };
}
