import React from 'react'

export interface BadgeIconProps {
  badgeType: string
  className?: string
  size?: number
}

const badgeIcons: Record<string, React.ReactNode> = {
  'trophy': (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L13.09 8.26L20 9L14 14.74L15.18 22L12 19.5L8.82 22L10 14.74L4 9L10.91 8.26L12 2Z"/>
    </svg>
  ),
  'medal': (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7.5C10.07 7.5 8.5 9.07 8.5 11S10.07 14.5 12 14.5 15.5 12.93 15.5 11 13.93 7.5 12 7.5M12 6C14.76 6 17 8.24 17 11S14.76 16 12 16 7 13.76 7 11 9.24 6 12 6M5 17L6.67 15L8 16L6 19V22H8V20H10V22H18V20H20V22H22V19L20 16L21.33 15L23 17V11L15.25 4H8.75L1 11V17H5Z"/>
    </svg>
  ),
  'crown': (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 16L3 5L6 7L9 4L12 7L15 4L18 7L21 5L19 16H5M5 18H19V20H5V18Z"/>
    </svg>
  ),
  'star': (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L15.09 8.26L23 9L17 14.74L18.18 23L12 19.5L5.82 23L7 14.74L1 9L8.91 8.26L12 1Z"/>
    </svg>
  ),
  'diamond': (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L9 9H15L12 2M6.5 9L4 2L2 9H6.5M17.5 9H22L20 2L17.5 9M2 9L12 22L22 9H2Z"/>
    </svg>
  ),
  'fire': (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 23C7.58 23 4 19.42 4 15C4 12.89 4.86 10.97 6.32 9.59C6.11 9.04 6 8.43 6 7.77C6 4.37 8.5 1.87 11.9 1.87C13.66 1.87 15.26 2.59 16.39 3.79C17.53 4.98 18.1 6.61 18.1 8.27C18.1 8.93 18 9.54 17.79 10.09C19.25 11.47 20.1 13.39 20.1 15.5C20.1 19.92 16.52 23.5 12.1 23.5L12 23Z"/>
    </svg>
  ),
  'lightning': (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 21H8L18 3H21L16 12H19L9 21V18H11V21Z"/>
    </svg>
  ),
  'rocket': (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.13 22.19L11.5 18.36C13.07 17.78 14.54 17 15.9 16.09L13.13 22.19M5.64 12.5L1.81 10.87L7.91 8.1C7 9.46 6.22 10.93 5.64 12.5M21.61 2.39C21.61 2.39 16.66 .269 11 5.93C8.81 8.12 7.5 10.53 6.65 12.64C6.37 13.39 6.56 14.21 7.11 14.77L9.24 16.89C9.79 17.45 10.61 17.63 11.36 17.35C13.5 16.53 15.88 15.19 18.07 13C23.73 7.34 21.61 2.39 21.61 2.39M14.54 9.46C13.76 8.68 13.76 7.41 14.54 6.63S16.59 5.85 17.37 6.63C18.14 7.41 18.15 8.68 17.37 9.46C16.59 10.24 15.32 10.24 14.54 9.46M8.88 16.53L7.47 15.12L8.88 16.53M2.39 21.61C2.39 21.61 4.33 20.61 6.35 18.59S8.14 14.95 8.14 14.95L9.85 16.66S9.49 18.45 7.47 20.47C5.45 22.5 2.39 21.61 2.39 21.61Z"/>
    </svg>
  )
}

export function BadgeIcon({ badgeType, className = "", size = 24 }: BadgeIconProps) {
  const icon = badgeIcons[badgeType] || badgeIcons['star']
  
  return (
    <div 
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {React.cloneElement(icon as React.ReactElement, {
        width: size,
        height: size
      })}
    </div>
  )
}

export function getAvailableBadges(): string[] {
  return Object.keys(badgeIcons)
}

export function BadgePreview({ badgeType, size = 32 }: { badgeType: string, size?: number }) {
  return (
    <div className="flex items-center space-x-2">
      <BadgeIcon badgeType={badgeType} size={size} className="text-yellow-500 dark:text-yellow-400" />
      <span className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">{badgeType}</span>
    </div>
  )
}
