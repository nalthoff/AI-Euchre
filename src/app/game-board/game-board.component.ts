import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';            // ← import
import { GameService, Card } from '../services/game.service';
import { AiOpponentService } from '../services/ai-opponent.service';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss']
})

export class GameBoardComponent implements OnInit, OnDestroy {

  private sub = new Subscription();

  suitSymbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };

  constructor(
    public gameSvc: GameService,
    private aiService: AiOpponentService
  ) { }

  ngOnInit() {
    // whenever a trick finishes, auto‐start the next one
    this.sub.add(
      this.gameSvc.trickResolved.subscribe(() => {
        this.startTrick();
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  // expose trick array for template
  get currentTrick() {
    return this.gameSvc.currentTrick;
  }

  /** Called when the user clicks “Order Up” */
  onOrderUp(): void {
    this.gameSvc.orderUp();
    this.startTrick();
  }

  /** Called when the user clicks “Pass” */
  onPass(): void {
    this.gameSvc.pass();
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
}