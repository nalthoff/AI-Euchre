import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';                   // for ngModel
import { NewGameComponent } from './new-game/new-game.component';
import { GameBoardComponent } from './game-board/game-board.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,                // ngModel binding
    NewGameComponent,           // <app-new-game>
    GameBoardComponent          // <app-game-board>
  ],
  template: `
    <div class="app-container">
      <app-new-game></app-new-game>
      <app-game-board></app-game-board>
    </div>
  `
})
export class AppComponent {}
