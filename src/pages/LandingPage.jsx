import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChefHat, 
  ShieldCheck, 
  Users, 
  Truck, 
  UtensilsCrossed, 
  UserCircle, 
  HeartHandshake,
  ArrowRight,
  LayoutDashboard,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { ROLES, ROLE_HOME } from '@/lib/RoleContext';

const RoleCard = ({ role, title, description, icon: Icon, color }) => (
  <div className={`group relative p-6 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl hover:bg-slate-800/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-${color}-500/20`}>
    <div className={`absolute -top-4 -left-4 w-12 h-12 rounded-xl bg-gradient-to-br ${color === 'cyan' ? 'from-cyan-500 to-blue-600' : color === 'purple' ? 'from-purple-500 to-indigo-600' : 'from-emerald-500 to-teal-600'} flex items-center justify-center shadow-lg shadow-${color}-500/40 group-hover:rotate-6 transition-transform`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="mt-4">
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
    <div className="mt-6 flex items-center text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
      <span>Learn more</span>
      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
    </div>
  </div>
);

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, show a different CTA or redirect
  const handleGetStarted = () => {
    if (user) {
      const home = ROLE_HOME[user.role] || '/';
      navigate(home);
    } else {
      navigate('/auth?mode=signup');
    }
  };

  const roles = [
    {
      role: ROLES.OWNER,
      title: 'Restaurant Owner',
      description: 'Full control over your business, branches, and high-level analytics.',
      icon: ShieldCheck,
      color: 'cyan'
    },
    {
      role: ROLES.MANAGER,
      title: 'Branch Manager',
      description: 'Manage daily operations, staff, and inventory for your assigned location.',
      icon: LayoutDashboard,
      color: 'purple'
    },
    {
      role: ROLES.KITCHEN,
      title: 'Kitchen Staff',
      description: 'Streamline order preparation and manage kitchen workflow efficiently.',
      icon: UtensilsCrossed,
      color: 'emerald'
    },
    {
      role: ROLES.EMPLOYEE,
      title: 'Floor Staff',
      description: 'Handle sales, orders, and customer service on the front line.',
      icon: Users,
      color: 'cyan'
    },
    {
      role: ROLES.DRIVER,
      title: 'Delivery Driver',
      description: 'Optimized routes and real-time delivery tracking for faster service.',
      icon: Truck,
      color: 'purple'
    },
    {
      role: ROLES.SPONSOR,
      title: 'Business Sponsor',
      description: 'Monitor investments and access specialized financial reports.',
      icon: HeartHandshake,
      color: 'emerald'
    },
    {
      role: ROLES.CUSTOMER,
      title: 'Valued Customer',
      description: 'Browse menus, place orders, and track your loyalty rewards.',
      icon: UserCircle,
      color: 'cyan'
    }
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-cyan-500/30 overflow-x-hidden">
      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-white uppercase">Resto<span className="text-cyan-400">CTRL</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/auth">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/5">
              Sign In
            </Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 border-none">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32 px-6 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-8 animate-pulse">
          <Zap className="w-3 h-3" />
          <span>Next Generation Management</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight leading-[1.1]">
          Control Your Restaurant <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
            With Precision.
          </span>
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          The all-in-one platform for owners, managers, and staff. Streamline operations, track growth, and deliver excellence.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            onClick={handleGetStarted}
            size="lg" 
            className="w-full sm:w-auto px-10 h-14 text-lg bg-white text-slate-950 hover:bg-slate-200 font-bold rounded-2xl transition-all hover:scale-105"
          >
            {user ? 'Go to Dashboard' : 'Register Now'}
          </Button>
          <Link to="/auth" className="w-full sm:w-auto">
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full sm:w-auto px-10 h-14 text-lg border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
            >
              Member Login
            </Button>
          </Link>
        </div>
      </section>

      {/* Role Selection Grid */}
      <section className="relative z-10 px-6 max-w-7xl mx-auto pb-40">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">Choose Your Path</h2>
          <p className="text-slate-400">Specialized interfaces designed for every role in your restaurant ecosystem.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {roles.map((role) => (
            <div key={role.role} onClick={() => navigate(`/auth?mode=signup&role=${role.role}`)} className="cursor-pointer">
              <RoleCard {...role} />
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-slate-950/50 backdrop-blur-md py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <ChefHat className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-bold tracking-tight text-white uppercase">Resto<span className="text-cyan-400">CTRL</span></span>
          </div>
          <p className="text-slate-500 text-sm">
            © 2026 RestoCTRL Management Systems. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">Terms</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">Privacy</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
