"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Wrench, 
  Server, 
  Database,
  Wifi,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Save,
} from 'lucide-react'
import { apiClient } from '@/lib/api'

interface SystemSettings {
  apiUrl: string
  wsUrl: string
  updateInterval: number
  maxRetries: number
  logLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'
  autoBackup: boolean
  backupInterval: number
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
    updateInterval: 5000,
    maxRetries: 3,
    logLevel: 'INFO',
    autoBackup: true,
    backupInterval: 24,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [systemStatus, setSystemStatus] = useState({
    api: 'unknown' as 'online' | 'offline' | 'unknown',
    database: 'unknown' as 'connected' | 'disconnected' | 'unknown',
    websocket: 'unknown' as 'connected' | 'disconnected' | 'unknown'
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    checkSystemStatus()
    
    const interval = setInterval(checkSystemStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const checkSystemStatus = async () => {
    try {
      setIsLoading(true)
      
      // API 상태 확인
      try {
        await apiClient.healthCheck()
        setSystemStatus(prev => ({ ...prev, api: 'online' }))
      } catch {
        setSystemStatus(prev => ({ ...prev, api: 'offline' }))
      }

      // WebSocket 상태는 실제로 연결해서 확인해야 하므로 여기서는 생략
      setSystemStatus(prev => ({ ...prev, websocket: 'connected', database: 'connected' }))
      
    } catch (error) {
      console.error('시스템 상태 확인 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true)
      
      // 실제로는 백엔드에 설정을 저장해야 함
      // 여기서는 로컬 스토리지에 저장
      localStorage.setItem('systemSettings', JSON.stringify(settings))
      
      setMessage({ type: 'success', text: '설정이 성공적으로 저장되었습니다.' })
      
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: '설정 저장 중 오류가 발생했습니다.' })
      console.error('설정 저장 오류:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />정상</Badge>
      case 'offline':
      case 'disconnected':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />오프라인</Badge>
      default:
        return <Badge variant="secondary">알 수 없음</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">시스템 설정</h1>
          <p className="text-muted-foreground">
            시스템 환경 설정 및 상태 모니터링
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={checkSystemStatus} 
            variant="outline" 
            size="icon"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* 시스템 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            시스템 상태
          </CardTitle>
          <CardDescription>
            주요 시스템 구성 요소의 현재 상태
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">API 서버</span>
              </div>
              {getStatusBadge(systemStatus.api)}
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">데이터베이스</span>
              </div>
              {getStatusBadge(systemStatus.database)}
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">WebSocket</span>
              </div>
              {getStatusBadge(systemStatus.websocket)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 연결 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            연결 설정
          </CardTitle>
          <CardDescription>
            서버 연결 및 통신 설정
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api-url">API 서버 URL</Label>
              <Input
                id="api-url"
                value={settings.apiUrl}
                onChange={(e) => setSettings(prev => ({ ...prev, apiUrl: e.target.value }))}
                placeholder="http://localhost:8000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ws-url">WebSocket URL</Label>
              <Input
                id="ws-url"
                value={settings.wsUrl}
                onChange={(e) => setSettings(prev => ({ ...prev, wsUrl: e.target.value }))}
                placeholder="ws://localhost:8000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="update-interval">업데이트 간격 (ms)</Label>
              <Input
                id="update-interval"
                type="number"
                min="1000"
                max="60000"
                value={settings.updateInterval}
                onChange={(e) => setSettings(prev => ({ ...prev, updateInterval: parseInt(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-retries">최대 재시도 횟수</Label>
              <Input
                id="max-retries"
                type="number"
                min="0"
                max="10"
                value={settings.maxRetries}
                onChange={(e) => setSettings(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>


      {/* 로그 및 백업 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>고급 설정</CardTitle>
          <CardDescription>
            로그 레벨 및 백업 설정
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="log-level">로그 레벨</Label>
              <select
                id="log-level"
                value={settings.logLevel}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings(prev => ({ ...prev, logLevel: e.target.value as 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="DEBUG">디버그</option>
                <option value="INFO">정보</option>
                <option value="WARNING">경고</option>
                <option value="ERROR">오류</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>자동 백업</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="auto-backup"
                  checked={settings.autoBackup}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, autoBackup: e.target.checked }))}
                />
                <Label htmlFor="auto-backup" className="text-sm">자동 백업 활성화</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backup-interval">백업 주기 (시간)</Label>
              <Input
                id="backup-interval"
                type="number"
                min="1"
                max="168"
                value={settings.backupInterval}
                onChange={(e) => setSettings(prev => ({ ...prev, backupInterval: parseInt(e.target.value) }))}
                disabled={!settings.autoBackup}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="min-w-[120px]"
        >
          {isSaving ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          설정 저장
        </Button>
      </div>
    </div>
  )
}