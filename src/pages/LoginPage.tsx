import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Swords, User, Key, UserPlus, Ghost } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGameStore } from '@/stores/game-store';
import { api } from '@/lib/api-client';
import { PlayerProfile } from '@shared/types';
import { toast, Toaster } from 'sonner';
export function LoginPage() {
  const navigate = useNavigate();
  const { setPlayer, isAuthenticated } = useGameStore();
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
      const guestProfile = await api<PlayerProfile>('/api/auth/guest', { method: 'POST' });
      setPlayer(guestProfile.id, guestProfile.name, true);
      toast.success(`Welcome, ${guestProfile.name}!`);
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create a guest session.');
    } finally {
      setIsLoading(false);
    }
  };
  if (isAuthenticated) {
    return null; // Render nothing while redirecting
  }
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-4 bg-chess-dark text-chess-light overflow-hidden">
      <Toaster richColors />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute top-8 flex items-center gap-2"
      >
        <Swords className="h-8 w-8 text-chess-blue" />
        <h1 className="text-3xl font-bold">ChessEdge</h1>
      </motion.div>
      <div className="relative z-10">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-chess-blue/10 rounded-full filter blur-3xl animate-blob"></div>
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-chess-blue/20 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Tabs defaultValue="login" className="w-[400px]">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <AuthCard title="Welcome Back" description="Log in to continue your journey.">
              <AuthForm isLogin setIsLoading={setIsLoading} />
            </AuthCard>
          </TabsContent>
          <TabsContent value="register">
            <AuthCard title="Create an Account" description="Join the ranks of ChessEdge players.">
              <AuthForm setIsLoading={setIsLoading} />
            </AuthCard>
          </TabsContent>
        </Tabs>
        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-gray-600"></div>
          <span className="flex-shrink mx-4 text-gray-400">OR</span>
          <div className="flex-grow border-t border-gray-600"></div>
        </div>
        <Button
          onClick={handleGuestLogin}
          disabled={isLoading}
          variant="outline"
          className="w-full bg-transparent border-chess-blue text-chess-blue hover:bg-chess-blue hover:text-chess-dark"
        >
          <Ghost className="mr-2 h-4 w-4" />
          Play as Guest
        </Button>
      </motion.div>
    </div>
  );
}
function AuthCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="bg-gray-800/50 border-gray-700/50">
      <CardHeader className="text-center">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}
function AuthForm({ isLogin = false, setIsLoading }: { isLogin?: boolean; setIsLoading: (loading: boolean) => void }) {
  const navigate = useNavigate();
  const setPlayer = useGameStore((state) => state.setPlayer);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) {
      toast.error('Username and password are required.');
      return;
    }
    setIsLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const profile = await api<PlayerProfile>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), password }),
      });
      setPlayer(profile.id, profile.name, false);
      toast.success(isLogin ? `Welcome back, ${profile.name}!` : 'Registration successful! Welcome.');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || `Failed to ${isLogin ? 'log in' : 'register'}.`);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input id="username" type="text" placeholder="YourPlayerName" required value={name} onChange={(e) => setName(e.target.value)} className="pl-10 bg-gray-900" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input id="password" type="password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-gray-900" />
        </div>
      </div>
      <Button type="submit" className="w-full bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold">
        {isLogin ? 'Log In' : 'Register'}
        {isLogin ? null : <UserPlus className="ml-2 h-4 w-4" />}
      </Button>
    </form>
  );
}