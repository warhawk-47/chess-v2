import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion, Variants } from 'framer-motion';
import { Users, Swords, Bot, Users2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/game-store';
import { toast, Toaster } from 'sonner';
import { PrivateGameDialog } from '@/components/PrivateGameDialog';
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 0.5, ease: 'easeOut' },
  }),
};
export function HomePage() {
  const [isPrivateGameModalOpen, setPrivateGameModalOpen] = useState(false);
  const { playerName, isAuthenticated } = useGameStore();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);
  if (!isAuthenticated) {
    return null; // or a loading spinner, though the redirect should be fast
  }
  return (
    <div className="w-full min-h-[calc(100vh-128px)] flex flex-col items-center justify-center p-4 text-center bg-chess-dark text-chess-light overflow-hidden">
      <Toaster richColors />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }}
        className="relative z-10"
      >
        <div className="absolute -top-16 -left-16 w-72 h-72 bg-chess-blue/10 rounded-full filter blur-3xl animate-blob"></div>
        <div className="absolute -bottom-16 -right-16 w-72 h-72 bg-chess-blue/20 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-chess-light to-gray-400">
          Welcome, {playerName}!
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
          Choose your challenge. Will you face the AI, a random opponent, or a friend?
        </p>
      </motion.div>
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariants}>
          <GameModeCard
            icon={<Bot className="w-10 h-10 text-chess-blue" />}
            title="Play vs. AI"
            description="Hone your skills against our chess engine. Perfect for practice."
            linkTo="/game/ai"
            buttonText="Start Game"
          />
        </motion.div>
        <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants}>
          <GameModeCard
            icon={<Users2 className="w-10 h-10 text-chess-blue" />}
            title="Play Local"
            description="Play against a friend on the same computer. A classic hot-seat game."
            linkTo="/game/local"
            buttonText="Start Game"
          />
        </motion.div>
        <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants}>
          <GameModeCard
            icon={<Users className="w-10 h-10 text-chess-blue" />}
            title="Find Random Match"
            description="Get paired with another player online for a competitive game."
            onClick={() => navigate('/lobby')}
            buttonText="Find Match"
          />
        </motion.div>
        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants}>
          <GameModeCard
            icon={<Swords className="w-10 h-10 text-chess-blue" />}
            title="Private Game"
            description="Create a private lobby to play with a friend, or join one with a code."
            onClick={() => setPrivateGameModalOpen(true)}
            buttonText="Create or Join"
          />
        </motion.div>
      </div>
      <PrivateGameDialog
        isOpen={isPrivateGameModalOpen}
        onOpenChange={setPrivateGameModalOpen}
      />
    </div>
  );
}
interface GameModeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  linkTo?: string;
  onClick?: () => void;
  disabled?: boolean;
}
function GameModeCard({ icon, title, description, linkTo, buttonText, onClick, disabled = false }: GameModeCardProps) {
  const content = (
    <div className="h-full flex flex-col justify-between p-8 rounded-xl bg-gray-800/50 border border-gray-700/50 shadow-lg hover:border-chess-blue/50 hover:shadow-chess-blue/10 transition-all duration-300 transform hover:-translate-y-1">
      <div>
        <div className="flex justify-center mb-4">{icon}</div>
        <h3 className="text-2xl font-semibold text-chess-light">{title}</h3>
        <p className="mt-2 text-gray-400">{description}</p>
      </div>
      {linkTo ? (
        <Button asChild className="mt-6 w-full bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold text-lg py-6" size="lg">
          <Link to={linkTo}>{buttonText}</Link>
        </Button>
      ) : (
        <Button
          onClick={onClick}
          className="mt-6 w-full bg-chess-blue hover:bg-chess-blue/90 text-chess-dark font-bold text-lg py-6 disabled:bg-gray-600 disabled:cursor-not-allowed"
          disabled={disabled}
          size="lg"
        >
          {buttonText}
        </Button>
      )}
    </div>
  );
  return <div className="h-full">{content}</div>;
}