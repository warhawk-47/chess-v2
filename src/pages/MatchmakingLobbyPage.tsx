import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/game-store';
import { api } from '@/lib/api-client';
import { FindMatchResponse } from '@shared/types';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
export function MatchmakingLobbyPage() {
  const navigate = useNavigate();
  // CRITICAL FIX: Select primitives individually to prevent re-renders.
  // The previous implementation `useGameStore(state => ({...}))` created a new object
  // on every render, causing an infinite loop.
  const playerId = useGameStore(state => state.playerId);
  const playerName = useGameStore(state => state.playerName);
  const setGameId = useGameStore(state => state.setGameId);
  const setMatchmakingStatus = useGameStore(state => state.setMatchmakingStatus);
  useEffect(() => {
    if (!playerId) {
      toast.error("You must have a player name to find a match.");
      navigate('/');
      return;
    }
    let isCancelled = false;
    let pollTimeout: NodeJS.Timeout;
    const findMatch = async () => {
      try {
        const result = await api<{ status: 'searching' | 'matched' | 'full', gameId?: string }>('/api/matchmaking/find', {
          method: 'POST',
          body: JSON.stringify({ playerId }),
        });
        if (result.status === 'full') {
          toast.error("Server is at capacity. Please try again later.");
          navigate('/');
          return;
        }
        setMatchmakingStatus('searching');
        pollForMatch();
      } catch (error) {
        console.error("Failed to start matchmaking:", error);
        toast.error("Could not connect to matchmaking service.");
        setMatchmakingStatus('error');
        navigate('/');
      }
    };
    const pollForMatch = async () => {
      if (isCancelled) return;
      try {
        const response = await api<FindMatchResponse>(`/api/matchmaking/status/${playerId}`);
        if (response.status === 'matched' && response.gameId) {
          toast.success("Match found! Joining game...");
          setGameId(response.gameId);
          navigate(`/game/${response.gameId}`);
        } else {
          pollTimeout = setTimeout(pollForMatch, 2000); // Poll every 2 seconds
        }
      } catch (error) {
        console.error("Polling error:", error);
        pollTimeout = setTimeout(pollForMatch, 5000); // Longer delay on error
      }
    };
    findMatch();
    return () => {
      isCancelled = true;
      clearTimeout(pollTimeout);
    };
  }, [playerId, navigate, setGameId, setMatchmakingStatus]);
  return (
    <div className="w-full min-h-[calc(100vh-128px)] flex flex-col items-center justify-center p-4 text-center bg-chess-dark text-chess-light">
      <Toaster richColors />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6"
      >
        <Loader2 className="w-16 h-16 text-chess-blue animate-spin" />
        <h1 className="text-4xl font-bold">Searching for Opponent...</h1>
        {playerName && <p className="text-lg text-gray-300">Playing as <span className="font-bold text-chess-blue">{playerName}</span></p>}
        <p className="text-lg text-gray-400">Please wait while we find a worthy adversary for you.</p>
      </motion.div>
    </div>
  );
}