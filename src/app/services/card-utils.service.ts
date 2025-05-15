// card-utils.ts
import { Card, Suit, Rank } from './game.service';

export class CardUtils {
  /** Map ranks to their numeric strength. */
  static rankOrder: Record<Rank, number> = {
    '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5, 'A': 6
  };

  /** Whether two suits are the same color. */
  static isSameColor(s1: Suit, s2: Suit): boolean {
    const red: Suit[] = ['hearts', 'diamonds'];
    return (red.includes(s1) && red.includes(s2))
        || (!red.includes(s1) && !red.includes(s2));
  }

  /** 
   * Treats left/right bowers as trump.  
   * (Jack of trump suit or same-color jack) 
   */
  static getEffectiveSuit(card: Card, trump: Suit): Suit {
    if (card.rank === 'J' && card.suit === trump) return trump;
    if (card.rank === 'J' && this.isSameColor(card.suit, trump)) return trump;
    return card.suit;
  }

  /** Returns a numeric weight so higher cards outrank lower ones. */
  static getCardWeight(card: Card, leadSuit: Suit | null, trump: Suit): number {
    const eff = this.getEffectiveSuit(card, trump);
    if (eff === trump) {
      if (card.rank === 'J' && card.suit === trump)             return 100;
      if (card.rank === 'J' && this.isSameColor(card.suit, trump)) return  90;
      return 20 + this.rankOrder[card.rank];
    }
    if (leadSuit && eff === leadSuit) {
      return 10 + this.rankOrder[card.rank];
    }
    return 0;
  }
}
