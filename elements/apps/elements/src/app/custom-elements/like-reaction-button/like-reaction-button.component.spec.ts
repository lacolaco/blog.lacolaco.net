import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LikeReactionButtonComponent } from './like-reaction-button.component';

describe('LikeReactionButtonComponent', () => {
  let component: LikeReactionButtonComponent;
  let fixture: ComponentFixture<LikeReactionButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LikeReactionButtonComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LikeReactionButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
