import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService, Card } from '../services/game.service';
import { AiOpponentService } from '../services/ai-opponent.service';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss']
})

export class GameBoardComponent {

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

  // expose trick array for template
  get currentTrick() {
    return this.gameSvc.currentTrick;
  }

  // NEW: when user clicks their card
  onCardClick(card: Card): void {
    if (!this.gameSvc.trump) { return; }
    // 1) Your play
    this.gameSvc.playCard(0, card);

    // 2) AI plays for players 1–3 in order
    for (let p = 1; p < 4; p++) {
      const aiCard = this.aiService.getAIMove(
        p,
        this.gameSvc.currentHands,
        this.gameSvc.currentTrick,
        this.gameSvc.trump!,
        this.gameSvc.difficulty
      );
      this.gameSvc.playCard(p, aiCard);
    }
  }
  
  // Dynamically return whatever the service currently has
  get hands(): Card[][] {
    return this.gameSvc.currentHands;
  }
}