import { useState, useEffect } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { useAuth } from '@/context/AuthContext'
import { Instance } from '@/models/Instance'
import { Play, Square, Settings } from 'lucide-react'
import axios from '@/lib/axios'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface InstanceStatusProps {
  className?: string
}

const InstanceStatus = ({ className }: InstanceStatusProps) => {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(false)
  const { t } = useLanguage()
  const { loggedIn } = useAuth()

  const fetchInstances = async () => {
    try {
      const response = await axios.get<Instance[]>('/api/instances')
      setInstances(response.data || [])
    } catch (error) {
      console.error('Failed to fetch instances:', error)
    }
  }

  const waitForStop = async (instanceId: number, maxAttempts = 10, interval = 1000) => {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await axios.get<Instance[]>('/api/instances')
      const stillRunning = res.data.some(inst => inst.id === instanceId)
      if (!stillRunning) return true
      await new Promise(r => setTimeout(r, interval))
    }
    return false
  }

  const stopInstance = async (instanceId: number) => {
    setLoading(true)
    try {
      await axios.post(`/api/instances/${instanceId}/stop`)
      await waitForStop(instanceId)
      fetchInstances()
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to stop instance'
      toast.error(t(errorMessage) || errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loggedIn) {
      fetchInstances()
      // Refresh instances every 30 seconds
      const interval = setInterval(fetchInstances, 30000)
      return () => clearInterval(interval)
    }
  }, [loggedIn])

  if (!loggedIn || instances.length === 0) {
    return null
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {t('active_instances') || 'Active Instances'} ({instances.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {instances.map((instance) => (
            <div
              key={instance.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900">
                  <Play className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <span className="font-semibold text-foreground">
                    {instance.challenge?.name || 'Unknown Challenge'}
                  </span>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('container')}: {instance.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('started_on')} {new Date(instance.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-green-300 dark:bg-green-700 text-green-900 dark:text-green-100 border border-green-500 dark:border-green-400">
                  {t('running')}
                </Badge>
                <Button
                  onClick={() => stopInstance(instance.id)}
                  disabled={loading}
                  variant="destructive"
                  size="sm"
                >
                  {loading ? (
                    <>
                      <Settings className="w-4 h-4 mr-1 animate-spin" />
                      {t('stopping')}
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4 mr-1" />
                      {t('stop')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default InstanceStatus 