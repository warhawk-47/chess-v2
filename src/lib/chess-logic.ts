import { Chess, Move as ChessMove } from 'chess.js';
import type { GameStatus } from '@shared/types';
export function createGame() {
  return new Chess();
}
export function getGameStatus(game: Chess): { status: GameStatus; winner?: 'w' | 'b' } {
  if (game.isCheckmate()) {
    return { status: 'checkmate', winner: game.turn() === 'w' ? 'b' : 'w' };
  }
  if (game.isStalemate()) {
    return { status: 'stalemate' };
  }
  if (game.isThreefoldRepetition()) {
    return { status: 'threefold_repetition' };
  }
  if (game.isInsufficientMaterial()) {
    return { status: 'insufficient_material' };
  }
  if (game.isDraw()) {
    return { status: 'draw' };
  }
  return { status: 'ongoing' };
}
export function makeMove(game: Chess, move: { from: string; to: string; promotion?: string }): ChessMove | null {
  try {
    const result = game.move(move);
    return result;
  } catch (e) {
    // This can happen if the move is invalid
    return null;
  }
}
export function makeRandomMove(game: Chess): ChessMove | null {
  const possibleMoves = game.moves({ verbose: true });
  if (possibleMoves.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * possibleMoves.length);
  const randomMove = possibleMoves[randomIndex];
  return game.move(randomMove.san);
}