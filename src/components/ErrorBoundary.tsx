import { Component, type ReactNode } from 'react';
import { getErrorMessage } from '@/lib/utils';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: { componentStack?: string | null }) {
        console.error('[ErrorBoundary]', error, info);
    }

    handleReload = () => {
        this.setState({ error: null });
        window.location.reload();
    };

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-background">
                <div className="max-w-md w-full border border-rose-500/30 bg-rose-500/5 p-6 rounded-xl flex flex-col gap-4">
                    <p className="text-[10px] font-bold text-rose-300 uppercase tracking-[0.16em]">Something broke</p>
                    <p className="text-sm text-foreground/80 font-mono break-words">
                        {getErrorMessage(this.state.error)}
                    </p>
                    <button
                        onClick={this.handleReload}
                        className="h-10 text-xs font-bold tracking-[0.14em] border border-cyan-500/35 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 rounded-none"
                    >
                        RELOAD APP
                    </button>
                </div>
            </div>
        );
    }
}
