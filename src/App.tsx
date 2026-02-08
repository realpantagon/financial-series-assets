import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AddTransaction from './pages/AddTransaction';
import AccountDetails from './pages/AccountDetails';
import Transactions from './pages/Transactions';
import FXPage from './pages/FXPage';
import FXAnalytics from './pages/FXAnalytics';
import './App.css';

function NavItem({ to, label, icon }: { to: string, label: string, icon: string }) {
    const location = useLocation();

    // Check if active: exact match for home, startsWith for others to catch sub-routes
    const isActive = to === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(to);

    return (
        <Link
            to={to}
            className={`flex flex-col items-center justify-center gap-1 w-full py-3 pb-2 transition-colors z-10 ${isActive ? 'text-[#001f3f]' : 'text-gray-400 hover:text-gray-600'}`}
        >
            <i className={`${icon} text-xl ${isActive ? 'font-bold' : ''}`}></i>
            <span className="text-[10px] font-medium">{label}</span>
        </Link>
    );
}

function BottomNav() {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
            <div className="mx-auto max-w-lg bg-white shadow-[0_-4px_6px_rgba(0,0,0,0.05)]">
                <div className="grid grid-cols-4 h-[64px] items-center">
                    <NavItem
                        to="/"
                        label="Dashboard"
                        icon="pi pi-home"
                    />

                    <NavItem
                        to="/transactions"
                        label="Transactions"
                        icon="pi pi-list"
                    />

                    <NavItem
                        to="/fx"
                        label="FX"
                        icon="pi pi-dollar"
                    />

                    <NavItem
                        to="/settings"
                        label="Settings"
                        icon="pi pi-cog"
                    />
                </div>
            </div>
        </div>
    );
}



function Header() {
    return (
        <div className="bg-surface-ground sticky top-0 z-40">
            <div className="max-w-lg mx-auto px-6 py-2 flex justify-between items-center">
                <span className="text-2xl font-bold text-[#001f3f]">Pantagon Assets</span>
            </div>
        </div>
    )
}

function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-surface-ground">
                <Header />
                <div className="flex-1 w-full max-w-lg mx-auto p-2 pb-28">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/add" element={<AddTransaction />} />
                        <Route path="/transactions" element={<Transactions />} />
                        <Route path="/fx" element={<FXPage />} />
                        <Route path="/fx/analytics" element={<FXAnalytics />} />
                        <Route path="/account/:accountName" element={<AccountDetails />} />
                    </Routes>
                </div>
                <BottomNav />
            </div>
        </BrowserRouter>
    );
}

export default App;
