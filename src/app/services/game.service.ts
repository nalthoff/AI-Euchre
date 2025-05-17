// src/app/services/game.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';            // ← import
import { CardUtils } from './card-utils.service';
import { AiOpponentService } from './ai-opponent.service';


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
  constructor(private aiService: AiOpponentService) { }

  public handStarted = new Subject<void>();

  public currentHands: Card[][] = [];
  public currentKitty: Card | null = null;
  public trump: Suit | null = null;
  public currentTrick: { player: number; card: Card }[] = [];
  public difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  public awaitingDiscard = false;
  public currentLeader = 0;  // who leads each trick

  /** Emits after resolveTrick has cleared and is ready to start the next trick */
  public trickResolved = new Subject<void>();

  /** Index of current dealer (rotates each hand) */
  public dealerIndex = 0;
  /** 0 = no order phase, 1 = 1st round, 2 = 2nd round */
  public orderRound = 0;
  /** Whose turn it is to order/pass */
  public currentOrderPlayer = 0;
  /** How many seats left this round (4 in 1st round, 3 in 2nd) */
  public turnsLeft = 0;
  /** Suit turned down after 1st round pass */
  public turnedDownSuit: Suit | null = null;

  public gameLog: string[] = [];

  public availableSuits: Suit[] = [];
  public secondRoundChosenSuit: Suit | null = null;

  public trumpCaller: number | null = null;

  private logEvent(msg: string) {
    this.gameLog.push(msg);
    // Optionally limit log size
    if (this.gameLog.length > 100) this.gameLog.shift();
  }

  // Deal hands, set kitty & reset state
  dealHands(): Card[][] {
    // 1) Rotate dealer and reset discard state
    this.dealerIndex = (this.dealerIndex + 1) % 4;
    this.awaitingDiscard = false;

    // 2) Create and shuffle deck
    const deck = this.createDeck();
    this.shuffle(deck);

    // 3) Deal 5 cards to each player
    const hands: Card[][] = [[], [], [], []];
    for (let r = 0; r < 5; r++) {
      for (let p = 0; p < 4; p++) {
        hands[p].push(deck.pop()!);
      }
    }

    // 4) Set the kitty and initial state
    this.currentKitty = deck.pop()!;
    this.currentHands = hands;
    this.trump = null;
    this.currentTrick = [];

    // 5) Set the first leader to the left of the dealer
    this.currentLeader = (this.dealerIndex + 1) % 4;
    this.orderRound = 1;
    this.currentOrderPlayer = this.currentLeader;
    this.turnsLeft = 4;
    this.turnedDownSuit = null;

    this.gameLog = [];
    this.logEvent(`New hand dealt. Dealer: Player ${this.dealerIndex + 1}`);

    // let everyone know a new hand is on the table
    this.handStarted.next();

    this.availableSuits = ['hearts', 'diamonds', 'clubs', 'spades'];
    this.trumpCaller = null;

    return hands;
  }

  /** Called when `currentOrderPlayer` orders up */
  orderUpBy(player: number): void {
    if (!this.currentKitty) return;
    this.logEvent(`Player ${player + 1} orders up ${this.currentKitty.suit.toUpperCase()}`);

    // 1) Set trump to the up-card’s suit
    this.trump = this.currentKitty.suit;

    // 2) Dealer (not the caller) picks up the card
    this.currentHands[this.dealerIndex].push(this.currentKitty);

    // 3) If you’re the dealer, enter discard mode
    this.awaitingDiscard = (this.dealerIndex === 0);

    // AI dealer: auto-discard worst card
    if (this.dealerIndex !== 0 && this.currentHands[this.dealerIndex].length === 6) {
      const hand = this.currentHands[this.dealerIndex];
      // Use getCardWeight with trump as both leadSuit and trump for worst card
      let minWeight = Infinity;
      let minIdx = 0;
      for (let i = 0; i < hand.length; i++) {
        const w = CardUtils.getCardWeight(hand[i], this.trump, this.trump);
        if (w < minWeight) {
          minWeight = w;
          minIdx = i;
        }
      }
      const discarded = hand.splice(minIdx, 1)[0];
      this.logEvent(`Player ${this.dealerIndex + 1} discards ${discarded.rank} of ${discarded.suit}`);
    }

    // 4) Remove the kitty and end ordering
    this.currentKitty = null;
    this.orderRound = 0;
    this.trumpCaller = player;
  }

  /** Called when a player chooses a suit in 2nd round */
  orderUpSecondRound(player: number, suit: Suit): void {
    this.logEvent(`Player ${player + 1} orders up ${suit.toUpperCase()} (2nd round)`);
    this.trump = suit;
    this.secondRoundChosenSuit = suit;
    // Dealer does not pick up kitty in 2nd round
    this.awaitingDiscard = false;
    this.orderRound = 0;
    this.currentKitty = null;
    this.trumpCaller = player;
  }

  /** Remove chosen card from hand and continue play */
  discard(card: Card): void {
    const hand = this.currentHands[0];
    const idx = hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
    if (idx >= 0) hand.splice(idx, 1);
    this.awaitingDiscard = false;
  }

  /** Called when `currentOrderPlayer` passes */
  passBy(player: number): void {
    if (this.orderRound === 0) return;
    this.logEvent(`Player ${player + 1} passes`);
    this.turnsLeft--;
    if (this.turnsLeft > 0) {
      // Advance to next player (skip dealer in 2nd round)
      do {
        this.currentOrderPlayer = (this.currentOrderPlayer + 1) % 4;
      } while (this.orderRound === 2 && this.currentOrderPlayer === this.dealerIndex);
    } else {
      if (this.orderRound === 1) {
        // Turn down upcard → begin 2nd round
        this.turnedDownSuit = this.currentKitty?.suit ?? null;
        this.currentKitty = null;
        this.orderRound = 2;
        this.turnsLeft = 3;
        this.currentOrderPlayer = (this.dealerIndex + 1) % 4;
        // Remove the turned down suit from available suits
        this.availableSuits = (['hearts', 'diamonds', 'clubs', 'spades'].filter(s => s !== this.turnedDownSuit) as Suit[]);
      } else {
        // 2nd round all passed → dealer must order (force pick)
        this.orderRound = 0;
        // Forcing dealer to pick the first available suit
        const suit = this.availableSuits[0];
        this.orderUpSecondRound(this.dealerIndex, suit);
      }
    }
    // AUTO-PASS for AI seats (handled in processOrdering)
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
    this.logEvent(`Player ${winningPlay.player + 1} wins the trick`);

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
