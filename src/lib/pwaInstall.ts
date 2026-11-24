export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let initialized = false;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    nav.standalone === true
  );
}

export function initPWAInstallListener(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  installed = isRunningStandalone();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export function getPWAInstallState(): {
  canInstall: boolean;
  isInstalled: boolean;
} {
  initPWAInstallListener();
  return {
    canInstall: deferredPrompt !== null,
    isInstalled: installed || isRunningStandalone(),
  };
}

export function subscribePWAInstall(listener: Listener): () => void {
  initPWAInstallListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function triggerPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notify();
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  if (choice.outcome === 'accepted') {
    installed = true;
    notify();
  }
  return choice.outcome;
}
