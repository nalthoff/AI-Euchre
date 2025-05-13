import { TestBed } from '@angular/core/testing';

import { AiOpponentService } from './ai-opponent.service';

describe('AiOpponentService', () => {
  let service: AiOpponentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiOpponentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
