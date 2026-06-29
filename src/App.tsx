import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { LayoutDashboard, History, ArrowLeftRight, TrendingUp, Landmark, Sun, Moon } from 'lucide-react';

// Lazy-load all routes — keeps initial bundle small (especially the FCD page
// which pulls in tesseract.js + recharts).
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const AddTransaction = lazy(() => import('@/pages/AddTransaction'));
const AccountDetails = lazy(() => import('@/pages/AccountDetails'));
const Transactions = lazy(() => import('@/pages/Transactions'));
const FXPage = lazy(() => import('@/pages/FXPage'));
const FXAnalytics = lazy(() => import('@/pages/FXAnalytics'));
const DimeStock = lazy(() => import('@/pages/DimeStock'));
const SymbolDetailPage = lazy(() => import('@/pages/SymbolDetailPage'));
const AddTradePage = lazy(() => import('@/pages/AddTradePage'));
const FCDDashboard = lazy(() => import('@/pages/FCDDashboard'));
const SalaryAllocation = lazy(() => import('@/pages/SalaryAllocation'));
const DimeStockYearly = lazy(() => import('@/pages/DimeStockYearly'));

function RouteFallback() {
    return (
        <div className="flex flex-col gap-3 pt-4 pb-20">
            <Skeleton className="h-28 w-full rounded-xl" />
            <div className="flex flex-col gap-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
        </div>
    );
}

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
            <div className="mx-auto max-w-lg border-t border-border/30 bg-card/95 dark:bg-[oklch(0.09_0.012_255/0.95)] backdrop-blur-md">
                <div className="grid grid-cols-5 h-[72px] items-center pb-8">
                    <NavItem to="/" label="Home" icon={LayoutDashboard} />
                    <NavItem to="/transactions" label="History" icon={History} />
                    <NavItem to="/fx" label="FX" icon={ArrowLeftRight} />
                    <NavItem to="/dime-stock" label="Stocks" icon={TrendingUp} />
                    <NavItem to="/fcd" label="FCD" icon={Landmark} />
                </div>
            </div>
        </div>
    );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
    const [isDark, setIsDark] = useState(
        () => document.documentElement.classList.contains('dark')
    );

    function toggleTheme() {
        const next = isDark ? 'light' : 'dark';
        const html = document.documentElement;
        html.classList.remove('dark', 'light');
        html.classList.add(next);
        localStorage.setItem('panassets-theme', next);
        const meta = document.getElementById('theme-color-meta') as HTMLMetaElement | null;
        if (meta) meta.content = next === 'dark' ? '#0a0a0f' : '#f6f7fb';
        setIsDark(!isDark);
    }

    return (
        <div className="sticky top-0 z-40 border-b border-border/25 bg-card/90 dark:bg-[oklch(0.09_0.012_255/0.92)] backdrop-blur-md">
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
                {/* Right side */}
                <div className="flex items-center gap-3">
                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        className="flex items-center justify-center size-7 rounded-md border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors"
                        aria-label="Toggle theme"
                    >
                        {isDark
                            ? <Sun className="size-3.5" strokeWidth={2} />
                            : <Moon className="size-3.5" strokeWidth={2} />
                        }
                    </button>
                    {/* Status */}
                    <div className="flex items-center gap-1.5">
                        <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] font-mono text-muted-foreground/50 tracking-wider">LIVE</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
    return (
        <ErrorBoundary>
            <BrowserRouter>
                <div className="min-h-screen flex flex-col bg-background">
                    <Header />
                    <div className="flex-1 w-full max-w-lg mx-auto px-3 pb-28">
                        <Suspense fallback={<RouteFallback />}>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/add" element={<AddTransaction />} />
                                <Route path="/transactions" element={<Transactions />} />
                                <Route path="/fx" element={<FXPage />} />
                                <Route path="/fx/analytics" element={<FXAnalytics />} />
                                <Route path="/dime-stock" element={<DimeStock />} />
                                <Route path="/dime-stock-add" element={<AddTradePage />} />
                                <Route path="/dime-stock/yearly" element={<DimeStockYearly />} />
                                <Route path="/dime-stock/:symbol" element={<SymbolDetailPage />} />
                                <Route path="/account/:accountName" element={<AccountDetails />} />
                                <Route path="/fcd" element={<FCDDashboard />} />
                                <Route path="/salary" element={<SalaryAllocation />} />
                            </Routes>
                        </Suspense>
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
        </ErrorBoundary>
    );
}

export default App;
