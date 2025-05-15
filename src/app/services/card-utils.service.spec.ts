import { TestBed } from '@angular/core/testing';

import { CardUtilsService } from './card-utils.service';

describe('CardUtilsService', () => {
  let service: CardUtilsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CardUtilsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
