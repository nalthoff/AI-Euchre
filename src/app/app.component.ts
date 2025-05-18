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
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  autoAdvance = true;
}
