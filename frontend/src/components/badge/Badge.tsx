"use client"

import * as React from 'react';
import { UserBadge } from '@/models/Badge';

interface BadgeComponentProps {
  userBadge: UserBadge;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export const BadgeComponent: React.FC<BadgeComponentProps> = ({
  userBadge,
  size = 'md',
  showTooltip = true
}) => {
  const { badge, challenge, awardedAt } = userBadge;
  
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-1';
      case 'lg':
        return 'text-base px-4 py-2';
      default:
        return 'text-sm px-3 py-1.5';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getBadgeTitle = () => {
    let title = `${badge.name}: ${badge.description}`;
    if (challenge) {
      title += ` (${challenge.name})`;
    }
    title += ` - Awarded on ${formatDate(awardedAt)}`;
    return title;
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${getSizeClasses()}`}
      style={{ backgroundColor: badge.color + '20', color: badge.color }}
      title={showTooltip ? getBadgeTitle() : undefined}
    >
      <span className="mr-1">{badge.icon}</span>
      {badge.name}
      {challenge && size !== 'sm' && (
        <span className="ml-1 opacity-75">({challenge.name})</span>
      )}
    </span>
  );
};

interface BadgeListProps {
  userBadges: UserBadge[];
  size?: 'sm' | 'md' | 'lg';
  maxDisplay?: number;
}

export const BadgeList: React.FC<BadgeListProps> = ({
  userBadges,
  size = 'md',
  maxDisplay = 10
}) => {
  const displayBadges = maxDisplay ? userBadges.slice(0, maxDisplay) : userBadges;
  const remainingCount = userBadges.length - displayBadges.length;

  return (
    <div className="flex flex-wrap gap-2">
      {displayBadges.map((userBadge) => (
        <BadgeComponent key={userBadge.id} userBadge={userBadge} size={size} />
      ))}
      {remainingCount > 0 && (
        <span
          className={`inline-flex items-center rounded-full bg-gray-100 text-gray-700 font-medium ${size === 'sm' ? 'text-xs px-2 py-1' : size === 'lg' ? 'text-base px-4 py-2' : 'text-sm px-3 py-1.5'}`}
        >
          +{remainingCount} more
        </span>
      )}
    </div>
  );
};
