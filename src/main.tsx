import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './index.css';

/**
 * ResizeObserver fires a benign "loop completed with undelivered notifications"
 * warning when a chart or the graph canvas resizes mid-frame. It is noise, but
 * the suppression is deliberately narrow: v1 dropped *any* console.error whose
 * message merely contained the string "ResizeObserver", which would hide a real
 * failure inside resize-handling code.
 */
const BENIGN_RESIZE_OBSERVER =
  /^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/;

const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && BENIGN_RESIZE_OBSERVER.test(args[0])) return;
  originalError.apply(console, args as []);
};

window.addEventListener('error', (event) => {
  if (BENIGN_RESIZE_OBSERVER.test(event.message)) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
