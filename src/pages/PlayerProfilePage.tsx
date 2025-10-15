import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api-client';
import { PlayerProfile, GameSummary } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, User, BarChart2, Trophy, Shield, Handshake, UserPlus, UserMinus, UserCheck, History } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/stores/game-store';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
export function PlayerProfilePage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [selfProfile, setSelfProfile] = useState<PlayerProfile | null>(null);
  const [history, setHistory] = useState<GameSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { playerId: selfPlayerId, playerName: selfPlayerName, isGuest } = useGameStore();
  useEffect(() => {
    if (!playerId) {
      navigate('/');
      return;
    }
    const fetchAllData = async () => {
      try {
        const profileData = api<PlayerProfile>(`/api/players/${playerId}`);
        const historyData = api<GameSummary[]>(`/api/players/${playerId}/history`);
        const selfProfileData = selfPlayerId ? api<PlayerProfile>(`/api/players/${selfPlayerId}`) : Promise.resolve(null);
        const [profile, self, history] = await Promise.all([profileData, selfProfileData, historyData]);
        setProfile(profile);
        setSelfProfile(self);
        setHistory(history);
      } catch (error) {
        toast.error("Could not load player profile.");
        console.error(error);
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, [playerId, selfPlayerId, navigate]);
  const friendshipStatus = useMemo(() => {
    if (!selfProfile || !profile) return 'none';
    if (selfProfile.friends?.includes(profile.id)) return 'friends';
    if (selfProfile.sentFriendRequests?.includes(profile.id)) return 'sent';
    if (selfProfile.incomingFriendRequests?.some(req => req.fromId === profile.id)) return 'received';
    return 'none';
  }, [selfProfile, profile]);
  const handleFriendAction = async () => {
    if (!selfPlayerId || !selfPlayerName || !profile) return;
    try {
      let message = '';
      if (friendshipStatus === 'none') {
        await api('/api/friends/request', { method: 'POST', body: JSON.stringify({ fromId: selfPlayerId, fromName: selfPlayerName, toId: profile.id }) });
        message = 'Friend request sent!';
      } else if (friendshipStatus === 'friends') {
        await api(`/api/friends/${profile.id}`, { method: 'DELETE', body: JSON.stringify({ selfId: selfPlayerId }) });
        message = 'Friend removed.';
      }
      toast.success(message);
      const updatedSelf = await api<PlayerProfile>(`/api/players/${selfPlayerId}`);
      setSelfProfile(updatedSelf);
    } catch (error: any) {
      toast.error(error.message || 'An error occurred.');
    }
  };
  if (isLoading) {
    return <div className="w-full min-h-[calc(100vh-128px)] flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-chess-blue" /></div>;
  }
  if (!profile) {
    return <div className="w-full min-h-[calc(100vh-128px)] flex items-center justify-center"><p>Player not found.</p></div>;
  }
  const winRate = profile.gamesPlayed > 0 ? ((profile.wins / profile.gamesPlayed) * 100).toFixed(1) : 0;
  const chartData = [{ name: 'Wins', value: profile.wins }, { name: 'Losses', value: profile.losses }, { name: 'Draws', value: profile.draws }];
  const COLORS = ['#3498db', '#c0392b', '#7f8c8d'];
  const isOwnProfile = selfPlayerId === profile.id;
  const renderFriendButton = () => {
    if (isOwnProfile || isGuest) return null;
    switch (friendshipStatus) {
      case 'friends':
        return <Button onClick={handleFriendAction} variant="destructive" className="font-bold"><UserMinus className="mr-2 h-4 w-4" />Remove Friend</Button>;
      case 'sent':
        return <Button disabled className="bg-gray-600 font-bold"><UserCheck className="mr-2 h-4 w-4" />Request Sent</Button>;
      case 'received':
        return <Button onClick={() => navigate('/dashboard')} className="bg-green-600 hover:bg-green-500 text-white font-bold">Respond to Request</Button>;
      default:
        return <Button onClick={handleFriendAction} className="bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold"><UserPlus className="mr-2 h-4 w-4" />Add Friend</Button>;
    }
  };
  return (
    <div className="container mx-auto p-4 md:p-8">
      <Toaster richColors />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <Card className="xl:col-span-2 bg-gray-800/50 border-gray-700/50">
          <CardHeader className="text-center border-b border-gray-700/50 pb-6">
            <div className="flex justify-center mb-4"><div className="p-4 bg-chess-blue/20 rounded-full border-2 border-chess-blue"><User className="w-12 h-12 text-chess-blue" /></div></div>
            <div className="flex items-center justify-center gap-4">
              <CardTitle className="text-4xl font-bold">{profile.name}</CardTitle>
              <Badge variant={profile.status === 'online' ? 'default' : 'secondary'} className={profile.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}>
                {profile.status === 'online' ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <p className="text-gray-400">Career Statistics</p>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <StatItem icon={<BarChart2 />} label="Total Games Played" value={profile.gamesPlayed} />
              <StatItem icon={<Trophy />} label="Wins" value={profile.wins} className="text-green-400" />
              <StatItem icon={<Shield />} label="Losses" value={profile.losses} className="text-red-400" />
              <StatItem icon={<Handshake />} label="Draws" value={profile.draws} className="text-gray-400" />
              <StatItem icon={<BarChart2 />} label="Win Rate" value={`${winRate}%`} />
            </div>
            <div className="w-full h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>{chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgb(44, 62, 80)', borderColor: 'rgb(52, 152, 219)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          <CardFooter className="pt-6 border-t border-gray-700/50 flex justify-center">{renderFriendButton()}</CardFooter>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="w-5 h-5 text-chess-blue" /> Recent Games</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px] pr-4">
              {history.length === 0 ? (
                <p className="text-center text-gray-400 py-16">No games played yet.</p>
              ) : (
                <div className="space-y-3">
                  {history.map(game => <GameHistoryItem key={game.gameId} game={game} playerName={profile.name} />)}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function StatItem({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string | number; className?: string; }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
      <div className="flex items-center gap-3"><div className="text-chess-blue">{icon}</div><span className="text-gray-300">{label}</span></div>
      <span className={`text-xl font-semibold ${className}`}>{value}</span>
    </div>
  );
}
function GameHistoryItem({ game, playerName }: { game: GameSummary; playerName: string }) {
  const opponentName = game.whitePlayerName === playerName ? game.blackPlayerName : game.whitePlayerName;
  const resultColor = game.result === 'win' ? 'text-green-400' : game.result === 'loss' ? 'text-red-400' : 'text-gray-400';
  const resultText = game.result.charAt(0).toUpperCase() + game.result.slice(1);
  return (
    <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
      <div>
        <p className="font-semibold">vs {opponentName}</p>
        <p className="text-sm text-gray-400">{formatDistanceToNow(new Date(game.date), { addSuffix: true })}</p>
      </div>
      <Badge className={`${resultColor} bg-opacity-20 border-none`}>{resultText}</Badge>
    </div>
  );
}