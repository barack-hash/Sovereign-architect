import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress ResizeObserver loop limit exceeded error
const resizeObserverError = 'ResizeObserver loop completed with undelivered notifications.';
const resizeObserverLimitError = 'ResizeObserver loop limit exceeded';
const isResizeObserverLoopLimitMessage = (value: unknown) =>
  typeof value === 'string' &&
  (value.includes(resizeObserverError) || value.includes(resizeObserverLimitError));

const originalError = console.error;
console.error = (...args) => {
  if (isResizeObserverLoopLimitMessage(args[0])) {
    return;
  }
  originalError.apply(console, args);
};

window.addEventListener('error', (e) => {
  if (isResizeObserverLoopLimitMessage(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (isResizeObserverLoopLimitMessage(e.reason?.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
