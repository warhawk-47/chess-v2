import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Loader2, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useGameStore } from '@/stores/game-store';
import { api } from '@/lib/api-client';
import { CreateGameResponse, Game, Player } from '@shared/types';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
interface PrivateGameDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}
export function PrivateGameDialog({ isOpen, onOpenChange }: PrivateGameDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [partyCode, setPartyCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { playerId, playerName } = useGameStore();
  const handleCreateParty = async () => {
    setIsLoading(true);
    try {
      const { game, partyCode } = await api<CreateGameResponse>('/api/games/create', {
        method: 'POST',
        body: JSON.stringify({ playerId, playerName }),
      });
      setPartyCode(partyCode);
      setCreatedGameId(game.id);
      toast.success("Private game created! Share the code with your friend.");
    } catch (error) {
      toast.error('Failed to create private game. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  const handleJoinParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      toast.error("Please enter a party code.");
      return;
    }
    setIsLoading(true);
    try {
      const game = await api<Game>('/api/parties/join', {
        method: 'POST',
        body: JSON.stringify({ partyCode: joinCode.trim().toUpperCase(), playerId, playerName }),
      });
      toast.success("Joined game successfully!");
      onOpenChange(false);
      navigate(`/game/${game.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to join game. Check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  };
  const handleCopyToClipboard = () => {
    try {
      navigator.clipboard.writeText(partyCode);
      toast.success('Party code copied to clipboard!');
    } catch (error) {
      toast.error('Could not copy to clipboard.');
    }
  };
  const handleGoToGame = () => {
    if (createdGameId) {
      onOpenChange(false);
      navigate(`/game/${createdGameId}`);
    } else {
      toast.error("Could not find the game to join.");
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        setPartyCode('');
        setJoinCode('');
        setCreatedGameId(null);
      }
    }}>
      <DialogContent className="bg-chess-dark text-chess-light border-chess-blue sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Private Game</DialogTitle>
          <DialogDescription>Create a party, join with a code, or invite a player.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800/50">
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="join">Join</TabsTrigger>
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="invite">Players</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="mt-4">
            {partyCode ? (
              <div className="space-y-4 text-center">
                <p>Share this code with your friend:</p>
                <div className="flex items-center gap-2 p-2 rounded bg-gray-900">
                  <Input readOnly value={partyCode} className="bg-transparent border-0 text-chess-light text-2xl font-bold tracking-widest text-center" />
                  <Button size="icon" variant="ghost" onClick={handleCopyToClipboard}><Copy className="w-5 h-5" /></Button>
                </div>
                <Button onClick={handleGoToGame} disabled={isLoading} className="w-full bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Go to Game"}
                </Button>
              </div>
            ) : (
              <Button onClick={handleCreateParty} disabled={isLoading} className="w-full bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create New Party
              </Button>
            )}
          </TabsContent>
          <TabsContent value="join" className="mt-4">
            <form onSubmit={handleJoinParty} className="space-y-4">
              <Input placeholder="Enter Party Code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className="bg-gray-900 text-center text-lg tracking-widest" maxLength={5} />
              <Button type="submit" disabled={isLoading} className="w-full bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Join Party
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="friends" className="mt-4"><FriendInviteTab /></TabsContent>
          <TabsContent value="invite" className="mt-4"><PlayerInviteTab /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
function PlayerInviteTab() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [invitedPlayers, setInvitedPlayers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { playerId, playerName } = useGameStore();
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const allPlayers = await api<Player[]>('/api/players');
        setPlayers(allPlayers.filter(p => p.id !== playerId));
      } catch (error) {
        toast.error("Failed to load player list.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlayers();
  }, [playerId]);
  const handleInvite = async (toPlayerId: string) => {
    if (!playerId || !playerName) return;
    setInvitedPlayers(prev => new Set(prev).add(toPlayerId));
    try {
      await api('/api/invites/send', { method: 'POST', body: JSON.stringify({ fromPlayerId: playerId, fromPlayerName: playerName, toPlayerId }) });
      toast.success("Invitation sent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation.");
      setInvitedPlayers(prev => { const newSet = new Set(prev); newSet.delete(toPlayerId); return newSet; });
    }
  };
  const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search for a player..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-gray-900" />
      </div>
      <ScrollArea className="h-[200px] w-full pr-4">
        {isLoading ? <div className="flex justify-center items-center h-full"><Loader2 className="w-6 h-6 animate-spin" /></div>
          : filteredPlayers.length === 0 ? <p className="text-center text-gray-400 py-8">No players found.</p>
          : <div className="space-y-2">{filteredPlayers.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", p.status === 'online' ? 'bg-green-500' : 'bg-gray-500')} />
                  <span className="font-medium">{p.name}</span>
                </div>
                <Button size="sm" variant={invitedPlayers.has(p.id) ? "secondary" : "default"} disabled={invitedPlayers.has(p.id)} onClick={() => handleInvite(p.id)} className="h-8 bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold disabled:bg-gray-600">
                  <UserPlus className="mr-2 h-4 w-4" />{invitedPlayers.has(p.id) ? "Invited" : "Invite"}
                </Button>
              </div>))}
          </div>}
      </ScrollArea>
    </div>
  );
}
function FriendInviteTab() {
  const { friends, playerId, playerName } = useGameStore();
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
  const handleInvite = async (toPlayerId: string) => {
    if (!playerId || !playerName) return;
    setInvitedFriends(prev => new Set(prev).add(toPlayerId));
    try {
      await api('/api/invites/send', { method: 'POST', body: JSON.stringify({ fromPlayerId: playerId, fromPlayerName: playerName, toPlayerId }) });
      toast.success("Invitation sent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation.");
      setInvitedFriends(prev => { const newSet = new Set(prev); newSet.delete(toPlayerId); return newSet; });
    }
  };
  return (
    <div className="space-y-4">
      <ScrollArea className="h-[252px] w-full pr-4">
        {friends.length === 0 ? <p className="text-center text-gray-400 py-8">You have no friends yet. Add some from their profile page!</p>
          : <div className="space-y-2">{friends.map(f => (
              <div key={f.id} className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", f.status === 'online' ? 'bg-green-500' : 'bg-gray-500')} />
                  <span className="font-medium">{f.name}</span>
                </div>
                <Button size="sm" variant={invitedFriends.has(f.id) ? "secondary" : "default"} disabled={invitedFriends.has(f.id)} onClick={() => handleInvite(f.id)} className="h-8 bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold disabled:bg-gray-600">
                  <UserPlus className="mr-2 h-4 w-4" />{invitedFriends.has(f.id) ? "Invited" : "Invite"}
                </Button>
              </div>))}
          </div>}
      </ScrollArea>
    </div>
  );
}