// src/app/services/game.service.ts
import { Injectable } from '@angular/core';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  public currentHands: Card[][] = [];
  public currentKitty: Card | null = null;
  public trump: Suit | null = null;
  public currentTrick: { player: number; card: Card }[] = [];
  // ← NEW: store the selected AI difficulty
  public difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  public currentLeader = 0;  // who leads each trick

  // Deal hands, set kitty & reset state
  dealHands(): Card[][] {
    const deck = this.createDeck();
    this.shuffle(deck);

    const hands: Card[][] = [[], [], [], []];
    for (let r = 0; r < 5; r++) {
      for (let p = 0; p < 4; p++) {
        hands[p].push(deck.pop()!);
      }
    }

    this.currentKitty = deck.pop()!;
    this.currentHands = hands;
    this.trump = null;
    this.currentTrick = [];
    this.currentLeader = 0;  // human leads first
    return hands;
  }

  orderUp(): void {
    if (this.currentKitty) {
      this.trump = this.currentKitty.suit;
    }
  }

  pass(): void {
    this.trump = null;
  }

  // Play a card and resolve the trick if all four have played
  playCard(player: number, card: Card): void {
    const hand = this.currentHands[player];
    const idx = hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
    if (idx < 0) return;

    hand.splice(idx, 1);
    this.currentTrick.push({ player, card });

    if (this.currentTrick.length === 4) {
      this.resolveTrick();
    }
  }

  // Resolve the current trick using Euchre rules & set next leader
  private resolveTrick(): void {
    if (this.currentTrick.length !== 4 || this.trump === null) return;

    // Determine effective lead suit (accounting for bowers)
    const leadCard = this.currentTrick[0].card;
    const leadSuit = this.getEffectiveSuit(leadCard, this.trump);

    // Find winning play
    let winningPlay = this.currentTrick[0];
    let highestWeight = this.getCardWeight(winningPlay.card, leadSuit, this.trump);

    for (let i = 1; i < 4; i++) {
      const play = this.currentTrick[i];
      const weight = this.getCardWeight(play.card, leadSuit, this.trump);
      if (weight > highestWeight) {
        highestWeight = weight;
        winningPlay = play;
      }
    }

    // Set next leader
    this.currentLeader = winningPlay.player;
    console.log(`Player ${winningPlay.player + 1} wins the trick`);

    // Clear trick after a brief pause
    setTimeout(() => {
      this.currentTrick = [];
    }, 1500);
  }

  // Determine the suit that counts, treating left/right bower as trump
  private getEffectiveSuit(card: Card, trump: Suit): Suit {
    // Right bower
    if (card.rank === 'J' && card.suit === trump) {
      return trump;
    }
    // Left bower (jack of same color)
    if (card.rank === 'J' && this.isSameColor(card.suit, trump)) {
      return trump;
    }
    return card.suit;
  }

  // Check if two suits share color
  private isSameColor(s1: Suit, s2: Suit): boolean {
    const red: Suit[] = ['hearts', 'diamonds'];
    return (red.includes(s1) && red.includes(s2)) || (!red.includes(s1) && !red.includes(s2));
  }

  // Assign numeric weight to a card given lead suit & trump
  private getCardWeight(card: Card, leadSuit: Suit, trump: Suit): number {
    const rankOrder: Record<Rank, number> = {
      '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5, 'A': 6
    };
    const effSuit = this.getEffectiveSuit(card, trump);

    // Trump cards highest
    if (effSuit === trump) {
      // Right bower (jack of trump)
      if (card.rank === 'J' && card.suit === trump) {
        return 100;
      }
      // Left bower (jack of same color)
      if (card.rank === 'J' && this.isSameColor(card.suit, trump)) {
        return 90;
      }
      // Other trump
      return 20 + rankOrder[card.rank];
    }

    // Follow‐suit if matching lead
    if (effSuit === leadSuit) {
      return 10 + rankOrder[card.rank];
    }

    // Off‐suit card, cannot win
    return 0;
  }

  // Create a standard 24-card Euchre deck
  private createDeck(): Card[] {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];
    for (const s of suits) {
      for (const r of ranks) {
        deck.push({ suit: s, rank: r });
      }
    }
    return deck;
  }

  // In-place Fisher–Yates shuffle
  private shuffle(deck: Card[]): void {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
}
