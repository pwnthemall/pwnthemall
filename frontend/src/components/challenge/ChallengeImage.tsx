import { useState } from 'react'
import Image from 'next/image'

interface ChallengeImageProps {
  readonly challengeId: number
  readonly alt: string
  readonly className?: string
  readonly priority?: boolean
  readonly positionX?: number  // 0-100, default 50 (center)
  readonly positionY?: number  // 0-100, default 50 (center)
  readonly zoom?: number       // 100-200, default 100 (no zoom)
}

/**
 * ChallengeImage - Displays a challenge cover image with error handling
 * 
 * Features:
 * - Loads image from backend API endpoint
 * - Graceful degradation if image fails to load
 * - Responsive with aspect-video ratio
 * - Loading skeleton during fetch
 * - Configurable focal point via positionX/positionY
 */
export default function ChallengeImage({ 
  challengeId, 
  alt, 
  className = '', 
  priority = false,
  positionX = 50,
  positionY = 50,
  zoom = 100
}: ChallengeImageProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  // If image failed to load, show empty placeholder to maintain layout
  if (imageError) {
    return (
      <div className={`relative w-full h-full overflow-hidden bg-muted ${className}`} />
    )
  }

  const imageUrl = `/api/challenges/${challengeId}/cover`
  
  // Compute object-position from x/y percentages
  const objectPosition = `${positionX}% ${positionY}%`
  // Scale factor for zoom (100 = 100% = no zoom, 150 = 150% scale)
  const scale = zoom / 100
  // Transform origin to make scale expand from focal point
  const transformOrigin = `${positionX}% ${positionY}%`

  return (
    <div className={`relative w-full h-full overflow-hidden bg-muted ${className}`}>
      {imageLoading && (
        <div className="absolute inset-0 animate-pulse bg-muted/50" />
      )}
      <Image
        src={imageUrl}
        alt={alt}
        fill
        unoptimized
        className="object-cover"
        style={{ 
          objectPosition, 
          transform: `scale(${scale})`,
          transformOrigin
        }}
        onLoad={() => setImageLoading(false)}
        onError={() => {
          setImageError(true)
          setImageLoading(false)
        }}
        loading={priority ? 'eager' : 'lazy'}
      />
    </div>
  )
}
