import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService, Card } from '../services/game.service';

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

  constructor(public gameSvc: GameService) { }

  // expose trick array for template
  get currentTrick() {
    return this.gameSvc.currentTrick;
  }

  // NEW: when user clicks their card
  onCardClick(card: Card): void {
    if (!this.gameSvc.trump) { return; } // disable before trump
    this.gameSvc.playCard(0, card);
  }
  // Dynamically return whatever the service currently has
  get hands(): Card[][] {
    return this.gameSvc.currentHands;
  }
}