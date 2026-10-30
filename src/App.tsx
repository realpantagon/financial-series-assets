import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { Wallet, History, ArrowLeftRight, CandlestickChart, Landmark, Sun, Moon, ChevronLeft } from 'lucide-react';

// Lazy-load all routes — keeps initial bundle small (the FCD page pulls in tesseract.js + recharts).
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
const AddTransfer = lazy(() => import('@/pages/AddTransfer'));
const DimeStockYearly = lazy(() => import('@/pages/DimeStockYearly'));

function RouteFallback() {
    return (
        <div className="flex flex-col gap-3 pt-2">
            <Skeleton className="h-32 w-full rounded-3xl" />
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
        </div>
    );
}

// ─── Route metadata ───────────────────────────────────────────────────────────
// Top-level routes are the five tabs; everything else is a drill-down with a Back chevron.

const TABS = [
    { to: '/', label: 'Home', icon: Wallet },
    { to: '/transactions', label: 'History', icon: History },
    { to: '/fx', label: 'FX', icon: ArrowLeftRight },
    { to: '/dime-stock', label: 'Stocks', icon: CandlestickChart },
    { to: '/fcd', label: 'FCD', icon: Landmark },
] as const;

const TITLES: Record<string, string> = {
    '/': 'Pan Assets',
    '/transactions': 'History',
    '/fx': 'FX Exchange',
    '/fx/analytics': 'FX Analytics',
    '/dime-stock': 'Stocks',
    '/dime-stock-add': 'Add Trade',
    '/dime-stock/yearly': 'Yearly Summary',
    '/fcd': 'FCD',
    '/salary': 'Salary Allocation',
    '/transfer': 'Transfer',
    '/add': 'New Transaction',
};

function useRouteMeta() {
    const { pathname } = useLocation();
    const isTab = TABS.some(t => t.to === pathname);
    let title = TITLES[pathname];
    if (!title) {
        const seg = decodeURIComponent(pathname.split('/').pop() ?? '');
        title = seg || 'Pan Assets';
    }
    return { pathname, title, isTab };
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function useTheme() {
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
    const toggle = () => {
        const next = isDark ? 'light' : 'dark';
        const html = document.documentElement;
        html.classList.remove('dark', 'light');
        html.classList.add(next);
        try { localStorage.setItem('panassets-theme', next); } catch { /* private mode */ }
        const meta = document.getElementById('theme-color-meta') as HTMLMetaElement | null;
        if (meta) meta.content = next === 'dark' ? '#121316' : '#f2f3f6';
        setIsDark(!isDark);
    };
    return { isDark, toggle };
}

function TopBar() {
    const navigate = useNavigate();
    const { title, isTab, pathname } = useRouteMeta();
    const { isDark, toggle } = useTheme();
    const isHome = pathname === '/';

    return (
        <header className="shrink-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl safe-top">
            <div className="h-12 px-2 flex items-center">
                <div className="w-20 flex items-center">
                    {!isTab && (
                        <button
                            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                            className="press flex items-center -ml-0.5 pr-3 h-11 text-primary text-[17px]"
                            aria-label="Back"
                        >
                            <ChevronLeft className="size-7" strokeWidth={2.25} />
                            <span className="-ml-1">Back</span>
                        </button>
                    )}
                </div>
                <h1 className={cn(
                    'flex-1 text-center truncate text-[17px] font-semibold tracking-tight',
                    isHome && 'text-primary'
                )}>
                    {title}
                </h1>
                <div className="w-20 flex justify-end">
                    {isTab && (
                        <button
                            onClick={toggle}
                            className="press size-11 flex items-center justify-center rounded-full text-muted-foreground"
                            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                        >
                            {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar() {
    const { pathname } = useLocation();
    return (
        <nav className="shrink-0 z-50 border-t border-border/60 bg-card/85 backdrop-blur-xl safe-bottom" aria-label="Main">
            <div className="grid grid-cols-5 h-[52px]">
                {TABS.map(({ to, label, icon: Icon }) => {
                    // Drill-down pages keep their parent tab lit.
                    const active = to === '/'
                        ? pathname === '/' || pathname.startsWith('/account') || pathname === '/salary' || pathname === '/transfer' || pathname === '/add'
                        : pathname === to || pathname.startsWith(to + '/') || (to === '/dime-stock' && pathname.startsWith('/dime-stock'));
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            className={cn(
                                'press flex flex-col items-center justify-center gap-0.5',
                                active ? 'text-primary' : 'text-muted-foreground'
                            )}
                            aria-current={active ? 'page' : undefined}
                        >
                            <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} />
                            <span className={cn('text-[11px] leading-none', active ? 'font-semibold' : 'font-medium')}>{label}</span>
                        </NavLink>
                    );
                })}
            </div>
        </nav>
    );
}

// ─── Scroll container: resets to top on navigation ────────────────────────────

function Content({ children }: { children: React.ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const { pathname } = useLocation();
    useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [pathname]);
    return (
        <main ref={ref} className="flex-1 min-h-0 scroll-y">
            <div className="mx-auto w-full max-w-[430px] px-4 pt-4 pb-10">{children}</div>
        </main>
    );
}

function AccountRoute() {
    const { accountName } = useParams();
    return <AccountDetails key={accountName} />;
}

function App() {
    return (
        <ErrorBoundary>
            <BrowserRouter>
                <div className="h-dvh flex flex-col bg-background">
                    <TopBar />
                    <Content>
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
                                <Route path="/account/:accountName" element={<AccountRoute />} />
                                <Route path="/fcd" element={<FCDDashboard />} />
                                <Route path="/salary" element={<SalaryAllocation />} />
                                <Route path="/transfer" element={<AddTransfer />} />
                            </Routes>
                        </Suspense>
                    </Content>
                    <TabBar />
                    <Toaster
                        position="top-center"
                        richColors
                        offset={`calc(env(safe-area-inset-top, 0px) + 8px)`}
                        toastOptions={{ style: { fontSize: '14px' } }}
                    />
                </div>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default App;
