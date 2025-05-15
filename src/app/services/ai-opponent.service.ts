import { Injectable } from '@angular/core';
import { Card, Suit, Rank } from './game.service';
import { CardUtils } from './card-utils.service';

@Injectable({ providedIn: 'root' })
export class AiOpponentService {
  // Rank order mapping for weight calculations
  private rankOrder: Record<Rank, number> = {
    '9': 1,
    '10': 2,
    'J': 3,
    'Q': 4,
    'K': 5,
    'A': 6
  };

  /**
   * Returns an AI move based on difficulty:
   * - easy: random valid play
   * - medium: follow-suit heuristic (lowest winning card)
   * - hard: partner signaling + weight-based lookahead
   */
  getAIMove(
    playerIndex: number,
    hands: Card[][],
    currentTrick: { player: number; card: Card }[],
    trump: Suit | null,
    difficulty: 'easy' | 'medium' | 'hard'
  ): Card {
    const hand = hands[playerIndex];
    if (!hand || hand.length === 0) {
      throw new Error(`Player ${playerIndex} has no cards left`);
    }

    // Determine effective lead suit, if any
    let leadSuit: Suit | null = null;
    if (currentTrick.length > 0 && trump) {
      leadSuit = CardUtils.getEffectiveSuit(currentTrick[0].card, trump);
    }

    // Determine valid cards (must follow suit if possible)
    let validCards: Card[];
    if (leadSuit) {
      const followCards = hand.filter(
        c => CardUtils.getEffectiveSuit(c, trump!) === leadSuit
      );
      validCards = followCards.length > 0 ? followCards : [...hand];
    } else {
      // Leading: any card
      validCards = [...hand];
    }

    let choice: Card;

    if (difficulty === 'easy') {
      // Random choice
      choice = validCards[Math.floor(Math.random() * validCards.length)];

    } else if (difficulty === 'medium') {
      // Play lowest-weight card among valid
      let minWeight = Infinity;
      choice = validCards[0];
      for (const c of validCards) {
        const w = CardUtils.getCardWeight(c, leadSuit, trump!);
        if (w < minWeight) {
          minWeight = w;
          choice = c;
        }
      }

    } else {
      // Hard difficulty
      // Partner signaling: if leading and partner has strong trump, lead high trump
      if (currentTrick.length === 0 && playerIndex === 2 && trump) {
        const trumpCards = hand.filter(
          c => CardUtils.getEffectiveSuit(c, trump) === trump
        );
        if (trumpCards.length >= 3) {
          // choose highest trump
          choice = trumpCards.reduce((a, b) =>
            this.rankOrder[a.rank] > this.rankOrder[b.rank] ? a : b
          );
          return choice;
        }
      }

      // Lookahead: pick highest-weight card to win trick
      let maxWeight = -Infinity;
      choice = validCards[0];
      for (const c of validCards) {
        const w = CardUtils.getCardWeight(c, leadSuit, trump!);
        if (w > maxWeight) {
          maxWeight = w;
          choice = c;
        }
      }
    }

    return choice;
  }

}
