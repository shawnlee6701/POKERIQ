import React from 'react';
import { Calculator, Target, Trophy, User } from 'lucide-react';
import { Screen } from '../types';
import { motion } from 'motion/react';

interface TopNavProps {
  activeScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export const TopNav: React.FC<TopNavProps> = ({ activeScreen, onScreenChange }) => {
  const navItems = [
    { id: 'calculator', label: '计算器', icon: Calculator },
    { id: 'training',   label: '强化',   icon: Target },
    { id: 'challenge',  label: '挑战',   icon: Trophy },
    { id: 'profile',    label: '我的',   icon: User },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-[9999] bg-[#0a0f12]/85 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <div className="max-w-md mx-auto w-full flex items-center justify-between px-5 pt-[env(safe-area-inset-top)] h-[calc(3.5rem+env(safe-area-inset-top))]">

        {/* Logo */}
        <h1 className="text-[1.1rem] font-headline font-black uppercase tracking-widest text-white/90 select-none">
          Poker<span className="text-primary">IQ</span>
        </h1>

        {/* Nav Icons */}
        <div className="flex items-center gap-0.5">
          {navItems.map((item) => {
            const isActive = activeScreen === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onScreenChange(item.id as Screen)}
                className={`relative flex flex-col items-center justify-center w-12 h-11 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-primary' : 'text-white/35 hover:text-white/70'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="topnav-active"
                    className="absolute inset-0 bg-primary/10 rounded-xl -z-10"
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                  />
                )}
                <div className="relative">
                  <Icon className={`w-[1.1rem] h-[1.1rem] transition-transform ${isActive ? 'scale-110' : ''}`} />
                </div>
                <span className={`text-[8px] font-black tracking-widest uppercase font-headline mt-0.5 ${isActive ? 'text-primary' : 'text-white/25'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
