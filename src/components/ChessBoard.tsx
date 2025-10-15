import React from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';
// The piece from react-chessboard is a string like 'wP', not the Piece object from chess.js
type ChessboardPiece = 'wP' | 'wN' | 'wB' | 'wR' | 'wQ' | 'wK' | 'bP' | 'bN' | 'bB' | 'bR' | 'bQ' | 'bK';
interface ChessBoardProps {
  position: string;
  onMove: (sourceSquare: Square, targetSquare: Square, piece: ChessboardPiece) => boolean;
  boardOrientation?: 'white' | 'black';
  playerColor?: 'w' | 'b';
}
export function ChessBoard({ position, onMove, boardOrientation = 'white', playerColor }: ChessBoardProps) {
  function checkIsDraggable({ piece }: { piece: ChessboardPiece; sourceSquare: Square; }): boolean {
    if (!playerColor) return true; // Allow moves for both in local/AI mode
    return playerColor === piece[0].toLowerCase();
  }
  return (
    <div className="w-full max-w-[calc(100vh-200px)] md:max-w-[700px] lg:max-w-[800px] aspect-square shadow-2xl rounded-lg overflow-hidden">
      <Chessboard
        position={position}
        onPieceDrop={onMove}
        boardOrientation={boardOrientation}
        isDraggablePiece={checkIsDraggable}
        customBoardStyle={{
          borderRadius: '8px',
          boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
        }}
        customDarkSquareStyle={{ backgroundColor: 'rgb(44, 62, 80)' }}
        customLightSquareStyle={{ backgroundColor: 'rgb(234, 234, 234)' }}
        customDropSquareStyle={{ boxShadow: 'inset 0 0 1px 4px rgb(52, 152, 219)' }}
      />
    </div>
  );
}