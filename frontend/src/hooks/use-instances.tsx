import { useState } from 'react'
import axios from '@/lib/axios'
import { debugLog, debugError } from '@/lib/debug'
import { Instance, InstanceResponse } from '@/models/Instance'
import { toast } from 'sonner'
import { useLanguage } from '@/context/LanguageContext'

export const useInstances = () => {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildImage = async (challengeId: number) => {
    setLoading(true)
    try {
      const response = await axios.post(`/api/challenges/${challengeId}/build`)
      toast.success('Image built successfully')
      return response.data
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to build image'
      toast.error(t(errorMessage) || errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const startInstance = async (challengeId: string): Promise<InstanceResponse> => {
    setLoading(true)
    setError(null)
    
    try {
      debugLog(`Starting instance for challenge ID: ${challengeId}`)
      const response = await axios.post<InstanceResponse>(
        `/api/challenges/${challengeId}/start`,
        {},
        { timeout: 60000 }
      )
      debugLog('Instance started successfully:', response.data)
      toast.success('Instance started successfully')
      return response.data
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK_CHANGED') {
        debugLog('Network changed eror during compose start, treating as success')
        toast.success('Instance starting...')
        return { status: 'compose_instance_starting' } as InstanceResponse
      }
      
      debugError('Failed to start instance:', error)
      debugError('Response data:', error.response?.data)
      debugError('Response status:', error.response?.status)
      
      const errorCode = error.response?.data?.error
      const errorMessage = error.response?.data?.message
      
      if (errorCode === 'docker_unavailable') {
        toast.error(errorMessage || 'Docker service is currently unavailable. Please try again later.')
        setError('docker_unavailable')
      } else if (errorCode === 'instance_already_running') {
        toast.success('Instance is already running')
        return { status: 'instance_already_running' } as InstanceResponse
      } else if (errorCode === 'max_instances_by_user_reached') {
        toast.error('You have reached the maximum number of instances allowed')
        setError('max_instances_reached')
      } else if (errorCode === 'max_instances_by_team_reached') {
        toast.error('Your team has reached the maximum number of instances allowed')
        setError('max_instances_reached')
      } else if (errorCode === 'instance_cooldown_not_elapsed') {
        const remaining = Number(error.response?.data?.remaining_seconds ?? 0)
        const secs = Math.max(0, Math.floor(remaining))
        toast.error(t('instance_cooldown_wait', { seconds: secs }) || `Please wait ${secs}s before starting a new instance`)
        setError('instance_cooldown_not_elapsed')
      } else {
        toast.error(t(errorMessage || error.response?.data?.error) || 'Failed to start instance')
      setError(error.response?.data?.error || 'Failed to start instance')
      }
      
      throw error
    } finally {
      setLoading(false)
    }
  }

  const stopInstance = async (challengeId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      debugLog(`Stopping instance for challenge ID: ${challengeId}`)
      const response = await axios.post(`/api/challenges/${challengeId}/stop`)
      debugLog('Instance stopped successfully:', response.data)
      return response.data
    } catch (error: any) {
      debugError('Failed to stop instance:', error)
      debugError('Response data:', error.response?.data)
      debugError('Response status:', error.response?.status)
      setError(error.response?.data?.error || 'Failed to stop instance')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const killInstance = async (challengeId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await axios.post(`/api/challenges/${challengeId}/kill`)
      toast.success('Instance killed successfully')
      return response.data
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to kill instance'
      toast.error(t(errorMessage) || errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const getInstanceStatus = async (challengeId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      debugLog(`Getting instance status for challenge ID: ${challengeId}`)
      const response = await axios.get(`/api/challenges/${challengeId}/instance-status`)
      debugLog('Instance status received:', response.data)
      return response.data
    } catch (error: any) {
      debugError('Failed to get instance status:', error)
      debugError('Response data:', error.response?.data)
      debugError('Response status:', error.response?.status)
      setError(error.response?.data?.error || 'Failed to get instance status')
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    buildImage,
    startInstance,
    stopInstance,
    killInstance,
    getInstanceStatus,
    error,
  }
} 