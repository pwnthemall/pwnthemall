import { useEffect, useState } from 'react'
import Image from 'next/image';
import AnimatedText from '@/components/common/AnimatedText';


export default function MobileBlocked() {
  const [userAgent, setUserAgent] = useState('')
  useEffect(() => {
    setUserAgent(navigator.userAgent)
  }, [])


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-8 text-center">
            <Image
              src="/logo-v2-no-text.png"
              alt="CTF logo"
              className="opacity-100 mx-auto mb-6"
              width={180}
              height={180}
              priority
            />
            <p className="text-xl md:text-2xl font-medium mb-8 text-cyan-600 dark:text-cyan-400">
              <AnimatedText text="Desktop only" delay={150} />
            </p>
        
        <div className="space-y-4 text-slate-600 dark:text-slate-300">
          <p className="text-lg font-medium">
            This platform is made for computers only.
          </p>
          <p>
            Please visit this site on your laptop or desktop computer.
          </p>
        </div>
      </div>
    </div>
  )
}
