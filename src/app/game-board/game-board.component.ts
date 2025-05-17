import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';            // ← import
import { GameService, Card } from '../services/game.service';
import { AiOpponentService } from '../services/ai-opponent.service';
import { AdviceService } from '../services/advice.service.service';

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
    this.gameSvc.playCard(0, card);
    this.continueAIMoves();
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
      this.gameSvc.playCard(next, aiCard);

      // if that play filled the trick, let resolveTrick() finish then kick off next via trickResolved
      if (this.gameSvc.currentTrick.length === 4) {
        break;
      }
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


  /** Drive the entire order/pass flow, auto-invoking AI until it’s the human’s turn or order phase ends */
  private processOrdering(): void {
    // Continue AI turns while in order phase and it's not the human's turn
    while (this.gameSvc.orderRound > 0 && this.gameSvc.currentOrderPlayer !== 0) {
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

}