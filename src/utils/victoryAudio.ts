// Audio disabled per user requirement - completely silent victory mode
export function isAudioMuted(): boolean {
  return true;
}

export function toggleAudioMute(): boolean {
  return true;
}

export function stopVictoryMusic() {
  // no-op
}

export function playVictoryFanfare(durationSecs = 60) {
  // Completely silent - no audio output
  return () => {};
}
