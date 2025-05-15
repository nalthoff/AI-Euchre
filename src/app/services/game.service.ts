// src/app/services/game.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';            // ← import
import { CardUtils } from './card-utils.service';


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

  /** Emits after resolveTrick has cleared and is ready to start the next trick */
  public trickResolved = new Subject<void>();   // ← new

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
  
    // 1) Determine the effective lead suit (accounting for bowers)
    const leadCard = this.currentTrick[0].card;
    const leadSuit = CardUtils.getEffectiveSuit(leadCard, this.trump);
  
    // 2) Initialize winner as the first play
    let winningPlay = this.currentTrick[0];
    let highestWeight = CardUtils.getCardWeight(winningPlay.card, leadSuit, this.trump);
  
    // 3) Loop the rest to find any stronger play
    for (let i = 1; i < 4; i++) {
      const play = this.currentTrick[i];
      const weight = CardUtils.getCardWeight(play.card, leadSuit, this.trump);
      if (weight > highestWeight) {
        highestWeight = weight;
        winningPlay = play;
      }
    }
  
    // 4) Set the leader for the next trick
    this.currentLeader = winningPlay.player;
    console.log(`Player ${winningPlay.player + 1} wins the trick`);
  
    // 5) After a short pause, clear the trick and notify listeners
    // setTimeout(() => {
    //   this.currentTrick = [];
    //   this.trickResolved.next();
    // }, 1500);
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
