"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Timer,
  Save,
  Activity
} from 'lucide-react'
import { apiClient } from '@/lib/api'

// 테스트 설정 인터페이스
interface TestSettings {
  id: number
  name: string
  description?: string
  p1_measure_duration: number    // P1 측정 시간 (초)
  wait_duration_1_to_2: number  // P1-P2 대기 시간 (초)
  p2_measure_duration: number    // P2 측정 시간 (초)
  wait_duration_2_to_3: number  // P2-P3 대기 시간 (초)
  p3_measure_duration: number    // P3 측정 시간 (초)
  is_active: boolean
  inspection_model_id?: number   // 검사 모델 ID (null이면 전역 설정)
  created_at: string
  updated_at: string
}

// 검사 모델 인터페이스
interface InspectionModel {
  id: number
  model_name: string
  description?: string
  p1_lower_limit: number
  p1_upper_limit: number
  p2_lower_limit: number
  p2_upper_limit: number
  p3_lower_limit: number
  p3_upper_limit: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// 새 테스트 설정 생성 인터페이스
interface CreateTestSettings {
  name: string
  description?: string
  p1_measure_duration: number
  wait_duration_1_to_2: number
  p2_measure_duration: number
  wait_duration_2_to_3: number
  p3_measure_duration: number
  is_active: boolean
  inspection_model_id?: number
}

export default function TestSettingsPage() {
  const [testSettings, setTestSettings] = useState<TestSettings[]>([])
  const [inspectionModels, setInspectionModels] = useState<InspectionModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSettings, setEditingSettings] = useState<TestSettings | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null)
  const [filterByModel, setFilterByModel] = useState<number | null>(null)

  // 폼 데이터
  const [formData, setFormData] = useState<CreateTestSettings>({
    name: '',
    description: '',
    p1_measure_duration: 5.0,
    wait_duration_1_to_2: 2.0,
    p2_measure_duration: 5.0,
    wait_duration_2_to_3: 2.0,
    p3_measure_duration: 5.0,
    is_active: false,
    inspection_model_id: undefined
  })

  // 검사 모델 목록 조회
  const fetchInspectionModels = async () => {
    try {
      const response = await apiClient.getInspectionModelsAll() as InspectionModel[]
      setInspectionModels(response)
    } catch (err) {
      console.error('검사 모델 조회 실패:', err)
    }
  }

  // 테스트 설정 목록 조회
  const fetchTestSettings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.getTestSettings() as TestSettings[]
      let settings = response

      // 필터링 적용
      if (filterByModel === -1) {
        // 전역 설정만 (inspection_model_id가 null인 것들)
        settings = settings.filter((s: TestSettings) => !s.inspection_model_id)
      } else if (filterByModel && filterByModel > 0) {
        // 특정 모델 설정만
        settings = settings.filter((s: TestSettings) => s.inspection_model_id === filterByModel)
      }
      // filterByModel이 null이면 전체 설정 표시

      setTestSettings(settings)
    } catch (err) {
      setError('테스트 설정을 불러오는데 실패했습니다.')
      console.error('테스트 설정 조회 실패:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // 테스트 설정 생성
  const createTestSettings = async () => {
    try {
      const response = await apiClient.createTestSettings(formData)
      await fetchTestSettings()
      setShowAddForm(false)
      resetForm()
    } catch (err) {
      setError('테스트 설정 생성에 실패했습니다.')
      console.error('테스트 설정 생성 실패:', err)
    }
  }

  // 테스트 설정 수정
  const updateTestSettings = async () => {
    if (!editingSettings) return
    try {
      const response = await apiClient.updateTestSettings(editingSettings.id, formData)
      await fetchTestSettings()
      setEditingSettings(null)
      resetForm()
    } catch (err) {
      setError('테스트 설정 수정에 실패했습니다.')
      console.error('테스트 설정 수정 실패:', err)
    }
  }

  // 테스트 설정 삭제
  const deleteTestSettings = async (id: number) => {
    if (!confirm('정말로 이 테스트 설정을 삭제하시겠습니까?')) return
    try {
      await apiClient.deleteTestSettings(id)
      await fetchTestSettings()
    } catch (err) {
      setError('테스트 설정 삭제에 실패했습니다.')
      console.error('테스트 설정 삭제 실패:', err)
    }
  }

  // 테스트 설정 활성화
  const activateTestSettings = async (id: number) => {
    try {
      await apiClient.activateTestSettings(id)
      await fetchTestSettings()
    } catch (err) {
      setError('테스트 설정 활성화에 실패했습니다.')
      console.error('테스트 설정 활성화 실패:', err)
    }
  }

  // 폼 리셋
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      p1_measure_duration: 5.0,
      wait_duration_1_to_2: 2.0,
      p2_measure_duration: 5.0,
      wait_duration_2_to_3: 2.0,
      p3_measure_duration: 5.0,
      is_active: false,
      inspection_model_id: undefined
    })
    setSelectedModelId(null)
  }

  // 수정 모드 시작
  const startEdit = (settings: TestSettings) => {
    setEditingSettings(settings)
    setFormData({
      name: settings.name,
      description: settings.description || '',
      p1_measure_duration: settings.p1_measure_duration,
      wait_duration_1_to_2: settings.wait_duration_1_to_2,
      p2_measure_duration: settings.p2_measure_duration,
      wait_duration_2_to_3: settings.wait_duration_2_to_3,
      p3_measure_duration: settings.p3_measure_duration,
      is_active: settings.is_active,
      inspection_model_id: settings.inspection_model_id
    })
    setSelectedModelId(settings.inspection_model_id || null)
  }

  // 수정 취소
  const cancelEdit = () => {
    setEditingSettings(null)
    resetForm()
  }

  // 총 테스트 시간 계산
  const calculateTotalDuration = (settings: CreateTestSettings) => {
    return settings.p1_measure_duration +
           settings.wait_duration_1_to_2 +
           settings.p2_measure_duration +
           settings.wait_duration_2_to_3 +
           settings.p3_measure_duration
  }

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchInspectionModels()
    fetchTestSettings()
  }, [filterByModel])

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">테스트 설정 관리</h1>
          <p className="text-muted-foreground">SCPI 명령 실행 관련 기술적 설정을 관리합니다</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          새 테스트 설정 추가
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>검사 모델별 필터:</Label>
              <Select
                value={filterByModel === -1 ? "global" : (filterByModel?.toString() || "all")}
                onValueChange={(value) => {
                  if (value === "all") {
                    setFilterByModel(null)
                  } else if (value === "global") {
                    setFilterByModel(-1)
                  } else {
                    setFilterByModel(parseInt(value))
                  }
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 설정</SelectItem>
                  <SelectItem value="global">전역 설정만</SelectItem>
                  {inspectionModels.map(model => (
                    <SelectItem key={model.id} value={model.id.toString()}>
                      {model.model_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={fetchTestSettings}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 테스트 설정 추가/수정 폼 */}
      {(showAddForm || editingSettings) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingSettings ? '테스트 설정 수정' : '새 테스트 설정 추가'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">설정 이름</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="예: 고정밀 측정 설정"
                  />
                </div>
                <div>
                  <Label htmlFor="description">설명</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="설정에 대한 설명"
                  />
                </div>
                <div>
                  <Label>검사 모델 연결</Label>
                  <Select
                    value={selectedModelId?.toString() || "global"}
                    onValueChange={(value) => {
                      if (value === "global") {
                        setSelectedModelId(null)
                        setFormData({...formData, inspection_model_id: undefined})
                      } else {
                        const modelId = parseInt(value)
                        setSelectedModelId(modelId)
                        setFormData({...formData, inspection_model_id: modelId})
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">전역 설정</SelectItem>
                      {inspectionModels.map(model => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                          {model.model_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="p1_measure_duration">P1 측정 시간 (초)</Label>
                  <Input
                    id="p1_measure_duration"
                    type="number"
                    step="0.1"
                    value={formData.p1_measure_duration}
                    onChange={(e) => setFormData({...formData, p1_measure_duration: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="wait_duration_1_to_2">P1-P2 대기 시간 (초)</Label>
                  <Input
                    id="wait_duration_1_to_2"
                    type="number"
                    step="0.1"
                    value={formData.wait_duration_1_to_2}
                    onChange={(e) => setFormData({...formData, wait_duration_1_to_2: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="p2_measure_duration">P2 측정 시간 (초)</Label>
                  <Input
                    id="p2_measure_duration"
                    type="number"
                    step="0.1"
                    value={formData.p2_measure_duration}
                    onChange={(e) => setFormData({...formData, p2_measure_duration: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="wait_duration_2_to_3">P2-P3 대기 시간 (초)</Label>
                  <Input
                    id="wait_duration_2_to_3"
                    type="number"
                    step="0.1"
                    value={formData.wait_duration_2_to_3}
                    onChange={(e) => setFormData({...formData, wait_duration_2_to_3: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="p3_measure_duration">P3 측정 시간 (초)</Label>
                  <Input
                    id="p3_measure_duration"
                    type="number"
                    step="0.1"
                    value={formData.p3_measure_duration}
                    onChange={(e) => setFormData({...formData, p3_measure_duration: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
            </div>

            {/* 총 시간 표시 */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <Clock className="inline h-4 w-4 mr-1" />
                총 테스트 시간: <strong>{calculateTotalDuration(formData).toFixed(1)}초</strong>
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={editingSettings ? cancelEdit : () => setShowAddForm(false)}
              >
                취소
              </Button>
              <Button onClick={editingSettings ? updateTestSettings : createTestSettings}>
                <Save className="h-4 w-4 mr-2" />
                {editingSettings ? '수정' : '생성'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 테스트 설정 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            테스트 설정 목록
          </CardTitle>
          <CardDescription>
            현재 등록된 테스트 설정들입니다. 각 설정은 SCPI 명령 실행 시 사용되는 기술적 파라미터들을 포함합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              로딩 중...
            </div>
          ) : testSettings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              테스트 설정이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {testSettings.map((settings) => (
                <div key={settings.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{settings.name}</h3>
                        {settings.is_active && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            활성
                          </Badge>
                        )}
                        {settings.inspection_model_id ? (
                          <Badge variant="secondary">
                            모델별: {inspectionModels.find(m => m.id === settings.inspection_model_id)?.model_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            전역 설정
                          </Badge>
                        )}
                      </div>
                      {settings.description && (
                        <p className="text-sm text-muted-foreground mb-3">{settings.description}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">P1 측정:</span>
                          <div className="font-medium">{settings.p1_measure_duration}초</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">P1-P2 대기:</span>
                          <div className="font-medium">{settings.wait_duration_1_to_2}초</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">P2 측정:</span>
                          <div className="font-medium">{settings.p2_measure_duration}초</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">P2-P3 대기:</span>
                          <div className="font-medium">{settings.wait_duration_2_to_3}초</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">P3 측정:</span>
                          <div className="font-medium">{settings.p3_measure_duration}초</div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">총 시간:</span>
                        <span className="font-medium ml-1">
                          {(settings.p1_measure_duration +
                            settings.wait_duration_1_to_2 +
                            settings.p2_measure_duration +
                            settings.wait_duration_2_to_3 +
                            settings.p3_measure_duration).toFixed(1)}초
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!settings.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activateTestSettings(settings.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          활성화
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(settings)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteTestSettings(settings.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}