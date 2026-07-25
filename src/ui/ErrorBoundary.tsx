/**
 * Last line of defence.
 *
 * Without this, any render-time throw unmounts the tree and leaves a blank white
 * page with the cause only visible in devtools. Since the whole plan lives in
 * local storage, the recovery that matters most is "let me export my data before
 * anything else" — so that button is offered first.
 */

import React from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[sovereign] Render failed.', error, info.componentStack);
  }

  private exportRawPlan = () => {
    try {
      const raw = window.localStorage.getItem('sovereign.plan.v2');
      if (!raw) {
        window.alert('No saved plan was found in this browser.');
        return;
      }
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sovereign-plan-recovered.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Your plan could not be read from storage.');
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="h-[100dvh] w-full bg-neutral-950 flex items-center justify-center p-4 md:p-6 overflow-auto">
        <div className="max-w-2xl w-full space-y-6">
          <div>
            <h1 className="text-secondary font-headline font-bold text-lg tracking-[0.2em] uppercase">
              Something broke
            </h1>
            <p className="text-on-surface-variant font-mono text-[11px] mt-2 leading-relaxed">
              The interface failed to render. Your saved plan is untouched — export it before
              anything else, then reload.
            </p>
          </div>

          <pre className="bg-neutral-900 border border-secondary/30 p-4 text-[10px] font-mono text-secondary overflow-auto max-h-64 whitespace-pre-wrap">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={this.exportRawPlan}
              className="px-4 py-2 bg-primary text-on-primary text-[10px] font-headline font-bold uppercase tracking-[0.15em] hover:brightness-110"
            >
              Export my plan
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-outline-variant/40 text-on-surface-variant text-[10px] font-headline font-bold uppercase tracking-[0.15em] hover:text-on-surface"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
