import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import Dashboard from '@/pages/Dashboard';
import AddTransaction from '@/pages/AddTransaction';
import AccountDetails from '@/pages/AccountDetails';
import Transactions from '@/pages/Transactions';
import FXPage from '@/pages/FXPage';
import FXAnalytics from '@/pages/FXAnalytics';
import DimeStock from '@/pages/DimeStock';
import { cn } from '@/lib/utils';
import { Home, List, DollarSign, TrendingUp } from 'lucide-react';

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
    const location = useLocation();
    const isActive = to === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(to);

    return (
        <Link
            to={to}
            className={cn(
                'flex flex-col items-center justify-center gap-1 w-full py-3 pb-2 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
        >
            <Icon
                className={cn('size-5', isActive && 'stroke-[2.5]')}
                strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span className={cn(
                'text-[10px] font-medium',
                isActive ? 'font-semibold' : 'font-normal'
            )}>
                {label}
            </span>
            {isActive && (
                <span className="absolute bottom-0 block h-0.5 w-8 rounded-full bg-primary" />
            )}
        </Link>
    );
}

function BottomNav() {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
            <div className="mx-auto max-w-lg bg-card border-t border-border shadow-lg">
                <div className="grid grid-cols-4 h-[68px] items-center relative">
                    <NavItem to="/" label="Dashboard" icon={Home} />
                    <NavItem to="/transactions" label="History" icon={List} />
                    <NavItem to="/fx" label="FX" icon={DollarSign} />
                    <NavItem to="/dime-stock" label="Stocks" icon={TrendingUp} />
                </div>
            </div>
        </div>
    );
}

function Header() {
    return (
        <div className="bg-card border-b border-border sticky top-0 z-40">
            <div className="max-w-lg mx-auto px-5 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-md bg-primary flex items-center justify-center">
                        <TrendingUp className="size-4 text-primary-foreground" strokeWidth={2.5} />
                    </div>
                    <span className="text-lg font-bold text-foreground tracking-tight">PanAssets</span>
                </div>
                <Link
                    to="/add"
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                    + Add
                </Link>
            </div>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-background">
                <Header />
                <div className="flex-1 w-full max-w-lg mx-auto p-3 pb-28">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/add" element={<AddTransaction />} />
                        <Route path="/transactions" element={<Transactions />} />
                        <Route path="/fx" element={<FXPage />} />
                        <Route path="/fx/analytics" element={<FXAnalytics />} />
                        <Route path="/dime-stock" element={<DimeStock />} />
                        <Route path="/account/:accountName" element={<AccountDetails />} />
                    </Routes>
                </div>
                <BottomNav />
                <Toaster position="top-center" richColors />
            </div>
        </BrowserRouter>
    );
}

export default App;
