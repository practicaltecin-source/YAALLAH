import confetti from 'canvas-confetti';

export function fireCelebrationConfetti(options?: {
  colors?: string[];
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
}) {
  const defaultColors = ['#ffd700', '#f59e0b', '#10b981', '#059669', '#3b82f6', '#ec4899', '#ffffff'];
  const count = options?.particleCount || 180;

  // Left cannon
  confetti({
    particleCount: Math.floor(count / 2),
    angle: 60,
    spread: options?.spread || 70,
    origin: { x: 0, y: 0.7 },
    colors: options?.colors || defaultColors,
    startVelocity: options?.startVelocity || 55,
  });

  // Right cannon
  confetti({
    particleCount: Math.floor(count / 2),
    angle: 120,
    spread: options?.spread || 70,
    origin: { x: 1, y: 0.7 },
    colors: options?.colors || defaultColors,
    startVelocity: options?.startVelocity || 55,
  });
}

export function fireGoldWinnerBurst() {
  const goldColors = ['#ffd700', '#f59e0b', '#b45309', '#fef08a', '#ffffff'];
  
  // Center starburst
  confetti({
    particleCount: 100,
    spread: 100,
    origin: { y: 0.6 },
    colors: goldColors,
    scalar: 1.2,
    shapes: ['star', 'circle'],
  });

  // Delayed side pops
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 55,
      spread: 60,
      origin: { x: 0.1, y: 0.6 },
      colors: goldColors,
    });
    confetti({
      particleCount: 50,
      angle: 125,
      spread: 60,
      origin: { x: 0.9, y: 0.6 },
      colors: goldColors,
    });
  }, 250);
}

export function fireContinuousVictoryConfetti(durationMs = 60000) {
  const animationEnd = Date.now() + durationMs;
  const defaults = { startVelocity: 45, spread: 360, ticks: 100, zIndex: 9999 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  // Initial grand burst
  fireGoldWinnerBurst();
  setTimeout(() => fireCelebrationConfetti(), 350);

  const interval: any = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = Math.max(15, Math.floor(40 * (timeLeft / durationMs)));

    // Continuous cannons from left and right
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.05, 0.35), y: Math.random() * 0.4 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.65, 0.95), y: Math.random() * 0.4 } });
  }, 700);

  return () => clearInterval(interval);
}

