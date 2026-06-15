/**
 * Curoco — Background Task Manager
 * Simplified version without expo-task-manager/expo-background-fetch
 * Uses AppState listener + local notifications for background messaging
 */

import { AppState, type AppStateStatus } from 'react-native';

let appStateSub: any = null;
let lastBackgroundTime: number | null = null;

/**
 * Register app state listener for background awareness
 */
export function registerBackgroundTask(): void {
  if (appStateSub) return;

  appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'background' || nextState === 'inactive') {
      lastBackgroundTime = Date.now();
    } else if (nextState === 'active' && lastBackgroundTime) {
      // App came back from background
      const elapsed = Date.now() - lastBackgroundTime;
      console.log(`[BackgroundTask] App returned after ${Math.round(elapsed / 1000)}s`);
      lastBackgroundTime = null;
    }
  });

  console.log('[BackgroundTask] AppState listener registered');
}

/**
 * Unregister background task
 */
export function unregisterBackgroundTask(): void {
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}

/**
 * Check if app is in background
 */
export function isAppInBackground(): boolean {
  return AppState.currentState === 'background' || AppState.currentState === 'inactive';
}
