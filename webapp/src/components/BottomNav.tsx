import React from 'react';
import { Calculator, Target, Trophy, User } from 'lucide-react';
import { Screen } from '../types';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeScreen, onScreenChange }) => {
  const navItems = [
    { id: 'calculator', label: '计算器', icon: Calculator },
    { id: 'training', label: '强化', icon: Target },
    { id: 'challenge', label: '挑战', icon: Trophy },
    { id: 'profile', label: '我的', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-[9999] bg-surface-dim/80 backdrop-blur-xl rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
      <div className="max-w-md mx-auto w-full flex justify-around items-center px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const isActive = activeScreen === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onScreenChange(item.id as Screen)}
              className={`flex flex-col items-center justify-center px-4 py-1 transition-all relative ${
                isActive ? 'text-primary' : 'text-on-surface-variant/50 hover:text-primary'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-primary/10 rounded-xl -z-10"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon className={`w-6 h-6 mb-1 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] font-bold tracking-widest uppercase font-headline">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
