export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
// CHESS-SPECIFIC TYPES
export type PlayerColor = 'w' | 'b';
export type GameStatus = 'waiting' | 'ongoing' | 'checkmate' | 'stalemate' | 'draw' | 'threefold_repetition' | 'insufficient_material' | 'abandoned';
export interface GameInvitation {
  fromId: string;
  fromName: string;
  gameId: string;
}
export interface FriendRequest {
  fromId: string;
  fromName: string;
}
export interface PlayerProfile {
  id: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  password?: string; // For backend use
  incomingGameInvitations?: GameInvitation[];
  friends?: string[]; // Array of friend player IDs
  incomingFriendRequests?: FriendRequest[];
  sentFriendRequests?: string[]; // Array of player IDs the user has sent requests to
  status?: 'online' | 'offline';
  lastSeen?: number;
  currentGameId?: string | null;
}
export interface Player {
  id: string;
  name: string;
  status?: 'online' | 'offline';
}
export interface Game {
  id: string;
  fen: string;
  turn: PlayerColor;
  status: GameStatus;
  history: string[];
  players: [Player, Player | null]; // [white, black]
  winner?: PlayerColor;
  chat: ChatMessage[];
  partyCode?: string;
  drawOffer: PlayerColor | null;
}
export interface Move {
  from: string;
  to: string;
  promotion?: string;
}
export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  ts: number;
}
export interface GameSummary {
  gameId: string;
  whitePlayerName: string;
  blackPlayerName: string;
  result: 'win' | 'loss' | 'draw';
  endStatus: GameStatus;
  date: number;
}
// API Payloads
export interface FindMatchResponse {
  status: 'searching' | 'matched';
  gameId?: string;
}
export interface CreateGameResponse {
    game: Game;
    partyCode: string;
}
// DEMO-SPECIFIC TYPES (for DemoPage.tsx)
export interface User {
  id: string;
  name: string;
}
export interface Chat {
  id: string;
  title: string;
}