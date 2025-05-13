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
  
  // Deal hands **and** set the kitty
  dealHands(): Card[][] {
    const deck = this.createDeck();
    this.shuffle(deck);
    const hands: Card[][] = [[],[],[],[]];
    for (let round = 0; round < 5; round++) {
      for (let p = 0; p < 4; p++) {
        hands[p].push(deck.pop()!);
      }
    }
    // Flip up the next card as the kitty
    this.currentKitty = deck.pop()!;         
    this.currentHands = hands;
    this.trump = null;                       // reset any previous trump
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

  // Create a 24-card Euchre deck
  private createDeck(): Card[] {
    const suits: Suit[] = ['hearts','diamonds','clubs','spades'];
    const ranks: Rank[] = ['9','10','J','Q','K','A'];
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

  // // Deal 5 cards to each of 4 players, return an array of 4 hands
  // dealHands(): Card[][] {
  //   const deck = this.createDeck();
  //   this.shuffle(deck);
  //   const hands: Card[][] = [[], [], [], []];
  //   // deal 5 cards each
  //   for (let round = 0; round < 5; round++) {
  //     for (let player = 0; player < 4; player++) {
  //       hands[player].push(deck.pop()!);
  //     }
  //   }
  //   return hands;
  // }
}
