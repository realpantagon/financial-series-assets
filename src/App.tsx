import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import Dashboard from '@/pages/Dashboard';
import AddTransaction from '@/pages/AddTransaction';
import AccountDetails from '@/pages/AccountDetails';
import Transactions from '@/pages/Transactions';
import FXPage from '@/pages/FXPage';
import FXAnalytics from '@/pages/FXAnalytics';
import DimeStock from '@/pages/DimeStock';
import SymbolDetailPage from '@/pages/SymbolDetailPage';
import AddTradePage from '@/pages/AddTradePage';
import FCDDashboard from '@/pages/FCDDashboard';
import { cn } from '@/lib/utils';
import { LayoutDashboard, History, ArrowLeftRight, TrendingUp, Landmark } from 'lucide-react';

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
    const location = useLocation();
    // Stocks sub-pages should keep Stocks tab active
    const isActive = to === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(to);

    return (
        <Link
            to={to}
            className={cn(
                'relative flex flex-col items-center justify-center gap-1 w-full py-2 transition-all duration-150',
                isActive ? 'text-cyan-400' : 'text-muted-foreground/50 hover:text-muted-foreground'
            )}
        >
            {/* Active glow dot */}
            {isActive && (
                <span className="absolute top-0 inset-x-0 mx-auto w-8 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />
            )}
            <Icon
                className={cn('size-[18px]', isActive ? 'stroke-[2]' : 'stroke-[1.5]')}
            />
            <span className={cn(
                'text-[8px] uppercase tracking-[0.12em]',
                isActive ? 'font-bold text-cyan-400' : 'font-medium'
            )}>
                {label}
            </span>
        </Link>
    );
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────

function BottomNav() {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
            <div className="mx-auto max-w-lg border-t border-border/30 bg-[oklch(0.09_0.012_255/0.95)] backdrop-blur-md">
                <div className="grid grid-cols-5 h-[54px] items-center">
                    <NavItem to="/"             label="Home"    icon={LayoutDashboard} />
                    <NavItem to="/transactions" label="History" icon={History} />
                    <NavItem to="/fx"           label="FX"      icon={ArrowLeftRight} />
                    <NavItem to="/dime-stock"   label="Stocks"  icon={TrendingUp} />
                    <NavItem to="/fcd"          label="FCD"     icon={Landmark} />
                </div>
            </div>
        </div>
    );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
    return (
        <div className="sticky top-0 z-40 border-b border-border/25 bg-[oklch(0.09_0.012_255/0.92)] backdrop-blur-md">
            <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="size-5 rounded bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                        <TrendingUp className="size-3 text-cyan-400" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-black text-foreground tracking-tight">
                        Pan<span className="text-cyan-400">Assets</span>
                    </span>
                </div>
                {/* Terminal-style status */}
                <div className="flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-mono text-muted-foreground/50 tracking-wider">LIVE</span>
                </div>
            </div>
        </div>
    );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-background">
                <Header />
                <div className="flex-1 w-full max-w-lg mx-auto px-3 pb-28">
                    <Routes>
                        <Route path="/"                     element={<Dashboard />} />
                        <Route path="/add"                  element={<AddTransaction />} />
                        <Route path="/transactions"         element={<Transactions />} />
                        <Route path="/fx"                   element={<FXPage />} />
                        <Route path="/fx/analytics"         element={<FXAnalytics />} />
                        <Route path="/dime-stock"           element={<DimeStock />} />
                        <Route path="/dime-stock-add"       element={<AddTradePage />} />
                        <Route path="/dime-stock/:symbol"   element={<SymbolDetailPage />} />
                        <Route path="/account/:accountName" element={<AccountDetails />} />
                        <Route path="/fcd"                  element={<FCDDashboard />} />
                    </Routes>
                </div>
                <BottomNav />
                <Toaster
                    position="top-center"
                    richColors
                    toastOptions={{
                        style: {
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '12px',
                            letterSpacing: '0.02em',
                        },
                    }}
                />
            </div>
        </BrowserRouter>
    );
}

export default App;
