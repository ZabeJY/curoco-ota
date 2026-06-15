/**
 * Curoco — Global Sound Manager
 * Ensures only one audio plays at a time
 */

import { Audio } from 'expo-av';

let currentSound: Audio.Sound | null = null;
let currentStopCallback: (() => void) | null = null;

export const SoundManager = {
  /**
   * Play audio, stopping any currently playing audio first
   * @returns A stop function
   */
  async play(uri: string, onFinished?: () => void): Promise<() => void> {
    // Stop any currently playing audio
    await this.stop();

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync({ uri });
    currentSound = sound;

    const cleanup = () => {
      currentSound = null;
      currentStopCallback = null;
      onFinished?.();
    };

    currentStopCallback = cleanup;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        currentSound = null;
        currentStopCallback = null;
        sound.unloadAsync().catch(() => {});
        onFinished?.();
      }
    });

    await sound.playAsync();

    // Return a stop function for this specific sound
    return () => this.stop();
  },

  /**
   * Stop currently playing audio
   */
  async stop(): Promise<void> {
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch {}
      currentSound = null;
    }
    if (currentStopCallback) {
      currentStopCallback();
      currentStopCallback = null;
    }
  },

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return currentSound !== null;
  },
};
