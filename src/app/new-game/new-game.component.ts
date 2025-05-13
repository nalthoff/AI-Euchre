import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';    // ← import CommonModule
import { FormsModule } from '@angular/forms';     // ← import FormsModule
import { GameService } from '../services/game.service';

@Component({
  selector: 'app-new-game',
  standalone: true,
  imports: [
    CommonModule,                                // ← so you can use *ngIf, *ngFor if needed
    FormsModule                                  // ← so [(ngModel)] works
  ],
  templateUrl: './new-game.component.html',
  styleUrls: ['./new-game.component.scss']
})
export class NewGameComponent {
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  constructor(private gameSvc: GameService) {}

  startGame(): void {
    const hands = this.gameSvc.dealHands();
    this.gameSvc.currentHands = hands;
  }
}
