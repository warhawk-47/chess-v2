import { useMemo, useCallback } from 'react';
// This hook provides a stable way to play audio using the native browser Audio API.
// It memoizes the Audio objects to prevent re-creation on every render, ensuring performance.
export function useGameSounds() {
  const sounds = useMemo(() => ({
    move: new Audio('/sounds/move.mp3'),
    capture: new Audio('/sounds/capture.mp3'),
    gameEnd: new Audio('/sounds/game-end.mp3'),
    check: new Audio('/sounds/check.mp3'),
  }), []);
  const playSound = useCallback((audio: HTMLAudioElement) => {
    // Allows re-playing the sound even if it's already playing.
    audio.currentTime = 0;
    audio.play().catch(error => {
      // Autoplay can be blocked by the browser, handle this gracefully.
      console.error("Error playing sound:", {
        message: error.message,
        name: error.name,
        code: (error as any).code,
        error,
      });
    });
  }, []);
  const playMove = useCallback(() => playSound(sounds.move), [playSound, sounds.move]);
  const playCapture = useCallback(() => playSound(sounds.capture), [playSound, sounds.capture]);
  const playGameEnd = useCallback(() => playSound(sounds.gameEnd), [playSound, sounds.gameEnd]);
  const playCheck = useCallback(() => playSound(sounds.check), [playSound, sounds.check]);
  return { playMove, playCapture, playGameEnd, playCheck };
}