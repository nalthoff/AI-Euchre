import { Injectable } from '@angular/core';
import { Card, Suit } from './game.service';

@Injectable({ providedIn: 'root' })
export class AiOpponentService {
  /**
   * Very basic stub: just plays the first card.
   * In future, use trump, follow-suit, and this.difficulty to pick better.
   */
  getAIMove(
    playerIndex: number,
    hands: Card[][],
    currentTrick: { player: number; card: Card }[],
    trump: Suit | null,
    difficulty: 'easy' | 'medium' | 'hard'
  ): Card {
    return hands[playerIndex][0];
  }
}
