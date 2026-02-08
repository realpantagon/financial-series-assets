import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AddTransaction from './pages/AddTransaction';
import AccountDetails from './pages/AccountDetails';
import Transactions from './pages/Transactions';
import './App.css';

function NavItem({ to, label, icon }: { to: string, label: string, icon: string }) {
    const location = useLocation();
    const isActive = location.pathname === to;

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
        <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom pointer-events-none">
            <div className="relative w-full max-w-lg mx-auto pointer-events-auto">
                {/* SVG Background with Notch */}
                <div className="absolute inset-x-0 bottom-0 h-[80px] drop-shadow-[0_-4px_6px_rgba(0,0,0,0.05)] text-white">
                    <svg
                        viewBox="0 0 375 80"
                        className="w-full h-full"
                        preserveAspectRatio="none"
                        fill="currentColor"
                    >
                        <path d="M0,20 L145,20 Q187.5,75 230,20 L375,20 L375,80 L0,80 Z" />
                    </svg>
                </div>

                <div className="flex justify-around items-end h-[80px] relative px-2">
                    <NavItem to="/" label="Dashboard" icon="pi pi-home" />

                    {/* Floating Action Button for Add */}
                    <div className="relative mb-6 mx-2">
                        <Link to="/add" className="bg-[#001f3f] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl hover:bg-[#003366] transition-transform active:scale-95 border-[3px] border-white">
                            <i className="pi pi-plus text-xl font-bold"></i>
                        </Link>
                    </div>

                    <NavItem to="/transactions" label="Transactions" icon="pi pi-list" />
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
                        <Route path="/account/:accountName" element={<AccountDetails />} />
                    </Routes>
                </div>
                <BottomNav />
            </div>
        </BrowserRouter>
    );
}

export default App;
