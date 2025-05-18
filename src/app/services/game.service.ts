// src/app/services/game.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';            // ← import
import { CardUtils } from './card-utils.service';
import { AiOpponentService } from './ai-opponent.service';

// Type definitions for suits and ranks in Euchre
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';

// Card interface for a Euchre card
export interface Card {
  suit: Suit;
  rank: Rank;
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  constructor(private aiService: AiOpponentService) { }

  // Emits when a new hand is started
  public handStarted = new Subject<void>();

  // Current hands for each player (array of 4 hands)
  public currentHands: Card[][] = [];
  // The kitty card (face up card for trump selection)
  public currentKitty: Card | null = null;
  // The current trump suit
  public trump: Suit | null = null;
  // Cards played in the current trick
  public currentTrick: { player: number; card: Card }[] = [];
  // AI difficulty setting
  public difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  // Whether the dealer is awaiting a discard
  public awaitingDiscard = false;
  // Player index who leads the current trick
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

  // Log of game events for display
  public gameLog: string[] = [];

  // Suits available for selection in the second round
  public availableSuits: Suit[] = [];
  // Suit chosen in the second round
  public secondRoundChosenSuit: Suit | null = null;

  // Player index who called trump
  public trumpCaller: number | null = null;

  /** Number of tricks won by each player in the current hand */
  public tricksWon: number[] = [0, 0, 0, 0];

  /** Team scores: [team 0 (players 0 & 2), team 1 (players 1 & 3)] */
  public teamScores: number[] = [0, 0];

  /** Hand sizes at the start of the hand (for lone hand detection) */
  private handStartHandSizes: number[] = [0, 0, 0, 0];

  /**
   * Add a message to the game log, trimming if necessary.
   * @param msg The message to log
   */
  private logEvent(msg: string) {
    this.gameLog.push(msg);
    // Optionally limit log size
    if (this.gameLog.length > 100) this.gameLog.shift();
  }

  /**
   * Deal hands to all players, set the kitty, and reset state for a new hand.
   * Rotates the dealer, shuffles the deck, and deals 5 cards to each player.
   * @returns The hands dealt to each player
   */
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
    this.tricksWon = [0, 0, 0, 0];
    // Only reset scores if this is a new game, not a new hand
    if (!this.teamScores) this.teamScores = [0, 0];
    // Store hand sizes for lone hand detection
    this.handStartHandSizes = this.currentHands.map(h => h.length);

    return hands;
  }

  /**
   * Called when a player orders up the upcard (first round of trump selection).
   * Sets trump, gives the dealer the kitty card, and handles discard if needed.
   * @param player The player ordering up
   */
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

  /**
   * Called when a player chooses a suit in the second round of trump selection.
   * Sets trump to the chosen suit. Dealer does not pick up the kitty in this round.
   * @param player The player choosing trump
   * @param suit The suit chosen as trump
   */
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

  /**
   * Remove the chosen card from the dealer's hand after picking up the kitty.
   * @param card The card to discard
   */
  discard(card: Card): void {
    const hand = this.currentHands[0];
    const idx = hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
    if (idx >= 0) hand.splice(idx, 1);
    this.awaitingDiscard = false;
  }

  /**
   * Called when a player passes during the trump selection phase.
   * Handles advancing the order phase and forcing dealer to pick if needed.
   * @param player The player passing
   */
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

  /**
   * Play a card for a player and resolve the trick if all four have played.
   * @param player The player index
   * @param card The card to play
   */
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

  /**
   * Resolve the current trick using Euchre rules and set the next leader.
   * Determines the winner of the trick based on effective suit and card weight.
   * If all tricks are done, scores the hand.
   */
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
    this.tricksWon[winningPlay.player]++;
    this.logEvent(`Player ${winningPlay.player + 1} wins the trick`);

    // If all tricks for the hand are done, score the hand
    const handOver = this.currentHands.every(hand => hand.length === 0);
    if (handOver) {
      this.scoreHand();
    }
  }

  /**
   * Score the hand according to standard euchre rules.
   * - 1pt: makers win 3-4 tricks
   * - 2pt: makers win all 5 (march)
   * - 2pt: defenders win 3+ (euchre)
   * - 4pt: lone hand march (makers alone)
   * - 4pt: lone defender euchres lone maker
   *
   * Handles lone hand detection and updates team scores. Starts a new hand after scoring.
   */
  private scoreHand(): void {
    // Determine teams: 0 & 2 vs 1 & 3
    const team0Tricks = this.tricksWon[0] + this.tricksWon[2];
    const team1Tricks = this.tricksWon[1] + this.tricksWon[3];
    const maker = this.trumpCaller!;
    const makerTeam = maker % 2; // 0 for team 0, 1 for team 1
    const defenderTeam = 1 - makerTeam;
    const makerTricks = makerTeam === 0 ? team0Tricks : team1Tricks;
    const defenderTricks = defenderTeam === 0 ? team0Tricks : team1Tricks;
    // Lone hand detection: use handStartHandSizes snapshot
    const loneMaker = (this.handStartHandSizes[maker] === 5 && this.handStartHandSizes[(maker+2)%4] === 0);
    const loneDefender = (this.handStartHandSizes[defenderTeam] === 5 && this.handStartHandSizes[(defenderTeam+2)%4] === 0);

    let points = 0;
    let scoredTeam = makerTeam;
    let msg = '';
    if (makerTricks >= 3 && makerTricks < 5) {
      // Makers win 3 or 4
      points = 1;
      msg = `Makers (Team ${makerTeam+1}) score 1 point.`;
    } else if (makerTricks === 5) {
      // March
      if (loneMaker) {
        points = 4;
        msg = `Lone maker (Player ${maker+1}) wins all 5 tricks! Team ${makerTeam+1} scores 4 points.`;
      } else {
        points = 2;
        msg = `Makers (Team ${makerTeam+1}) win all 5 tricks (march) for 2 points.`;
      }
    } else if (defenderTricks >= 3) {
      // Euchre
      if (loneDefender) {
        points = 4;
        scoredTeam = defenderTeam;
        msg = `Lone defender (Player ${defenderTeam+1}) euchres the makers! Team ${defenderTeam+1} scores 4 points.`;
      } else {
        points = 2;
        scoredTeam = defenderTeam;
        msg = `Defenders (Team ${defenderTeam+1}) euchre the makers for 2 points.`;
      }
    }
    this.teamScores[scoredTeam] += points;
    this.logEvent(msg + ` [Score: ${this.teamScores[0]} - ${this.teamScores[1]}]`);
    // Optionally: check for game over (10 points)
    if (this.teamScores[scoredTeam] >= 10) {
      this.logEvent(`Team ${scoredTeam+1} wins the game!`);
      // Optionally: reset scores or show dialog
    }
    // Start new hand
    setTimeout(() => {
      this.dealHands();
    }, 2000);
  }

  /**
   * Create a standard 24-card Euchre deck (9-A in each suit).
   * @returns The deck as an array of Card objects
   */
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

  /**
   * Shuffle a deck of cards in place using the Fisher–Yates algorithm.
   * @param deck The deck to shuffle
   */
  private shuffle(deck: Card[]): void {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
}
