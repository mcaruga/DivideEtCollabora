import React from 'react';
import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PremiumBadgeProps {
  small?: boolean;
}

export default function PremiumBadge({ small = false }: PremiumBadgeProps) {
  return (
    <Link to="/premium">
      <span
        className={`inline-flex items-center gap-1 bg-amber-100 text-amber-700 rounded font-medium cursor-pointer hover:bg-amber-200 transition-colors ${
          small ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'
        }`}
      >
        <Star className={small ? 'w-3 h-3' : 'w-4 h-4'} />
        Premium
      </span>
    </Link>
  );
}
