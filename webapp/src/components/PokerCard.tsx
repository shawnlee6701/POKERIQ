import React from 'react';
import { Suit, Rank } from '../types';
import { Heart, Diamond, Club, Spade } from 'lucide-react';

interface PokerCardProps {
  suit?: Suit;
  rank?: Rank;
  size?: 'sm' | 'md' | 'lg';
  isBack?: boolean;
  className?: string;
  onRemove?: () => void;
}

export const PokerCard: React.FC<PokerCardProps> = ({ suit, rank, size = 'md', isBack = false, className = '', onRemove }) => {
  if (isBack) {
    const sizeClasses = {
      sm: 'w-12 h-16 p-1.5',
      md: 'w-[72px] h-[100px] p-2',
      lg: 'w-20 h-28 p-2.5',
    };

    return (
      <div className={`relative bg-surface-container-highest rounded-lg shadow-md flex items-center justify-center poker-card-shadow transition-transform hover:scale-105 border border-white/10 ${sizeClasses[size]} ${className}`}>
        <div className="w-full h-full rounded-md bg-gradient-to-br from-primary/20 via-secondary/20 to-tertiary/20 flex items-center justify-center overflow-hidden relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '8px 8px' }} />
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <div className="w-4 h-4 rounded-full bg-primary/40 shadow-[0_0_10px_rgba(70,241,197,0.4)]" />
          </div>
        </div>
      </div>
    );
  }

  const isRed = suit === 'hearts' || suit === 'diamonds';
  
  const SuitIcon = suit ? {
    hearts: Heart,
    diamonds: Diamond,
    clubs: Club,
    spades: Spade,
  }[suit] : Spade;

  const sizeClasses = {
    sm: 'w-12 h-16 p-1.5',
    md: 'w-[72px] h-[100px] p-2',
    lg: 'w-20 h-28 p-2.5',
  };

  const rankSizeClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`relative bg-white rounded-lg shadow-md flex flex-col items-start justify-start poker-card-shadow transition-transform hover:scale-105 ${sizeClasses[size]} ${className}`}>
      <div className={`font-headline font-bold leading-none ${rankSizeClasses[size]} ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {rank}
      </div>
      <SuitIcon className={`mt-1 fill-current ${iconSizeClasses[size]} ${isRed ? 'text-red-600' : 'text-slate-900'}`} />
      
      <div className="absolute bottom-1 right-1 opacity-10">
        <SuitIcon className={`fill-current ${size === 'lg' ? 'w-12 h-12' : 'w-8 h-8'}`} />
      </div>

      {onRemove && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-2 -right-2 size-6 bg-surface-container-high rounded-full border border-white/10 flex items-center justify-center text-on-surface hover:bg-error hover:text-white transition-colors shadow-sm z-10"
        >
          <span className="text-[16px]">×</span>
        </button>
      )}
    </div>
  );
};
