import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { getGameStatus, makeRandomMove } from '@/lib/chess-logic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, MessageSquare, History, Loader2, Copy, Trophy, Handshake as HandshakeIcon } from 'lucide-react';
import type { Game as GameType, Player, PlayerColor } from '@shared/types';
import { useGameStore } from '@/stores/game-store';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Input } from '@/components/ui/input';
import { useGameSounds } from '@/hooks/use-sound';
type GameMode = 'ai' | 'local' | 'online';
export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { playerId, playerName, isAuthenticated } = useGameStore();
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const game = useMemo(() => new Chess(fen), [fen]);
  const [gameData, setGameData] = useState<GameType | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);
  const { playMove, playCapture, playGameEnd, playCheck } = useGameSounds();
  const gameMode: GameMode = useMemo(() => (gameId === 'ai' || gameId === 'local') ? gameId : 'online', [gameId]);
  const playerColor: PlayerColor | undefined = useMemo(() => {
    if (gameMode !== 'online' || !gameData || !playerId) return undefined;
    if (gameData.players[0]?.id === playerId) return 'w';
    if (gameData.players[1]?.id === playerId) return 'b';
    return undefined;
  }, [gameMode, gameData, playerId]);
  const handleGameOver = useCallback((status: ReturnType<typeof getGameStatus>, currentPlayers: [Player, Player | null]) => {
    if (status.status !== 'ongoing' && status.status !== 'waiting') {
      playGameEnd();
      setGameOver(true);
      let message = '';
      switch (status.status) {
        case 'checkmate': {
          const winnerName = status.winner === 'w' ? currentPlayers[0]?.name : currentPlayers[1]?.name;
          message = `Checkmate! ${winnerName || (status.winner === 'w' ? 'White' : 'Black')} wins.`;
          break;
        }
        case 'abandoned': {
          const winnerName = status.winner === 'w' ? currentPlayers[0]?.name : currentPlayers[1]?.name;
          message = `Opponent abandoned! ${winnerName || (status.winner === 'w' ? 'White' : 'Black')} wins.`;
          break;
        }
        case 'stalemate':
          message = 'Stalemate! The game is a draw.';
          break;
        default:
          message = 'Game over. The result is a draw.';
      }
      setStatusMessage(message);
    }
  }, [playGameEnd]);
  const updateGameState = useCallback((newGameData: GameType) => {
    setGameData(currentGameData => {
      const isNewChat = currentGameData && newGameData.chat.length > currentGameData.chat.length;
      const oldFen = currentGameData?.fen;
      setFen(newGameData.fen);
      const newGameInstance = new Chess(newGameData.fen);
      if (oldFen !== newGameData.fen) {
          const lastMove = newGameInstance.history({ verbose: true }).pop();
          if (lastMove?.captured) playCapture();
          else playMove();
          if (newGameInstance.isCheck()) playCheck();
      }
      const status = getGameStatus(newGameInstance);
      handleGameOver({ ...status, winner: newGameData.winner }, newGameData.players);
      if (isNewChat) {
        setTimeout(() => {
          chatScrollAreaRef.current?.scrollTo({ top: chatScrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }, 100);
      }
      return newGameData;
    });
  }, [playCapture, playMove, playCheck, handleGameOver]);
  const fetchGame = useCallback(async () => {
    if (gameMode !== 'online' || !gameId) return;
    try {
      const data = await api<GameType>(`/api/games/${gameId}`);
      updateGameState(data);
    } catch (error) {
      console.error("Failed to fetch game state:", error);
      toast.error("Could not load game. It may not exist or has expired.");
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [gameId, gameMode, navigate, updateGameState]);
  const joinGame = useCallback(async () => {
    if (!gameId || !playerId || !playerName) return;
    try {
      const data = await api<GameType>(`/api/games/${gameId}/join`, {
        method: 'POST',
        body: JSON.stringify({ playerId, playerName }),
      });
      updateGameState(data);
    } catch (error) {
      console.log("Join failed (maybe already in game):", error);
    }
  }, [gameId, playerId, playerName, updateGameState]);
  useEffect(() => {
    if (!isAuthenticated) {
      toast.error("You must be logged in to play.");
      navigate('/');
      return;
    }
    if (gameMode === 'online') {
      fetchGame().then(() => joinGame());
    } else {
      setIsLoading(false);
    }
  }, [gameMode, gameId, isAuthenticated, fetchGame, joinGame, navigate]);
  useEffect(() => {
    if (gameMode !== 'online' || gameOver) return;
    const interval = setInterval(fetchGame, 2500);
    return () => clearInterval(interval);
  }, [gameMode, gameOver, fetchGame]);
  const handleOfferDraw = async () => {
    if (gameMode !== 'online' || !gameId || !playerId) return;
    try {
      const updatedGame = await api<GameType>(`/api/games/${gameId}/offer-draw`, {
        method: 'POST',
        body: JSON.stringify({ playerId }),
      });
      updateGameState(updatedGame);
      toast.info("You have offered a draw.");
    } catch (error: any) {
      toast.error(error.message || "Failed to offer draw.");
    }
  };
  const handleRespondToDraw = useCallback(async (accept: boolean) => {
    if (gameMode !== 'online' || !gameId || !playerId) return;
    try {
      const updatedGame = await api<GameType>(`/api/games/${gameId}/respond-draw`, {
        method: 'POST',
        body: JSON.stringify({ playerId, accept }),
      });
      updateGameState(updatedGame);
      toast.dismiss('draw-offer');
      if (accept) toast.success("Draw accepted. The game is over.");
      else toast.warning("Draw offer declined.");
    } catch (error: any) {
      toast.error(error.message || "Failed to respond to draw offer.");
    }
  }, [gameId, gameMode, playerId, updateGameState]);
  useEffect(() => {
    if (gameData?.drawOffer && gameData.drawOffer !== playerColor) {
      toast.info("Your opponent has offered a draw.", {
        id: 'draw-offer',
        duration: Infinity,
        action: <Button onClick={() => handleRespondToDraw(true)} size="sm">Accept</Button>,
        cancel: <Button onClick={() => handleRespondToDraw(false)} variant="destructive" size="sm">Decline</Button>,
      });
    } else {
      toast.dismiss('draw-offer');
    }
    return () => { toast.dismiss('draw-offer'); };
  }, [gameData?.drawOffer, playerColor, handleRespondToDraw]);
  const onMove = useCallback(async (sourceSquare: Square, targetSquare: Square): Promise<boolean> => {
    // 1. Universal validation
    if (game.isGameOver() || (gameMode === 'online' && gameData?.status !== 'ongoing')) {
      return false;
    }
    const gameCopy = new Chess(fen);
    const moveData = { from: sourceSquare, to: targetSquare, promotion: 'q' };
    const moveResult = gameCopy.move(moveData);
    if (moveResult === null) {
      return false; // Illegal move
    }
    // 2. Handle move based on game mode
    if (gameMode === 'online') {
      if (!gameId || !playerId) return false;
      try {
        const updatedGame = await api<GameType>(`/api/games/${gameId}/move`, {
          method: 'POST',
          body: JSON.stringify({ playerId, move: moveData }),
        });
        updateGameState(updatedGame);
      } catch (error: any) {
        toast.error(error.message || "Invalid move");
        return false; // Revert on API error
      }
    } else { // Local or AI mode
      // Play sounds for the local move
      if (moveResult.captured) playCapture();
      else playMove();
      if (gameCopy.isCheck()) playCheck();
      // Update local state
      setFen(gameCopy.fen());
      const status = getGameStatus(gameCopy);
      const localPlayers: [Player, Player | null] = [{id: 'p1', name: 'Player 1'}, {id: 'p2', name: 'Player 2'}];
      handleGameOver(status, localPlayers);
      // Handle AI response
      if (gameMode === 'ai' && !gameCopy.isGameOver()) {
        setTimeout(() => {
          const gameAfterPlayerMove = new Chess(gameCopy.fen());
          const aiMove = makeRandomMove(gameAfterPlayerMove);
          if (aiMove) {
            if (aiMove.captured) playCapture();
            else playMove();
          }
          if (gameAfterPlayerMove.isCheck()) playCheck();
          setFen(gameAfterPlayerMove.fen());
          const aiStatus = getGameStatus(gameAfterPlayerMove);
          handleGameOver(aiStatus, localPlayers);
        }, 500);
      }
    }
    return true; // Move was successful
  }, [
    fen, game, gameMode, gameData, gameId, playerId,
    updateGameState, playCapture, playMove, playCheck, handleGameOver
  ]);
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !gameId || !playerId || !playerName) return;
    try {
      const updatedGame = await api<GameType>(`/api/games/${gameId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ playerId, playerName, text: chatInput.trim() }),
      });
      updateGameState(updatedGame);
      setChatInput('');
    } catch (error) {
      toast.error("Failed to send message.");
    }
  };
  const resetGame = useCallback(() => {
    setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    setGameData(null);
    setGameOver(false);
    setStatusMessage('');
  }, []);
  if (isLoading) {
    return (
      <div className="w-full min-h-[calc(100vh-128px)] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-chess-blue" />
        <p className="mt-4 text-lg">Loading Game...</p>
      </div>
    );
  }
  const history = gameData ? gameData.history : game.history();
  const whitePlayerName = gameData?.players[0]?.name ?? (gameMode === 'ai' ? 'You' : 'PLAYER1 (White)');
  const blackPlayerName = gameData?.players[1]?.name ?? (gameMode === 'ai' ? 'AI Opponent' : 'PLAYER2 (Black)');
  const isDrawOffered = !!gameData?.drawOffer;
  return (
    <div className="container mx-auto p-4">
      <Toaster richColors />
      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        <div className="w-full flex-1 flex flex-col items-center gap-4">
          <PlayerInfo name={blackPlayerName} isBlack={true} />
          <ChessBoard position={fen} onMove={onMove} boardOrientation={playerColor === 'b' ? 'black' : 'white'} playerColor={gameMode === 'online' ? playerColor : game.turn()} />
          <PlayerInfo name={whitePlayerName} isBlack={false} />
        </div>
        <aside className="w-full lg:w-96 flex flex-col gap-4 flex-shrink-0">
          {gameMode === 'online' && gameData?.status === 'waiting' && gameData.partyCode && (
            <Card className="bg-blue-900/50 border-chess-blue/50 text-center">
              <CardHeader><CardTitle>Waiting for Opponent</CardTitle></CardHeader>
              <CardContent>
                <p>Share this party code with a friend:</p>
                <div className="flex items-center gap-2 mt-2 p-2 rounded bg-gray-900">
                  <Input readOnly value={gameData.partyCode} className="bg-transparent border-0 text-chess-light text-2xl font-bold tracking-widest text-center" />
                  <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(gameData.partyCode!); toast.success("Party code copied!"); }}>
                    <Copy className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="bg-gray-800/50 border-gray-700/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5 text-chess-blue" /> Move History</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-48 w-full pr-4">
                <ol className="list-decimal list-inside">
                  {history.map((move, index) => (index % 2 === 0 && <li key={index} className="text-gray-300 mt-1">
                    <span className="font-semibold">{Math.floor(index / 2) + 1}.</span> {move} {history[index + 1] ?? ''}
                  </li>))}
                </ol>
              </ScrollArea>
            </CardContent>
          </Card>
          {gameMode === 'online' && (
            <>
              {gameData?.status === 'ongoing' && (
                <Button onClick={handleOfferDraw} disabled={isDrawOffered} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold disabled:opacity-50">
                  <HandshakeIcon className="w-5 h-5 mr-2" />
                  {gameData?.drawOffer === playerColor ? 'Draw Offered' : 'Offer Draw'}
                </Button>
              )}
              <Card className="bg-gray-800/50 border-gray-700/50 flex flex-col">
                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-chess-blue" /> Chat</CardTitle></CardHeader>
                <CardContent className="flex-1 flex flex-col gap-2">
                  <ScrollArea className="h-48 w-full pr-4" ref={chatScrollAreaRef}>
                    {gameData?.chat.length === 0 && <p className="text-gray-400 text-center py-8">No messages yet.</p>}
                    {gameData?.chat.map((msg) => (
                      <div key={msg.id} className={`text-sm mb-2 ${msg.playerId === playerId ? 'text-right' : 'text-left'}`}>
                        <span className={`font-bold ${msg.playerId === playerId ? 'text-chess-blue' : ''}`}>{msg.playerName}: </span>
                        <span>{msg.text}</span>
                      </div>
                    ))}
                  </ScrollArea>
                  <form onSubmit={handleSendChat} className="flex gap-2 pt-2 border-t border-gray-700/50">
                    <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Say something..." className="bg-gray-900" disabled={gameMode !== 'online'} />
                    <Button type="submit" className="bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold" disabled={gameMode !== 'online'}>Send</Button>
                  </form>
                </CardContent>
              </Card>
            </>
          )}
          {gameMode !== 'online' && <Button onClick={resetGame} className="w-full bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold">New Game</Button>}
        </aside>
      </div>
      <Dialog open={gameOver} onOpenChange={setGameOver}>
        <DialogContent className="bg-chess-dark text-chess-light border-chess-blue text-center">
          <DialogHeader>
            <div className="flex justify-center mb-4">
                <Trophy className="w-16 h-16 text-yellow-400" />
            </div>
            <DialogTitle className="text-3xl font-bold">Game Over</DialogTitle>
            <DialogDescription className="text-gray-300 pt-2 text-lg">{statusMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            {gameMode === 'online' ? (
              <Button onClick={() => navigate('/dashboard')} className="bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold">Back to Dashboard</Button>
            ) : (
              <Button onClick={resetGame} className="bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold">Play Again</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function PlayerInfo({ name, isBlack }: { name: string; isBlack: boolean }) {
  return (
    <div className={`w-full p-3 rounded-lg flex items-center gap-4 ${isBlack ? 'bg-black/30' : 'bg-white/10'}`}>
      <div className="p-2 bg-gray-600 rounded-full"><User className="w-6 h-6 text-chess-light" /></div>
      <span className="font-semibold text-lg">{name}</span>
    </div>
  );
}