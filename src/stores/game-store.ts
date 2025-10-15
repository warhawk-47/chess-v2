import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api-client';
import type { GameInvitation, PlayerProfile, FriendRequest, Player } from '@shared/types';
export type MatchmakingStatus = 'idle' | 'searching' | 'ingame' | 'error';
interface GameState {
  playerId: string | null;
  playerName: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  matchmakingStatus: MatchmakingStatus;
  gameId: string | null;
  invitations: GameInvitation[];
  friends: Player[];
  friendRequests: FriendRequest[];
  setPlayer: (id: string, name: string, isGuest?: boolean) => void;
  setMatchmakingStatus: (status: MatchmakingStatus) => void;
  setGameId: (gameId: string | null) => void;
  setInvitations: (invitations: GameInvitation[]) => void;
  setFriends: (friends: Player[]) => void;
  setFriendRequests: (requests: FriendRequest[]) => void;
  fetchSocialData: () => Promise<void>;
  logout: () => void;
  reset: () => void;
}
const initialState = {
  playerId: null,
  playerName: null,
  isAuthenticated: false,
  isGuest: false,
  matchmakingStatus: 'idle' as MatchmakingStatus,
  gameId: null,
  invitations: [],
  friends: [],
  friendRequests: [],
};
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setPlayer: (id, name, isGuest = false) => set({
        playerId: id,
        playerName: name,
        isAuthenticated: true,
        isGuest,
      }),
      setMatchmakingStatus: (status) => set({ matchmakingStatus: status }),
      setGameId: (gameId) => set({ gameId, matchmakingStatus: gameId ? 'ingame' : 'idle' }),
      setInvitations: (invitations) => set({ invitations }),
      setFriends: (friends) => set({ friends }),
      setFriendRequests: (requests) => set({ friendRequests: requests }),
      fetchSocialData: async () => {
        const { playerId } = get();
        if (!playerId) return;
        try {
          const profile = await api<PlayerProfile>(`/api/players/${playerId}`);
          const friends = await api<Player[]>(`/api/friends?playerId=${playerId}`);
          set({
            invitations: profile.incomingGameInvitations || [],
            friendRequests: profile.incomingFriendRequests || [],
            friends: friends || [],
          });
        } catch (error) {
          console.error("Failed to fetch social data:", error);
        }
      },
      logout: () => set({ ...initialState }),
      reset: () => set({
        matchmakingStatus: 'idle',
        gameId: null,
      }),
    }),
    {
      name: 'chess-edge-game-storage',
    }
  )
);