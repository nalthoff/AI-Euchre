import { Component, OnInit, OnDestroy, Input } from '@angular/core';
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
  @Input() autoAdvance = true;

  private readonly sub = new Subscription();
  private readonly handStartedsub = new Subscription();
  private autoAdvanceTimeout: any = null;

  readonly suitSymbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };

  flyingCard: { card: Card, fromSeat: number } | null = null;
  flyingCardAnimation = false;

  public showLog = false;
  public showEndRound = false;
  public endRoundMessage = '';

  public get decisionMessages(): (string|null)[] {
    return this._decisionMessages;
  }
  private _decisionMessages: (string|null)[] = [null, null, null, null];
  private decisionTimeouts: any[] = [null, null, null, null];

  constructor(
    public readonly gameSvc: GameService,
    private readonly aiService: AiOpponentService,
    private readonly adviceSvc: AdviceService
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
    // Listen for end of hand to show summary
    this.sub.add(
      this.gameSvc.handStarted.subscribe(() => {
        this.showEndRound = false;
      })
    );
    // Listen for hand end (scoreHand triggers new hand after delay)
    const origScoreHand = (this.gameSvc as any).scoreHand?.bind(this.gameSvc);
    if (origScoreHand) {
      (this.gameSvc as any).scoreHand = (...args: any[]) => {
        // Capture previous scores before scoring
        const prevScores = [
          this.gameSvc.teamScores[0],
          this.gameSvc.teamScores[1]
        ];
        origScoreHand(...args);
        this.prepareEndRoundSummary(prevScores);
      };
    }
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    this.handStartedsub.unsubscribe();
    if (this.autoAdvanceTimeout) {
      clearTimeout(this.autoAdvanceTimeout);
    }
  }

  // expose trick array for template
  get currentTrick() {
    // If trick is full, start auto-advance timer if enabled
    if (this.gameSvc.currentTrick.length === 4) {
      if (this.autoAdvance && !this.autoAdvanceTimeout) {
        this.autoAdvanceTimeout = setTimeout(() => {
          this.onAdvanceTrick();
        }, 5000);
      }
    }
    // If trick is not full or autoAdvance is off, clear any pending timer
    if ((this.gameSvc.currentTrick.length < 4 || !this.autoAdvance) && this.autoAdvanceTimeout) {
      clearTimeout(this.autoAdvanceTimeout);
      this.autoAdvanceTimeout = null;
    }
    return this.gameSvc.currentTrick;
  }


  /** After ordering up, user clicks a card to discard */
  onDiscardCard(card: Card): void {
    this.gameSvc.discard(card);
    this.startTrick();
  }

  /**
   * Utility to get valid cards for a player (default: human)
   */
  private getValidPlayableCards(player: number = 0): Card[] {
    const nextToPlay = (this.gameSvc.currentLeader + this.gameSvc.currentTrick.length) % 4;
    if (nextToPlay !== player || !this.gameSvc.trump || this.gameSvc.awaitingDiscard) {
      return [];
    }
    let leadSuit: string | null = null;
    if (this.gameSvc.currentTrick.length > 0 && this.gameSvc.trump) {
      leadSuit = CardUtils.getEffectiveSuit(this.gameSvc.currentTrick[0].card, this.gameSvc.trump);
    }
    const hand = this.gameSvc.currentHands[player];
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

  // Called when user clicks one of their cards
  onCardClick(card: Card): void {
    const validCards = this.getValidPlayableCards(0);
    const isValid = validCards.some(c => c.rank === card.rank && c.suit === card.suit);
    if (!isValid) return;
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
      // Check if this AI has any cards left
      const hand = this.gameSvc.currentHands[next];
      if (!hand || hand.length === 0) {
        // Hand is over, stop AI
        break;
      }
      const aiCard = this.aiService.getAIMove(
        next,
        this.gameSvc.currentHands,
        this.gameSvc.currentTrick,
        this.gameSvc.trump!,
        this.gameSvc.difficulty
      );
      // Animate AI card play
      this.flyingCard = { card: aiCard, fromSeat: next };
      this.flyingCardAnimation = true;
      setTimeout(() => {
        this.flyingCardAnimation = false;
        this.flyingCard = null;
        this.gameSvc.playCard(next, aiCard);
        if (this.gameSvc.currentTrick.length < 4) {
          this.continueAIMoves();
        }
      }, 600);
      break;
    }
  }

  showDecisionMessage(player: number, msg: string) {
    this._decisionMessages[player] = msg;
    if (this.decisionTimeouts[player]) {
      clearTimeout(this.decisionTimeouts[player]);
    }
    // Defensive: auto-clear after 2s in case
    this.decisionTimeouts[player] = setTimeout(() => this.clearDecisionMessage(player), 2000);
  }

  clearDecisionMessage(player: number) {
    this._decisionMessages[player] = null;
    if (this.decisionTimeouts[player]) {
      clearTimeout(this.decisionTimeouts[player]);
      this.decisionTimeouts[player] = null;
    }
  }

  /** Clear the laid cards and start next trick on user click */
  onAdvanceTrick(): void {
    if (this.autoAdvanceTimeout) {
      clearTimeout(this.autoAdvanceTimeout);
      this.autoAdvanceTimeout = null;
    }
    this.gameSvc.currentTrick = [];
    this.startTrick();
  }

  /** Start a fresh deal */
  restart(): void {
    // Preserve previously chosen difficulty
    this.gameSvc.dealHands();
    // Do NOT call this.startTrick() here; let the ordering phase begin naturally
  }

  /** Human or AI orders up */
  onOrderAction(): void {
    const player = this.gameSvc.currentOrderPlayer;
    const isHuman = player === 0;
    this.gameSvc.orderUpBy(player);
    this.showDecisionMessage(player, isHuman ? 'You ordered up' : 'Ordered up');
    setTimeout(() => {
      this.clearDecisionMessage(player);
      this.processOrdering();
    }, 1000);
  }

  /** Human or AI passes */
  onPassAction(): void {
    const player = this.gameSvc.currentOrderPlayer;
    const isHuman = player === 0;
    this.gameSvc.passBy(player);
    this.showDecisionMessage(player, isHuman ? 'You passed' : 'Passed');
    setTimeout(() => {
      this.clearDecisionMessage(player);
      this.processOrdering();
    }, 1000);
  }

  get availableSuits(): readonly string[] {
    return this.gameSvc.availableSuits;
  }

  // For 2nd round, store the suit the human selects
  private selectedSecondRoundSuit: string | null = null;

  // Human selects a suit for the 2nd round of ordering
  onOrderSecondRound(suit: string) {
    this.gameSvc.orderUpSecondRound(0, suit as any);
    this.showDecisionMessage(0, `You chose ${suit.charAt(0).toUpperCase() + suit.slice(1)}`);
    setTimeout(() => {
      this.clearDecisionMessage(0);
      this.processOrdering();
    }, 1000);
  }

  /** Helper to show a decision message, clear after delay, and optionally call a callback */
  private showDecisionAndContinue(player: number, msg: string, cb: () => void) {
    this.showDecisionMessage(player, msg);
    setTimeout(() => {
      this.clearDecisionMessage(player);
      cb();
    }, 1000);
  }

  /** Drive the entire order/pass flow, auto-invoking AI until it’s the human’s turn or order phase ends */
  private processOrdering(): void {
    if (this.gameSvc.orderRound > 0 && this.gameSvc.currentOrderPlayer !== 0) {
      const aiPlayer = this.gameSvc.currentOrderPlayer;
      if (this.gameSvc.orderRound === 2) {
        let bestSuit: string | null = null;
        let bestScore = -1;
        for (const suit of this.gameSvc.availableSuits) {
          const hand = this.gameSvc.currentHands[aiPlayer];
          const trumpCount = hand.filter(c => CardUtils.getEffectiveSuit(c, suit) === suit).length;
          if (trumpCount > bestScore) {
            bestScore = trumpCount;
            bestSuit = suit;
          }
        }
        if (bestScore >= 2 && bestSuit) {
          this.showDecisionAndContinue(aiPlayer, `Ordered ${bestSuit.charAt(0).toUpperCase() + bestSuit.slice(1)}`, () => {
            this.gameSvc.orderUpSecondRound(aiPlayer, bestSuit as any);
            this.processOrdering();
          });
          return;
        } else {
          this.showDecisionAndContinue(aiPlayer, 'Passed', () => {
            this.gameSvc.passBy(aiPlayer);
            this.processOrdering();
          });
          return;
        }
      } else {
        const advice = this.adviceSvc.getTrumpAdvice(
          this.gameSvc.currentHands[aiPlayer],
          this.gameSvc.currentKitty!,
          this.gameSvc.difficulty
        );
        if (advice.action === 'order') {
          this.showDecisionAndContinue(aiPlayer, 'Ordered up', () => {
            this.gameSvc.orderUpBy(aiPlayer);
            this.processOrdering();
          });
          return;
        } else {
          this.showDecisionAndContinue(aiPlayer, 'Passed', () => {
            this.gameSvc.passBy(aiPlayer);
            this.processOrdering();
          });
          return;
        }
      }
    }
    if (this.gameSvc.awaitingDiscard) return;
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
    return this.getValidPlayableCards(0);
  }

  // Used in template to check if a card is valid to play
  isCardValidToPlay(card: Card): boolean {
    return this.validPlayableCards.some(c => c.rank === card.rank && c.suit === card.suit);
  }

  // Used in *ngFor trackBy for cards
  trackCard(_: number, card: Card): string {
    return card.suit + '-' + card.rank;
  }

  /**
   * Returns the player index whose turn it is to play a card (0=human, 1=left, 2=top, 3=right),
   * or null if not in play phase (e.g. during trump selection or discard)
   */
  get currentTurn(): number | null {
    // If in trump selection or discard, no one is playing a card
    if (!this.gameSvc.trump || this.gameSvc.awaitingDiscard || this.gameSvc.orderRound > 0) {
      return null;
    }
    // During play: next to play is (currentLeader + currentTrick.length) % 4
    return (this.gameSvc.currentLeader + this.gameSvc.currentTrick.length) % 4;
  }

  prepareEndRoundSummary(prevScores?: number[]) {
    // Compose a user-focused summary for the last hand
    const playerIndex = 0; // human is always player 0
    const tricks = this.gameSvc.tricksWon[playerIndex];
    const team = playerIndex % 2; // 0 for team 0 (us), 1 for team 1 (them)
    const oppTeam = 1 - team;
    const teamTricks = this.gameSvc.tricksWon[0] + this.gameSvc.tricksWon[2];
    const oppTricks = this.gameSvc.tricksWon[1] + this.gameSvc.tricksWon[3];
    const trumpSuit = this.gameSvc.trump ? this.gameSvc.trump.charAt(0).toUpperCase() + this.gameSvc.trump.slice(1) : 'Unknown';

    // Use previous scores if provided, otherwise fallback to old logic
    let pointsMsg = '';
    if (prevScores) {
      const pointsGained = [
        this.gameSvc.teamScores[0] - prevScores[0],
        this.gameSvc.teamScores[1] - prevScores[1]
      ];
      if (pointsGained[team] > 0) {
        pointsMsg = `Your team (Players ${team === 0 ? '1 & 3' : '2 & 4'}) scored ${pointsGained[team]} point${pointsGained[team] !== 1 ? 's' : ''}`;
      } else if (pointsGained[oppTeam] > 0) {
        pointsMsg = `Opponents (Players ${oppTeam === 0 ? '1 & 3' : '2 & 4'}) scored ${pointsGained[oppTeam]} point${pointsGained[oppTeam] !== 1 ? 's' : ''}`;
      } else {
        pointsMsg = 'No points were scored this hand.';
      }
    } else {
      // fallback: show nothing or a warning
      pointsMsg = '(Points info unavailable)';
    }
    let msg = `Trump was ${trumpSuit}.\n`;
    msg += `You took ${tricks} trick${tricks !== 1 ? 's' : ''}.\n`;
    msg += `Your team took ${teamTricks} trick${teamTricks !== 1 ? 's' : ''}.\n`;
    msg += `Opponents took ${oppTricks} trick${oppTricks !== 1 ? 's' : ''}.\n`;
    msg += `\n${pointsMsg}`;
    this.endRoundMessage = msg;
    this.showEndRound = true;
  }

  nextHand() {
    this.showEndRound = false;
    this.gameSvc.dealHands();
  }

  getScorePercent(team: 0 | 1): number {
    const score = this.gameSvc.teamScores[team];
    const max = 10;
    return Math.min(100, Math.round((score / max) * 100));
  }

}