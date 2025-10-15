import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
interface ShowPartyCodeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  partyCode: string;
}
export function ShowPartyCodeDialog({ isOpen, onOpenChange, partyCode }: ShowPartyCodeDialogProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(partyCode);
    toast.success('Party code copied to clipboard!');
  };
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-chess-dark text-chess-light border-chess-blue">
        <DialogHeader>
          <DialogTitle>Your Party is Ready!</DialogTitle>
          <DialogDescription>
            Share this code with a friend so they can join your game.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 mt-2 p-2 rounded bg-gray-900">
          <Input
            readOnly
            value={partyCode}
            className="bg-transparent border-0 text-chess-light text-2xl font-bold tracking-widest text-center"
          />
          <Button size="icon" variant="ghost" onClick={handleCopy}>
            <Copy className="w-5 h-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}