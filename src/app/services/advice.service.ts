// src/app/services/advice.service.ts
import { Injectable } from '@angular/core';
import { Card, Suit } from './game.service';

@Injectable({ providedIn: 'root' })
export class AdviceService {
  /**
   * Simple Trump decision logic:
   * - Count number of trump cards in hand (effective suit)
   * - If count >= threshold based on difficulty, recommend "order"
   */
  getTrumpAdvice(
    hand: Card[],
    kitty: Card,
    difficulty: 'easy' | 'medium' | 'hard'
  ): { action: 'order' | 'pass'; rationale: string } {
    const trump = kitty.suit;
    // Count trump cards (including left bower) in hand
    const trumpCount = hand.filter(c => {
      if (c.suit === trump) return true;
      // left bower: jack of same color
      const isRed = (s: Suit) => ['hearts','diamonds'].includes(s);
      if (c.rank === 'J' && isRed(c.suit) === isRed(trump)) return true;
      return false;
    }).length;

    // Set thresholds per difficulty
    const thresholds = { easy: 2, medium: 3, hard: 3 };
    const thresh = thresholds[difficulty] || 3;

    if (trumpCount >= thresh) {
      return {
        action: 'order',
        rationale: `You have ${trumpCount} trump cards (≥ ${thresh}), good chance to win.`
      };
    }

    return {
      action: 'pass',
      rationale: `Only ${trumpCount} trump cards (< ${thresh}), better to pass.`
    };
  }
}
