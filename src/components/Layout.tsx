import React, { useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Swords, User, LogOut, LogIn, Bell, Mail, UserPlus } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useGameStore } from '@/stores/game-store';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { PlayerProfile } from '@shared/types';
export function Layout() {
  const { playerId, playerName, isAuthenticated, isGuest, logout, invitations, friendRequests, fetchSocialData } = useGameStore();
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      fetchSocialData();
      const socialInterval = setInterval(fetchSocialData, 5000);
      const heartbeatInterval = setInterval(() => {
        if (playerId) {
          api(`/api/players/${playerId}/heartbeat`, { method: 'POST' }).catch(console.error);
        }
      }, 30000); // every 30 seconds
      const handleBeforeUnload = () => {
        if (playerId) {
          // Use sendBeacon for reliability on unload
          navigator.sendBeacon(`/api/players/${playerId}/heartbeat`);
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        clearInterval(socialInterval);
        clearInterval(heartbeatInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isAuthenticated, isGuest, fetchSocialData, playerId]);
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  const handleLoginRegister = () => {
    logout();
    navigate('/');
  };
  const handleAcceptInvite = (gameId: string) => {
    navigate(`/game/${gameId}`);
  };
  const handleDeclineInvite = async (gameId: string) => {
    if (!playerId) return;
    try {
      await api<PlayerProfile>('/api/invites/decline', { method: 'POST', body: JSON.stringify({ playerId, gameId }) });
      toast.info("Invitation declined.");
      fetchSocialData();
    } catch (error) {
      toast.error("Failed to decline invitation.");
    }
  };
  const handleAcceptFriend = async (fromId: string) => {
    if (!playerId) return;
    try {
      await api('/api/friends/accept', { method: 'POST', body: JSON.stringify({ selfId: playerId, fromId }) });
      toast.success("Friend request accepted!");
      fetchSocialData();
    } catch (error) {
      toast.error("Failed to accept friend request.");
    }
  };
  const handleDeclineFriend = async (fromId: string) => {
    if (!playerId) return;
    try {
      await api('/api/friends/decline', { method: 'POST', body: JSON.stringify({ selfId: playerId, fromId }) });
      toast.info("Friend request declined.");
      fetchSocialData();
    } catch (error) {
      toast.error("Failed to decline friend request.");
    }
  };
  const getInitials = (name: string | null) => {
    if (!name) return 'G';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };
  const totalNotifications = invitations.length + friendRequests.length;
  return (
    <div className="flex flex-col min-h-screen bg-chess-dark text-chess-light">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          <Link to={isAuthenticated ? "/dashboard" : "/"} className="mr-6 flex items-center space-x-2">
            <Swords className="h-6 w-6 text-chess-blue" />
            <span className="font-bold text-lg">ChessEdge</span>
          </Link>
          <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-4">
            {isAuthenticated && !isGuest && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {totalNotifications > 0 && (
                      <span className="absolute top-0 right-0 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 bg-gray-800 border-gray-700 text-chess-light" align="end">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  {totalNotifications === 0 ? (
                    <DropdownMenuItem disabled className="justify-center py-4">No new notifications</DropdownMenuItem>
                  ) : (
                    <>
                      {invitations.map(invite => (
                        <DropdownMenuItem key={invite.gameId} className="flex justify-between items-center focus:bg-chess-blue/20" onSelect={(e) => e.preventDefault()}>
                          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-chess-blue" /><span>Game invite: <strong>{invite.fromName}</strong></span></div>
                          <div className="flex gap-2"><Button size="sm" className="h-7" onClick={() => handleAcceptInvite(invite.gameId)}>Accept</Button><Button size="sm" variant="destructive" className="h-7" onClick={() => handleDeclineInvite(invite.gameId)}>Decline</Button></div>
                        </DropdownMenuItem>
                      ))}
                      {friendRequests.length > 0 && invitations.length > 0 && <DropdownMenuSeparator className="bg-gray-700" />}
                      {friendRequests.map(req => (
                        <DropdownMenuItem key={req.fromId} className="flex justify-between items-center focus:bg-chess-blue/20" onSelect={(e) => e.preventDefault()}>
                          <div className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-chess-blue" /><span>Friend request: <strong>{req.fromName}</strong></span></div>
                          <div className="flex gap-2"><Button size="sm" className="h-7" onClick={() => handleAcceptFriend(req.fromId)}>Accept</Button><Button size="sm" variant="destructive" className="h-7" onClick={() => handleDeclineFriend(req.fromId)}>Decline</Button></div>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-auto justify-start gap-2 px-2 sm:px-3">
                    <Avatar className="h-8 w-8"><AvatarFallback className="bg-chess-blue text-chess-dark font-bold">{getInitials(playerName)}</AvatarFallback></Avatar>
                    <span className="hidden sm:inline-block">{playerName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-gray-800 border-gray-700 text-chess-light" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1"><p className="text-sm font-medium leading-none">{playerName}</p><p className="text-xs leading-none text-muted-foreground">{isGuest ? 'Guest Player' : 'Registered Player'}</p></div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  {!isGuest && playerId && (<DropdownMenuItem onSelect={() => navigate(`/profile/${playerId}`)} className="cursor-pointer focus:bg-chess-blue/20"><User className="mr-2 h-4 w-4" /><span>My Profile</span></DropdownMenuItem>)}
                  {isGuest ? (<DropdownMenuItem onSelect={handleLoginRegister} className="cursor-pointer focus:bg-chess-blue/20"><LogIn className="mr-2 h-4 w-4" /><span>Login / Register</span></DropdownMenuItem>) : (<DropdownMenuItem onSelect={handleLogout} className="cursor-pointer focus:bg-chess-blue/20"><LogOut className="mr-2 h-4 w-4" /><span>Log out</span></DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ThemeToggle className="relative top-0 right-0" />
          </div>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="py-6 md:px-8 md:py-0"><div className="container flex flex-col items-center justify-center gap-4 md:h-24 md:flex-row"><p className="text-balance text-center text-sm leading-loose text-muted-foreground">Built with ❤️ at Cloudflare.</p></div></footer>
    </div>
  );
}