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
  constructor(private gameSvc: GameService) {}

  // Dynamically return whatever the service currently has
  get hands(): Card[][] {
    return this.gameSvc.currentHands;
  }
}
