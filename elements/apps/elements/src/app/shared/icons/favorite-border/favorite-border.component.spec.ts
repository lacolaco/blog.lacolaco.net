import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FavoriteBorderIconComponent } from './favorite-border.component';

describe('FavoriteBorderComponent', () => {
  let component: FavoriteBorderIconComponent;
  let fixture: ComponentFixture<FavoriteBorderIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FavoriteBorderIconComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FavoriteBorderIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
