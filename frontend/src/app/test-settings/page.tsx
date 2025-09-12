"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Play,
  Square,
  Clock,
  Zap
} from 'lucide-react'
import { apiClient } from '@/lib/api'

interface TestSettings {
  id: number
  name: string
  description?: string
  measurement_delay: number  // 측정 간 지연시간 (초)
  phase_delay: number       // 단계 간 지연시간 (초)
  retry_count: number       // 실패시 재시도 횟수
  timeout_duration: number  // 타임아웃 시간 (초)
  is_active: boolean
  created_at: string
}

export default function TestSettingsPage() {
  const [settings, setSettings] = useState<TestSettings[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSettings, setEditingSettings] = useState<TestSettings | null>(null)
  
  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    measurement_delay: 1.0,
    phase_delay: 2.0,
    retry_count: 3,
    timeout_duration: 30
  })

  // 데이터 로드
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.getTestSettings()
      setSettings(data as TestSettings[])
    } catch (err) {
      setError('테스트 설정 목록을 불러올 수 없습니다')
      console.error('설정 로드 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsLoading(true)
      await apiClient.createTestSettings(formData)
      setShowAddForm(false)
      resetForm()
      await loadSettings()
      setError(null)
    } catch (err) {
      setError('테스트 설정을 추가할 수 없습니다')
      console.error('설정 생성 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSettings) return

    try {
      setIsLoading(true)
      await apiClient.updateTestSettings(editingSettings.id, formData)
      setEditingSettings(null)
      setShowAddForm(false)
      resetForm()
      await loadSettings()
      setError(null)
    } catch (err) {
      setError('테스트 설정을 수정할 수 없습니다')
      console.error('설정 수정 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSettings = async (settingsId: number) => {
    if (!confirm('이 테스트 설정을 삭제하시겠습니까?')) return

    try {
      setIsLoading(true)
      // API에 삭제 메서드가 없는 경우를 대비한 임시 처리
      // await apiClient.deleteTestSettings(settingsId)
      console.warn('삭제 API가 구현되지 않음:', settingsId)
      await loadSettings()
      setError(null)
    } catch (err) {
      setError('테스트 설정을 삭제할 수 없습니다')
      console.error('설정 삭제 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleActivateSettings = async (settingsId: number) => {
    try {
      setIsLoading(true)
      await apiClient.activateTestSettings(settingsId)
      await loadSettings()
      setError(null)
    } catch (err) {
      setError('테스트 설정을 활성화할 수 없습니다')
      console.error('설정 활성화 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const startEditing = (setting: TestSettings) => {
    setEditingSettings(setting)
    setFormData({
      name: setting.name,
      description: setting.description || '',
      measurement_delay: setting.measurement_delay,
      phase_delay: setting.phase_delay,
      retry_count: setting.retry_count,
      timeout_duration: setting.timeout_duration,
    })
    setShowAddForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      measurement_delay: 1.0,
      phase_delay: 2.0,
      retry_count: 3,
      timeout_duration: 30
    })
  }

  const cancelEditing = () => {
    setEditingSettings(null)
    setShowAddForm(false)
    resetForm()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">테스트 설정</h1>
          <p className="text-muted-foreground">
            검사 시간 및 조건 설정 관리
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadSettings} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
          >
            <Plus className="h-4 w-4 mr-2" />
            설정 추가
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setError(null)}
              className="ml-2"
            >
              닫기
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 테스트 설정 추가/수정 폼 */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingSettings ? '테스트 설정 수정' : '새 테스트 설정 추가'}
            </CardTitle>
            <CardDescription>
              검사 프로세스의 시간 및 재시도 조건을 설정하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={editingSettings ? handleUpdateSettings : handleCreateSettings} className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">설정명</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="테스트 설정명을 입력하세요"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="테스트 설정에 대한 설명 (선택사항)"
                />
              </div>

              {/* 시간 설정 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">시간 설정</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="measurement_delay">측정 간 지연시간 (초)</Label>
                    <Input
                      id="measurement_delay"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="60"
                      value={formData.measurement_delay}
                      onChange={(e) => setFormData(prev => ({ ...prev, measurement_delay: parseFloat(e.target.value) }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">각 측정 사이의 대기 시간</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phase_delay">단계 간 지연시간 (초)</Label>
                    <Input
                      id="phase_delay"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="300"
                      value={formData.phase_delay}
                      onChange={(e) => setFormData(prev => ({ ...prev, phase_delay: parseFloat(e.target.value) }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">P1, P2, P3 단계 사이의 대기 시간</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="retry_count">재시도 횟수</Label>
                    <Input
                      id="retry_count"
                      type="number"
                      min="0"
                      max="10"
                      value={formData.retry_count}
                      onChange={(e) => setFormData(prev => ({ ...prev, retry_count: parseInt(e.target.value) }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">측정 실패 시 재시도 횟수</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeout_duration">타임아웃 시간 (초)</Label>
                    <Input
                      id="timeout_duration"
                      type="number"
                      min="1"
                      max="600"
                      value={formData.timeout_duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, timeout_duration: parseInt(e.target.value) }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">전체 검사 프로세스의 최대 시간</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  {editingSettings ? '수정' : '추가'}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEditing}>
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 테스트 설정 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading && settings.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              로딩 중...
            </CardContent>
          </Card>
        ) : settings.length > 0 ? (
          settings.map((setting) => (
            <Card key={setting.id} className={`relative ${setting.is_active ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{setting.name}</CardTitle>
                      {setting.is_active && (
                        <Badge variant="success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          활성
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{setting.description || '설명 없음'}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditing(setting)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSettings(setting.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 설정 값들 */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">측정 간 지연</span>
                    <span className="font-mono">{setting.measurement_delay}초</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">단계 간 지연</span>
                    <span className="font-mono">{setting.phase_delay}초</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">재시도 횟수</span>
                    <span className="font-mono">{setting.retry_count}회</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">타임아웃</span>
                    <span className="font-mono">{setting.timeout_duration}초</span>
                  </div>
                </div>

                {/* 예상 시간 계산 */}
                <div className="bg-muted/50 p-3 rounded">
                  <div className="text-sm font-medium mb-1">예상 검사 시간</div>
                  <div className="text-xs text-muted-foreground">
                    최소: {(setting.measurement_delay * 3 + setting.phase_delay * 2).toFixed(1)}초
                    {' | '}
                    최대: {setting.timeout_duration}초
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  생성일: {new Date(setting.created_at).toLocaleDateString('ko-KR')}
                </div>

                <Button
                  variant={setting.is_active ? "secondary" : "default"}
                  size="sm"
                  onClick={() => handleActivateSettings(setting.id)}
                  disabled={isLoading || setting.is_active}
                  className="w-full"
                >
                  {setting.is_active ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      활성 중
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-1" />
                      활성화
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Settings className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">등록된 테스트 설정이 없습니다</p>
              <Button 
                onClick={() => setShowAddForm(true)} 
                className="mt-4"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                첫 번째 설정 추가
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}