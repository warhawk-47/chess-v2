import { Hono } from "hono";
import type { Env } from './core-utils';
import { PlayerEntity, GameEntity, MatchmakingEntity, PlayerNameLockEntity, PartyEntity, GameHistoryEntity } from "./entities";
import { ok, bad, notFound, isStr } from './core-utils';
import type { Move, CreateGameResponse, PlayerProfile, GameInvitation, Player, FriendRequest } from "@shared/types";
const MOCK_HASH_PASSWORD = (password: string) => `hashed_${password}`;
const MOCK_COMPARE_PASSWORD = (password: string, hash: string) => `hashed_${password}` === hash;
const OFFLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // AUTH ROUTES
  app.post('/api/auth/register', async (c) => {
    const { name, password } = await c.req.json<{ name?: string; password?: string }>();
    if (!isStr(name) || name.length < 3 || name.length > 15) return bad(c, 'Username must be between 3 and 15 characters');
    if (!isStr(password) || password.length < 6) return bad(c, 'Password must be at least 6 characters long');
    const id = crypto.randomUUID();
    const normalizedName = name.trim().toLowerCase();
    const nameLock = new PlayerNameLockEntity(c.env, normalizedName);
    if (!await nameLock.acquire(id)) return bad(c, 'Username is already taken');
    const hashedPassword = MOCK_HASH_PASSWORD(password);
    const player = await PlayerEntity.create(c.env, { ...PlayerEntity.initialState, id, name: name.trim(), password: hashedPassword });
    const { password: _, ...safePlayer } = player;
    return ok(c, safePlayer);
  });
  app.post('/api/auth/login', async (c) => {
    const { name, password } = await c.req.json<{ name?: string; password?: string }>();
    if (!isStr(name) || !isStr(password)) return bad(c, 'Username and password are required');
    const normalizedName = name.trim().toLowerCase();
    const nameLock = new PlayerNameLockEntity(c.env, normalizedName);
    const playerId = await nameLock.getPlayerId();
    if (!playerId) return notFound(c, 'Invalid username or password');
    const playerEntity = new PlayerEntity(c.env, playerId);
    if (!await playerEntity.exists()) return notFound(c, 'Invalid username or password');
    const player = await playerEntity.getState();
    if (!player.password || !MOCK_COMPARE_PASSWORD(password, player.password)) return bad(c, 'Invalid username or password');
    const { password: _, ...safePlayer } = player;
    return ok(c, safePlayer);
  });
  app.post('/api/auth/guest', async (c) => {
    const id = crypto.randomUUID();
    const guestName = `Guest_${id.substring(0, 5)}`;
    const player = await PlayerEntity.create(c.env, { ...PlayerEntity.initialState, id, name: guestName });
    return ok(c, player);
  });
  // PLAYER ROUTES
  app.get('/api/players', async (c) => {
    const { items } = await PlayerEntity.list(c.env);
    const players: Player[] = items.map(({ id, name, lastSeen }) => ({
      id,
      name,
      status: (Date.now() - (lastSeen || 0)) < OFFLINE_THRESHOLD ? 'online' : 'offline',
    }));
    return ok(c, players);
  });
  app.get('/api/players/:id', async (c) => {
    const { id } = c.req.param();
    const player = new PlayerEntity(c.env, id);
    if (!await player.exists()) return notFound(c, 'Player not found');
    const profile = await player.getState();
    profile.status = (Date.now() - (profile.lastSeen || 0)) < OFFLINE_THRESHOLD ? 'online' : 'offline';
    const { password: _, ...safeProfile } = profile;
    return ok(c, safeProfile);
  });
  app.get('/api/players/:id/history', async (c) => {
    const { id } = c.req.param();
    const historyEntity = new GameHistoryEntity(c.env, id);
    if (!await historyEntity.exists()) return ok(c, []);
    const history = await historyEntity.getState();
    return ok(c, history.games);
  });
  app.post('/api/players/:id/heartbeat', async (c) => {
    const { id } = c.req.param();
    const player = new PlayerEntity(c.env, id);
    if (!await player.exists()) return notFound(c, 'Player not found');
    await player.heartbeat();
    return ok(c, { message: 'Heartbeat received' });
  });
  // FRIEND ROUTES
  app.get('/api/friends', async (c) => {
    const { playerId } = c.req.query();
    if (!isStr(playerId)) return bad(c, 'playerId is required');
    const player = new PlayerEntity(c.env, playerId);
    if (!await player.exists()) return notFound(c, 'Player not found');
    const profile = await player.getState();
    if (!profile.friends || profile.friends.length === 0) return ok(c, []);
    const friendProfiles = await Promise.all(
      profile.friends.map(async (friendId) => {
        const friendEntity = new PlayerEntity(c.env, friendId);
        if (await friendEntity.exists()) {
          const { id, name, lastSeen } = await friendEntity.getState();
          return { id, name, status: (Date.now() - (lastSeen || 0)) < OFFLINE_THRESHOLD ? 'online' : 'offline' };
        }
        return null;
      })
    );
    return ok(c, friendProfiles.filter(p => p !== null));
  });
  app.post('/api/friends/request', async (c) => {
    const { fromId, fromName, toId } = await c.req.json<{ fromId?: string; fromName?: string; toId?: string }>();
    if (!isStr(fromId) || !isStr(fromName) || !isStr(toId)) return bad(c, 'fromId, fromName, and toId are required');
    if (fromId === toId) return bad(c, 'You cannot send a friend request to yourself.');
    const toPlayer = new PlayerEntity(c.env, toId);
    if (!await toPlayer.exists()) return notFound(c, 'Player not found.');
    const fromPlayer = new PlayerEntity(c.env, fromId);
    if (!await fromPlayer.exists()) return notFound(c, 'Sending player not found.');
    const request: FriendRequest = { fromId, fromName };
    await toPlayer.addFriendRequest(request);
    await fromPlayer.addSentFriendRequest(toId);
    return ok(c, { message: 'Friend request sent.' });
  });
  app.post('/api/friends/accept', async (c) => {
    const { selfId, fromId } = await c.req.json<{ selfId?: string; fromId?: string }>();
    if (!isStr(selfId) || !isStr(fromId)) return bad(c, 'selfId and fromId are required');
    const selfPlayer = new PlayerEntity(c.env, selfId);
    const fromPlayer = new PlayerEntity(c.env, fromId);
    if (!await selfPlayer.exists() || !await fromPlayer.exists()) return notFound(c, 'One or both players not found.');
    await selfPlayer.addFriend(fromId);
    await fromPlayer.addFriend(selfId);
    await selfPlayer.removeFriendRequest(fromId);
    await fromPlayer.removeSentFriendRequest(selfId);
    return ok(c, { message: 'Friend request accepted.' });
  });
  app.post('/api/friends/decline', async (c) => {
    const { selfId, fromId } = await c.req.json<{ selfId?: string; fromId?: string }>();
    if (!isStr(selfId) || !isStr(fromId)) return bad(c, 'selfId and fromId are required');
    const selfPlayer = new PlayerEntity(c.env, selfId);
    const fromPlayer = new PlayerEntity(c.env, fromId);
    await selfPlayer.removeFriendRequest(fromId);
    if (await fromPlayer.exists()) {
      await fromPlayer.removeSentFriendRequest(selfId);
    }
    return ok(c, { message: 'Friend request declined.' });
  });
  app.delete('/api/friends/:friendId', async (c) => {
    const { friendId } = c.req.param();
    const { selfId } = await c.req.json<{ selfId?: string }>();
    if (!isStr(selfId)) return bad(c, 'selfId is required');
    const selfPlayer = new PlayerEntity(c.env, selfId);
    const friendPlayer = new PlayerEntity(c.env, friendId);
    await selfPlayer.removeFriend(friendId);
    if (await friendPlayer.exists()) {
      await friendPlayer.removeFriend(selfId);
    }
    return ok(c, { message: 'Friend removed.' });
  });
  // INVITATION ROUTES
  app.post('/api/invites/send', async (c) => {
    const { fromPlayerId, fromPlayerName, toPlayerId } = await c.req.json<{ fromPlayerId?: string; fromPlayerName?: string; toPlayerId?: string }>();
    if (!isStr(fromPlayerId) || !isStr(fromPlayerName) || !isStr(toPlayerId)) return bad(c, 'fromPlayerId, fromPlayerName, and toPlayerId are required');
    if (fromPlayerId === toPlayerId) return bad(c, 'You cannot invite yourself to a game.');
    const toPlayer = new PlayerEntity(c.env, toPlayerId);
    if (!await toPlayer.exists()) return notFound(c, 'The player you are trying to invite does not exist.');
    const gameId = crypto.randomUUID();
    await GameEntity.create(c.env, { ...GameEntity.initialState, id: gameId, players: [{ id: fromPlayerId, name: fromPlayerName }, null], status: 'waiting' });
    const fromPlayer = new PlayerEntity(c.env, fromPlayerId);
    await fromPlayer.setCurrentGame(gameId);
    const invitation: GameInvitation = { fromId: fromPlayerId, fromName: fromPlayerName, gameId };
    await toPlayer.addGameInvitation(invitation);
    return ok(c, { message: 'Invitation sent successfully.' });
  });
  app.post('/api/invites/decline', async (c) => {
    const { playerId, gameId } = await c.req.json<{ playerId?: string; gameId?: string }>();
    if (!isStr(playerId) || !isStr(gameId)) return bad(c, 'playerId and gameId are required');
    const player = new PlayerEntity(c.env, playerId);
    if (!await player.exists()) return notFound(c, 'Player not found.');
    await player.removeGameInvitation(gameId);
    const profile = await player.getState();
    const { password: _, ...safeProfile } = profile;
    return ok(c, safeProfile);
  });
  // MATCHMAKING ROUTES
  app.post('/api/matchmaking/find', async (c) => {
    const { playerId } = await c.req.json<{ playerId?: string }>();
    if (!isStr(playerId)) return bad(c, 'playerId is required');
    const matchmaker = new MatchmakingEntity(c.env);
    const result = await matchmaker.findMatch(playerId);
    if (result.status === 'matched' && result.gameId) {
        const game = await new GameEntity(c.env, result.gameId).getState();
        const player1 = new PlayerEntity(c.env, game.players[0]!.id);
        const player2 = new PlayerEntity(c.env, game.players[1]!.id);
        await player1.setCurrentGame(result.gameId);
        await player2.setCurrentGame(result.gameId);
    }
    return ok(c, result);
  });
  app.get('/api/matchmaking/status/:playerId', async (c) => {
    const { playerId } = c.req.param();
    if (!isStr(playerId)) return bad(c, 'playerId is required');
    const matchmaker = new MatchmakingEntity(c.env);
    const result = await matchmaker.checkMatch(playerId);
    return ok(c, result);
  });
  // GAME ROUTES
  app.post('/api/games/create', async (c) => {
    const { playerId, playerName } = await c.req.json<{ playerId?: string, playerName?: string }>();
    if (!isStr(playerId) || !isStr(playerName)) return bad(c, 'playerId and playerName are required');
    const gameId = crypto.randomUUID();
    let partyCode: string;
    let partyEntity: PartyEntity;
    while (true) {
        partyCode = PartyEntity.generatePartyCode();
        partyEntity = new PartyEntity(c.env, partyCode);
        if (!(await partyEntity.exists())) break;
    }
    await partyEntity.setGameId(gameId);
    const newGame = await GameEntity.create(c.env, { ...GameEntity.initialState, id: gameId, players: [{ id: playerId, name: playerName }, null], status: 'waiting', partyCode });
    const player = new PlayerEntity(c.env, playerId);
    await player.setCurrentGame(gameId);
    return ok(c, { game: newGame, partyCode } as CreateGameResponse);
  });
  app.get('/api/games/:gameId', async (c) => {
    const { gameId } = c.req.param();
    const gameEntity = new GameEntity(c.env, gameId);
    if (!await gameEntity.exists()) return notFound(c, 'Game not found');
    const game = await gameEntity.getState();
    if (game.status === 'ongoing' && game.players[1]) {
        const p1 = new PlayerEntity(c.env, game.players[0]!.id);
        const p2 = new PlayerEntity(c.env, game.players[1]!.id);
        const [p1State, p2State] = await Promise.all([p1.getState(), p2.getState()]);
        const now = Date.now();
        if (now - (p1State.lastSeen || 0) > OFFLINE_THRESHOLD) {
            await gameEntity.abandon(p1State.id);
            return ok(c, await gameEntity.getState());
        }
        if (now - (p2State.lastSeen || 0) > OFFLINE_THRESHOLD) {
            await gameEntity.abandon(p2State.id);
            return ok(c, await gameEntity.getState());
        }
    }
    return ok(c, game);
  });
  app.post('/api/games/:gameId/join', async (c) => {
    const { gameId } = c.req.param();
    const { playerId, playerName } = await c.req.json<{ playerId?: string, playerName?: string }>();
    if (!isStr(playerId) || !isStr(playerName)) return bad(c, 'playerId and playerName are required');
    const game = new GameEntity(c.env, gameId);
    if (!await game.exists()) return notFound(c, 'Game not found');
    const result = await game.addPlayer({ id: playerId, name: playerName });
    if (!result.success) return bad(c, result.error || 'Failed to join game');
    const player = new PlayerEntity(c.env, playerId);
    if (await player.exists()) {
      await player.removeGameInvitation(gameId);
      await player.setCurrentGame(gameId);
    }
    return ok(c, await game.getState());
  });
  app.post('/api/games/:gameId/move', async (c) => {
    const { gameId } = c.req.param();
    const { playerId, move } = await c.req.json<{ playerId?: string; move?: Move }>();
    if (!isStr(playerId) || !move) return bad(c, 'playerId and move are required');
    const game = new GameEntity(c.env, gameId);
    if (!await game.exists()) return notFound(c, 'Game not found');
    const result = await game.makeMove(playerId, move);
    if (!result.success) return bad(c, result.error || 'Failed to make move');
    return ok(c, await game.getState());
  });
  app.post('/api/games/:gameId/chat', async (c) => {
    const { gameId } = c.req.param();
    const { playerId, playerName, text } = await c.req.json<{ playerId?: string; playerName?: string; text?: string }>();
    if (!isStr(playerId) || !isStr(playerName) || !isStr(text)) return bad(c, 'playerId, playerName, and text are required');
    const game = new GameEntity(c.env, gameId);
    if (!await game.exists()) return notFound(c, 'Game not found');
    await game.addChatMessage(playerId, playerName, text);
    return ok(c, await game.getState());
  });
  app.post('/api/games/:gameId/offer-draw', async (c) => {
    const { gameId } = c.req.param();
    const { playerId } = await c.req.json<{ playerId?: string }>();
    if (!isStr(playerId)) return bad(c, 'playerId is required');
    const game = new GameEntity(c.env, gameId);
    if (!await game.exists()) return notFound(c, 'Game not found');
    const result = await game.offerDraw(playerId);
    if (!result.success) return bad(c, result.error || 'Failed to offer draw');
    return ok(c, await game.getState());
  });
  app.post('/api/games/:gameId/respond-draw', async (c) => {
    const { gameId } = c.req.param();
    const { playerId, accept } = await c.req.json<{ playerId?: string; accept?: boolean }>();
    if (!isStr(playerId) || typeof accept !== 'boolean') return bad(c, 'playerId and accept are required');
    const game = new GameEntity(c.env, gameId);
    if (!await game.exists()) return notFound(c, 'Game not found');
    const result = await game.respondToDraw(playerId, accept);
    if (!result.success) return bad(c, result.error || 'Failed to respond to draw');
    return ok(c, await game.getState());
  });
  // PARTY ROUTES
  app.post('/api/parties/join', async (c) => {
    const { partyCode, playerId, playerName } = await c.req.json<{ partyCode?: string; playerId?: string; playerName?: string }>();
    if (!isStr(partyCode) || !isStr(playerId) || !isStr(playerName)) return bad(c, 'partyCode, playerId, and playerName are required');
    const party = new PartyEntity(c.env, partyCode.toUpperCase());
    if (!await party.exists()) return notFound(c, 'Party code not found or has expired.');
    const gameId = await party.getGameId();
    if (!isStr(gameId)) return notFound(c, 'The game for this party code could not be found.');
    const game = new GameEntity(c.env, gameId);
    if (!await game.exists()) return notFound(c, 'Game associated with party code not found.');
    const result = await game.addPlayer({ id: playerId, name: playerName });
    if (!result.success) return bad(c, result.error || 'Failed to join game');
    return ok(c, await game.getState());
  });
}