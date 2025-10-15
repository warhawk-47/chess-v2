import { IndexedEntity, Entity } from "./core-utils";
import type { PlayerProfile, Game, PlayerColor, ChatMessage, Move, Player, GameInvitation, FriendRequest, GameSummary, GameStatus } from "@shared/types";
import { Chess } from "chess.js";
import type { Env } from './core-utils';
// This entity acts as a distributed lock to ensure username uniqueness.
// The entity ID is the lowercased username.
export class PlayerNameLockEntity extends Entity<{ ownerId: string }> {
  static readonly entityName = "playerNameLock";
  static readonly initialState = { ownerId: "" };
  async acquire(playerId: string): Promise<boolean> {
    const state = await this.getState();
    if (state.ownerId === "" || state.ownerId === playerId) {
      await this.save({ ownerId: playerId });
      return true;
    }
    return false;
  }
  async getPlayerId(): Promise<string | null> {
    const state = await this.getState();
    return state.ownerId || null;
  }
}
export class PlayerEntity extends IndexedEntity<PlayerProfile> {
  static readonly entityName: string = "player";
  static readonly indexName: string = "players";
  static readonly initialState: PlayerProfile = { id: "", name: "", gamesPlayed: 0, wins: 0, losses: 0, draws: 0, password: "", incomingGameInvitations: [], friends: [], incomingFriendRequests: [], sentFriendRequests: [], status: 'offline', lastSeen: 0, currentGameId: null };
  async updateStats(result: 'win' | 'loss' | 'draw'): Promise<void> {
    await this.mutate((p) => {
      const newProfile = { ...p, gamesPlayed: p.gamesPlayed + 1 };
      if (result === 'win') newProfile.wins++;
      else if (result === 'loss') newProfile.losses++;
      else newProfile.draws++;
      return newProfile;
    });
  }
  async addGameInvitation(invitation: GameInvitation): Promise<void> {
    await this.mutate((p) => {
      const invitations = p.incomingGameInvitations || [];
      if (invitations.some(inv => inv.gameId === invitation.gameId)) return p;
      return { ...p, incomingGameInvitations: [...invitations, invitation] };
    });
  }
  async removeGameInvitation(gameId: string): Promise<void> {
    await this.mutate((p) => {
      const invitations = p.incomingGameInvitations || [];
      return { ...p, incomingGameInvitations: invitations.filter(inv => inv.gameId !== gameId) };
    });
  }
  async addFriendRequest(request: FriendRequest): Promise<void> {
    await this.mutate((p) => {
      const requests = p.incomingFriendRequests || [];
      if (requests.some(req => req.fromId === request.fromId)) return p;
      return { ...p, incomingFriendRequests: [...requests, request] };
    });
  }
  async addSentFriendRequest(toPlayerId: string): Promise<void> {
    await this.mutate((p) => {
      const sent = p.sentFriendRequests || [];
      if (sent.includes(toPlayerId)) return p;
      return { ...p, sentFriendRequests: [...sent, toPlayerId] };
    });
  }
  async removeFriendRequest(fromId: string): Promise<void> {
    await this.mutate((p) => {
      const requests = p.incomingFriendRequests || [];
      return { ...p, incomingFriendRequests: requests.filter(req => req.fromId !== fromId) };
    });
  }
  async removeSentFriendRequest(toId: string): Promise<void> {
    await this.mutate((p) => {
      const sent = p.sentFriendRequests || [];
      return { ...p, sentFriendRequests: sent.filter(id => id !== toId) };
    });
  }
  async addFriend(friendId: string): Promise<void> {
    await this.mutate((p) => {
      const friends = p.friends || [];
      if (friends.includes(friendId)) return p;
      return { ...p, friends: [...friends, friendId] };
    });
  }
  async removeFriend(friendId: string): Promise<void> {
    await this.mutate((p) => {
      const friends = p.friends || [];
      return { ...p, friends: friends.filter(id => id !== friendId) };
    });
  }
  async heartbeat(): Promise<void> {
    await this.patch({ status: 'online', lastSeen: Date.now() });
  }
  async setCurrentGame(gameId: string | null): Promise<void> {
    await this.patch({ currentGameId: gameId });
  }
}
export class UserEntity extends PlayerEntity {
  static readonly entityName = "user";
  static readonly indexName = "users";
}
export class GameHistoryEntity extends Entity<{ games: GameSummary[] }> {
  static readonly entityName = "gameHistory";
  static readonly initialState = { games: [] };
  constructor(env: Env, playerId: string) {
    super(env, playerId);
  }
  async addGame(summary: GameSummary): Promise<void> {
    await this.mutate((state) => {
      const games = [summary, ...state.games];
      if (games.length > 50) {
        games.length = 50;
      }
      return { games };
    });
  }
}
export class GameEntity extends IndexedEntity<Game> {
  static readonly entityName = "game";
  static readonly indexName = "games";
  static readonly initialState: Game = {
    id: "",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    turn: 'w',
    status: 'waiting',
    history: [],
    players: [{ id: '', name: '' }, null],
    chat: [],
    drawOffer: null,
  };
  private async handleGameEnd(game: Game, status: GameStatus, winner?: PlayerColor) {
    if (status === 'ongoing' || status === 'waiting') return;
    const whitePlayer = game.players[0]!;
    const blackPlayer = game.players[1]!;
    const whitePlayerEntity = new PlayerEntity(this.env, whitePlayer.id);
    const blackPlayerEntity = new PlayerEntity(this.env, blackPlayer.id);
    if (winner === 'w') {
      await whitePlayerEntity.updateStats('win');
      await blackPlayerEntity.updateStats('loss');
    } else if (winner === 'b') {
      await whitePlayerEntity.updateStats('loss');
      await blackPlayerEntity.updateStats('win');
    } else {
      await whitePlayerEntity.updateStats('draw');
      await blackPlayerEntity.updateStats('draw');
    }
    await whitePlayerEntity.setCurrentGame(null);
    await blackPlayerEntity.setCurrentGame(null);
    const whiteHistory = new GameHistoryEntity(this.env, whitePlayer.id);
    const blackHistory = new GameHistoryEntity(this.env, blackPlayer.id);
    const whiteSummary: GameSummary = {
      gameId: game.id,
      whitePlayerName: whitePlayer.name,
      blackPlayerName: blackPlayer.name,
      result: winner === 'w' ? 'win' : winner === 'b' ? 'loss' : 'draw',
      endStatus: status,
      date: Date.now(),
    };
    const blackSummary: GameSummary = { ...whiteSummary, result: winner === 'b' ? 'win' : winner === 'w' ? 'loss' : 'draw' };
    await whiteHistory.addGame(whiteSummary);
    await blackHistory.addGame(blackSummary);
  }
  async addPlayer(player: Player): Promise<{ success: boolean; error?: string }> {
    const game = await this.getState();
    if (game.players.some(p => p?.id === player.id)) {
      return { success: true };
    }
    if (game.players[1] !== null) {
      return { success: false, error: "Game is already full." };
    }
    await this.patch({ players: [game.players[0], player], status: 'ongoing' });
    return { success: true };
  }
  async makeMove(playerId: string, move: Move): Promise<{ success: boolean; error?: string; moveResult?: { san: string, captured?: boolean } }> {
    const game = await this.getState();
    if (game.status === 'waiting') return { success: false, error: "Waiting for opponent to join" };
    if (game.status !== 'ongoing') return { success: false, error: "Game is over" };
    if (!game.players[1]) return { success: false, error: "Opponent has not joined yet." };
    const playerIndex = game.players.findIndex((p) => p?.id === playerId);
    if (playerIndex === -1) return { success: false, error: "Player not in this game" };
    const playerColor = playerIndex === 0 ? 'w' : 'b';
    if (game.turn !== playerColor) return { success: false, error: "Not your turn" };
    const chess = new Chess(game.fen);
    try {
      const result = chess.move(move);
      if (result === null) return { success: false, error: "Invalid move" };
      const newHistory = [...game.history, result.san];
      let status: Game['status'] = 'ongoing';
      let winner: PlayerColor | undefined = undefined;
      let chat: ChatMessage[] = game.chat;
      if (chess.isCheckmate()) {
        status = 'checkmate';
        winner = chess.turn() === 'w' ? 'b' : 'w';
      } else if (chess.isStalemate()) {
        status = 'stalemate';
      } else if (chess.isThreefoldRepetition()) {
        status = 'threefold_repetition';
      } else if (chess.isInsufficientMaterial()) {
        status = 'insufficient_material';
      } else if (chess.isDraw()) {
        status = 'draw';
      }
      if (status !== 'ongoing') {
        chat = []; // Clear chat on game end
        await this.handleGameEnd({ ...game, players: [game.players[0]!, game.players[1]!] }, status, winner);
      }
      await this.patch({ fen: chess.fen(), turn: chess.turn(), history: newHistory, status, winner, drawOffer: null, chat });
      return { success: true, moveResult: { san: result.san, captured: !!result.captured } };
    } catch (e) {
      return { success: false, error: "Invalid move format" };
    }
  }
  async addChatMessage(playerId: string, playerName: string, text: string): Promise<void> {
    const message: ChatMessage = { id: crypto.randomUUID(), playerId, playerName, text, ts: Date.now() };
    await this.mutate((g) => ({ ...g, chat: [...g.chat, message] }));
  }
  async offerDraw(playerId: string): Promise<{ success: boolean; error?: string }> {
    const game = await this.getState();
    if (game.status !== 'ongoing') return { success: false, error: "Game is not ongoing." };
    const playerIndex = game.players.findIndex(p => p?.id === playerId);
    if (playerIndex === -1) return { success: false, error: "Player not in this game." };
    const playerColor = playerIndex === 0 ? 'w' : 'b';
    if (game.drawOffer) return { success: false, error: "A draw offer is already pending." };
    await this.patch({ drawOffer: playerColor });
    return { success: true };
  }
  async respondToDraw(playerId: string, accept: boolean): Promise<{ success: boolean; error?: string }> {
    const game = await this.getState();
    if (game.status !== 'ongoing') return { success: false, error: "Game is not ongoing." };
    if (!game.players[1]) return { success: false, error: "Opponent has not joined yet." };
    const playerIndex = game.players.findIndex(p => p?.id === playerId);
    if (playerIndex === -1) return { success: false, error: "Player not in this game." };
    const playerColor = playerIndex === 0 ? 'w' : 'b';
    if (!game.drawOffer || game.drawOffer === playerColor) {
      return { success: false, error: "No draw offer to respond to." };
    }
    if (accept) {
      await this.patch({ status: 'draw', drawOffer: null, chat: [] }); // Clear chat on game end
      await this.handleGameEnd({ ...game, players: [game.players[0]!, game.players[1]!] }, 'draw');
    } else {
      await this.patch({ drawOffer: null });
    }
    return { success: true };
  }
  async abandon(abandoningPlayerId: string): Promise<void> {
    const game = await this.getState();
    if (game.status !== 'ongoing') return;
    if (!game.players[1]) return;
    const abandoningPlayerIndex = game.players.findIndex(p => p?.id === abandoningPlayerId);
    if (abandoningPlayerIndex === -1) return;
    const winnerIndex = 1 - abandoningPlayerIndex;
    const winner = game.players[winnerIndex];
    if (!winner) return;
    const winnerColor = winnerIndex === 0 ? 'w' : 'b';
    await this.patch({ status: 'abandoned', winner: winnerColor, chat: [] }); // Clear chat on game end
    await this.handleGameEnd({ ...game, players: [game.players[0]!, game.players[1]!] }, 'abandoned', winnerColor);
  }
}
export class PartyEntity extends Entity<{ gameId: string }> {
    static readonly entityName = "party";
    static readonly initialState = { gameId: "" };
    async setGameId(gameId: string): Promise<void> {
        await this.save({ gameId });
    }
    async getGameId(): Promise<string> {
        return (await this.getState()).gameId;
    }
    static generatePartyCode(): string {
        const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
        let result = '';
        for (let i = 0; i < 5; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}
const MAX_CONCURRENT_GAMES = 50;
export class MatchmakingEntity extends Entity<{ queue: string[]; }> {
  static readonly entityName = "singleton";
  static readonly initialState = { queue: [] };
  constructor(env: Env) {
    super(env, "matchmaker");
  }
  async findMatch(playerId: string): Promise<{ status: 'searching' | 'matched' | 'full'; gameId?: string; }> {
    const activeGames = (await GameEntity.list(this.env)).items.filter((g) => g.status === 'ongoing' || g.status === 'waiting');
    if (activeGames.length >= MAX_CONCURRENT_GAMES) {
      return { status: 'full' };
    }
    const mutationResult = await this.mutate((state) => {
      const { queue } = state;
      if (queue.includes(playerId)) return { ...state, opponentId: undefined };
      const waitingOpponent = queue.find(id => id !== playerId);
      if (waitingOpponent) {
        return {
          queue: queue.filter(id => id !== playerId && id !== waitingOpponent),
          opponentId: waitingOpponent,
        };
      } else {
        return {
          queue: [...queue, playerId],
          opponentId: undefined,
        };
      }
    });
    const opponentId = (mutationResult as any).opponentId;
    if (opponentId) {
      const gameId = crypto.randomUUID();
      const player1Profile = await new PlayerEntity(this.env, playerId).getState();
      const player2Profile = await new PlayerEntity(this.env, opponentId).getState();
      const players: [Player, Player] = Math.random() > 0.5 ?
        [{ id: player1Profile.id, name: player1Profile.name }, { id: player2Profile.id, name: player2Profile.name }] :
        [{ id: player2Profile.id, name: player2Profile.name }, { id: player1Profile.id, name: player1Profile.name }];
      await GameEntity.create(this.env, {
        ...GameEntity.initialState,
        id: gameId,
        players,
        status: 'ongoing'
      });
      const matchmakingState = new MatchmakingStateEntity(this.env, playerId);
      await matchmakingState.setGameId(gameId);
      const opponentMatchmakingState = new MatchmakingStateEntity(this.env, opponentId);
      await opponentMatchmakingState.setGameId(gameId);
      return { status: 'matched', gameId };
    }
    return { status: 'searching' };
  }
  async checkMatch(playerId: string): Promise<{ status: 'searching' | 'matched'; gameId?: string; }> {
    const matchmakingState = new MatchmakingStateEntity(this.env, playerId);
    const gameId = await matchmakingState.getGameId();
    if (gameId) {
      await matchmakingState.clearGameId();
      return { status: 'matched', gameId };
    }
    return { status: 'searching' };
  }
}
export class MatchmakingStateEntity extends Entity<{ gameId: string | null; }> {
  static readonly entityName = "matchmaking_state";
  static readonly initialState = { gameId: null };
  constructor(env: Env, playerId: string) {
    super(env, playerId);
  }
  async setGameId(gameId: string): Promise<void> {
    await this.save({ gameId });
  }
  async getGameId(): Promise<string | null> {
    return (await this.getState()).gameId;
  }
  async clearGameId(): Promise<void> {
    await this.save({ gameId: null });
  }
}