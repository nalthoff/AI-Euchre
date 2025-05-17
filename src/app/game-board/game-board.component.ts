import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';            // ← import
import { GameService, Card } from '../services/game.service';
import { AiOpponentService } from '../services/ai-opponent.service';
import { AdviceService } from '../services/advice.service';
import { CardUtils } from '../services/card-utils.service';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss']
})

export class GameBoardComponent implements OnInit, OnDestroy {
  private sub = new Subscription();
  private handStartedsub = new Subscription();

  suitSymbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };

  flyingCard: { card: Card, fromSeat: number } | null = null;
  flyingCardAnimation = false;

  constructor(
    public gameSvc: GameService,
    private aiService: AiOpponentService,
    private adviceSvc: AdviceService
  ) { }

  ngOnInit() {
    // whenever a trick finishes, auto‐start the next one
    this.sub.add(
      this.gameSvc.trickResolved.subscribe(() => {
        this.startTrick();
      })
    )
    this.handStartedsub.add(
      this.gameSvc.handStarted.subscribe(() => this.processOrdering())
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    this.handStartedsub.unsubscribe();
  }

  // expose trick array for template
  get currentTrick() {
    return this.gameSvc.currentTrick;
  }


  /** After ordering up, user clicks a card to discard */
  onDiscardCard(card: Card): void {
    this.gameSvc.discard(card);
    this.startTrick();
  }

  // Called when user clicks one of their cards
  onCardClick(card: Card): void {
    // Only allow click if it's the human's turn
    const nextToPlay = (this.gameSvc.currentLeader + this.currentTrick.length) % 4;
    if (nextToPlay !== 0 || !this.gameSvc.trump) {
      return;
    }
    // Card validation: must follow suit if possible
    let leadSuit: string | null = null;
    if (this.currentTrick.length > 0 && this.gameSvc.trump) {
      leadSuit = CardUtils.getEffectiveSuit(this.currentTrick[0].card, this.gameSvc.trump);
    }
    const hand = this.gameSvc.currentHands[0];
    let validCards: Card[];
    if (leadSuit) {
      const followCards = hand.filter(
        c => CardUtils.getEffectiveSuit(c, this.gameSvc.trump!) === leadSuit
      );
      validCards = followCards.length > 0 ? followCards : [...hand];
    } else {
      validCards = [...hand];
    }
    // Only allow play if card is valid
    const isValid = validCards.some(c => c.rank === card.rank && c.suit === card.suit);
    if (!isValid) {
      // Optionally: provide feedback here (e.g., shake card, flash, etc.)
      return;
    }
    // Set flying card state before removing from hand
    this.flyingCard = { card, fromSeat: 0 };
    this.flyingCardAnimation = true;
    setTimeout(() => {
      this.flyingCardAnimation = false;
      this.flyingCard = null;
      this.gameSvc.playCard(0, card);
      this.continueAIMoves();
    }, 600); // Animation duration
  }

  // Begin a new trick: let AI start if leader isn't human
  private startTrick(): void {
    // make sure trick is clear (service just did that), then let AI lead if needed
    this.continueAIMoves();
  }

  // Let AI play in order until it's back to human (player 0) or trick is done
  private continueAIMoves(): void {

    while (this.gameSvc.currentTrick.length < 4) {
      const next = (this.gameSvc.currentLeader + this.gameSvc.currentTrick.length) % 4;
      if (next === 0) {
        // back to you—stop AI
        break;
      }

      const aiCard = this.aiService.getAIMove(
        next,
        this.gameSvc.currentHands,
        this.gameSvc.currentTrick,
        this.gameSvc.trump!,
        this.gameSvc.difficulty
      );

      // if *this* AI has no cards, the hand is truly over—stop all play
      if (!aiCard) {
        break;
      }
      // Animate AI card play
      this.flyingCard = { card: aiCard, fromSeat: next };
      this.flyingCardAnimation = true;
      setTimeout(() => {
        this.flyingCardAnimation = false;
        this.flyingCard = null;
        this.gameSvc.playCard(next, aiCard);
        // If that play filled the trick, let resolveTrick() finish then kick off next via trickResolved
        if (this.gameSvc.currentTrick.length < 4) {
          this.continueAIMoves();
        }
      }, 600);
      break;
    }
  }

  /** Clear the laid cards and start next trick on user click */
  onAdvanceTrick(): void {
    this.gameSvc.currentTrick = [];
    this.startTrick();
  }

  /** Start a fresh deal */
  restart(): void {
    // Preserve previously chosen difficulty
    this.gameSvc.dealHands();
    // If you want AI to lead immediately (e.g. if leader ≠ 0), kick off:
    this.startTrick();
  }

  // Dynamically return whatever the service currently has
  get hands(): Card[][] {
    return this.gameSvc.currentHands;
  }


  /** Human or AI orders up */
  onOrderAction(): void {
    this.gameSvc.orderUpBy(this.gameSvc.currentOrderPlayer);
    this.processOrdering();
  }

  /** Human or AI passes */
  onPassAction(): void {
    this.gameSvc.passBy(this.gameSvc.currentOrderPlayer);
    this.processOrdering();
  }

  get availableSuits() {
    return this.gameSvc.availableSuits;
  }

  // For 2nd round, store the suit the human selects
  selectedSecondRoundSuit: string | null = null;

  // Human selects a suit for the 2nd round of ordering
  onOrderSecondRound(suit: string) {
    this.gameSvc.orderUpSecondRound(0, suit as any);
    this.processOrdering();
  }

  /** Drive the entire order/pass flow, auto-invoking AI until it’s the human’s turn or order phase ends */
  private processOrdering(): void {
    // 2nd round: let AI pick a suit or pass
    while (this.gameSvc.orderRound > 0 && this.gameSvc.currentOrderPlayer !== 0) {
      if (this.gameSvc.orderRound === 2) {
        // AI picks best suit or passes
        let bestSuit: string | null = null;
        let bestScore = -1;
        for (const suit of this.gameSvc.availableSuits) {
          // Count trump cards in hand for this suit
          const hand = this.gameSvc.currentHands[this.gameSvc.currentOrderPlayer];
          const trumpCount = hand.filter(c => CardUtils.getEffectiveSuit(c, suit) === suit).length;
          if (trumpCount > bestScore) {
            bestScore = trumpCount;
            bestSuit = suit;
          }
        }
        // Simple AI: order if at least 2 trump, else pass
        if (bestScore >= 2 && bestSuit) {
          this.gameSvc.orderUpSecondRound(this.gameSvc.currentOrderPlayer, bestSuit as any);
        } else {
          this.gameSvc.passBy(this.gameSvc.currentOrderPlayer);
        }
      } else {
        // 1st round: use existing advice logic
        const advice = this.adviceSvc.getTrumpAdvice(
          this.gameSvc.currentHands[this.gameSvc.currentOrderPlayer],
          this.gameSvc.currentKitty!,
          this.gameSvc.difficulty
        );
        if (advice.action === 'order') {
          this.gameSvc.orderUpBy(this.gameSvc.currentOrderPlayer);
        } else {
          this.gameSvc.passBy(this.gameSvc.currentOrderPlayer);
        }
      }
    }

    // If the dealer ordered up, we’re now awaiting discard – stop here
    if (this.gameSvc.awaitingDiscard) {
      return;
    }

    // Once orderPhase is 0 and we’re not awaiting discard, start play
    if (this.gameSvc.orderRound === 0) {
      this.startTrick();
    }
  }

  get gameLog() {
    return this.gameSvc.gameLog;
  }

  // Utility: get the played card for a seat (0=bottom, 1=left, 2=top, 3=right)
  getTrickCard(seat: number) {
    return this.currentTrick.find(play => play.player === seat)?.card;
  }

  // Returns the list of valid cards the human can play (for highlighting)
  get validPlayableCards(): Card[] {
    // Only relevant if it's the human's turn and not discarding
    const nextToPlay = (this.gameSvc.currentLeader + this.currentTrick.length) % 4;
    if (nextToPlay !== 0 || !this.gameSvc.trump || this.gameSvc.awaitingDiscard) {
      return [];
    }
    let leadSuit: string | null = null;
    if (this.currentTrick.length > 0 && this.gameSvc.trump) {
      leadSuit = CardUtils.getEffectiveSuit(this.currentTrick[0].card, this.gameSvc.trump);
    }
    const hand = this.gameSvc.currentHands[0];
    if (!hand) return [];
    if (leadSuit) {
      const followCards = hand.filter(
        c => CardUtils.getEffectiveSuit(c, this.gameSvc.trump!) === leadSuit
      );
      return followCards.length > 0 ? followCards : [...hand];
    } else {
      return [...hand];
    }
  }

  // Used in template to check if a card is valid to play
  isCardValidToPlay(card: Card): boolean {
    return this.validPlayableCards.some(c => c.rank === card.rank && c.suit === card.suit);
  }

  // Used in *ngFor trackBy for cards
  trackCard(index: number, card: Card): string {
    return card.suit + '-' + card.rank;
  }

}