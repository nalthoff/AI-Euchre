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
  public currentKitty: Card | null = null;   // ← new
  public trump: Suit | null = null;          // ← new
  // NEW: track the cards played this trick
  public currentTrick: { player: number; card: Card }[] = [];

    // ← NEW: store the selected AI difficulty
    public difficulty: 'easy' | 'medium' | 'hard' = 'medium';
    
  // Deal hands **and** set the kitty
  dealHands(): Card[][] {
    const deck = this.createDeck();
    this.shuffle(deck);
    const hands: Card[][] = [[], [], [], []];
    for (let round = 0; round < 5; round++) {
      for (let p = 0; p < 4; p++) {
        hands[p].push(deck.pop()!);
      }
    }
    // Flip up the next card as the kitty
    this.currentKitty = deck.pop()!;
    this.currentHands = hands;
    this.trump = null;                       // reset any previous trump
    this.currentTrick = [];    // reset trick
    return hands;
  }

  // Called when the user “Orders Up” the kitty suit
  orderUp(): void {
    if (this.currentKitty) {
      this.trump = this.currentKitty.suit;
    }
  }

  // Called when the user “Passes”
  pass(): void {
    this.trump = null;
  }

  // NEW: play a card from `player` into the trick
  playCard(player: number, card: Card): void {
    const hand = this.currentHands[player];
    const idx = hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
    if (idx === -1) { return; }
    hand.splice(idx, 1);
    this.currentTrick.push({ player, card });
    // once 4 cards are played, resolve trick
    if (this.currentTrick.length === 4) {
      this.resolveTrick();
    }
  }

  // VERY BASIC stub — replace with full rule logic later
  private resolveTrick(): void {
    // pick winner (for now, first player)
    const winner = this.currentTrick[0].player;
    console.log(`Trick won by player ${winner + 1}`);
    // reset trick after short delay
    setTimeout(() => {
      this.currentTrick = [];
    }, 1500);
  }
  // Create a 24-card Euchre deck
  private createDeck(): Card[] {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];
    for (let s of suits) {
      for (let r of ranks) {
        deck.push({ suit: s, rank: r });
      }
    }
    return deck;
  }

  // Fisher–Yates shuffle
  private shuffle(deck: Card[]): void {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

}
