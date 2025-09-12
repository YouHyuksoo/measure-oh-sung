"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Database, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Play,
  Square,
  Settings
} from 'lucide-react'
import { apiClient } from '@/lib/api'

interface InspectionModel {
  id: number
  name: string
  description?: string
  barcode_pattern?: string
  p1_min_value: number
  p1_max_value: number
  p2_min_value: number
  p2_max_value: number
  p3_min_value: number
  p3_max_value: number
  is_active: boolean
  created_at: string
}

export default function InspectionModelsPage() {
  const [models, setModels] = useState<InspectionModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingModel, setEditingModel] = useState<InspectionModel | null>(null)
  
  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    barcode_pattern: '',
    p1_min_value: 0,
    p1_max_value: 100,
    p2_min_value: 0,
    p2_max_value: 100,
    p3_min_value: 0,
    p3_max_value: 100,
  })

  // 데이터 로드
  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.getInspectionModelsAll()
      setModels(data as InspectionModel[])
    } catch (err) {
      setError('검사 모델 목록을 불러올 수 없습니다')
      console.error('모델 로드 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsLoading(true)
      await apiClient.createInspectionModel(formData)
      setShowAddForm(false)
      resetForm()
      await loadModels()
      setError(null)
    } catch (err) {
      setError('검사 모델을 추가할 수 없습니다')
      console.error('모델 생성 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateModel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingModel) return

    try {
      setIsLoading(true)
      await apiClient.updateInspectionModel(editingModel.id, formData)
      setEditingModel(null)
      setShowAddForm(false)
      resetForm()
      await loadModels()
      setError(null)
    } catch (err) {
      setError('검사 모델을 수정할 수 없습니다')
      console.error('모델 수정 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteModel = async (modelId: number) => {
    if (!confirm('이 검사 모델을 삭제하시겠습니까?')) return

    try {
      setIsLoading(true)
      await apiClient.deleteInspectionModel(modelId)
      await loadModels()
      setError(null)
    } catch (err) {
      setError('검사 모델을 삭제할 수 없습니다')
      console.error('모델 삭제 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleActivateModel = async (modelId: number) => {
    try {
      setIsLoading(true)
      // API에서 테스트 설정 활성화를 사용 (검사 모델 활성화 API가 없는 경우)
      // await apiClient.activateTestSettings(modelId) // 실제로는 검사 모델 활성화 API가 필요
      // 임시로 모델 업데이트를 사용
      const model = models.find(m => m.id === modelId)
      if (model) {
        await apiClient.updateInspectionModel(modelId, { ...model, is_active: !model.is_active })
      }
      await loadModels()
      setError(null)
    } catch (err) {
      setError('검사 모델 활성화 상태를 변경할 수 없습니다')
      console.error('모델 활성화 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const startEditing = (model: InspectionModel) => {
    setEditingModel(model)
    setFormData({
      name: model.name,
      description: model.description || '',
      barcode_pattern: model.barcode_pattern || '',
      p1_min_value: model.p1_min_value,
      p1_max_value: model.p1_max_value,
      p2_min_value: model.p2_min_value,
      p2_max_value: model.p2_max_value,
      p3_min_value: model.p3_min_value,
      p3_max_value: model.p3_max_value,
    })
    setShowAddForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      barcode_pattern: '',
      p1_min_value: 0,
      p1_max_value: 100,
      p2_min_value: 0,
      p2_max_value: 100,
      p3_min_value: 0,
      p3_max_value: 100,
    })
  }

  const cancelEditing = () => {
    setEditingModel(null)
    setShowAddForm(false)
    resetForm()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">검사 모델</h1>
          <p className="text-muted-foreground">
            검사 모델 관리 및 측정 기준 설정
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadModels} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
          >
            <Plus className="h-4 w-4 mr-2" />
            모델 추가
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

      {/* 검사 모델 추가/수정 폼 */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingModel ? '검사 모델 수정' : '새 검사 모델 추가'}
            </CardTitle>
            <CardDescription>
              검사 모델의 정보와 각 단계별 측정 기준값을 설정하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={editingModel ? handleUpdateModel : handleCreateModel} className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">모델명</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="검사 모델명을 입력하세요"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode_pattern">바코드 패턴</Label>
                  <Input
                    id="barcode_pattern"
                    value={formData.barcode_pattern}
                    onChange={(e) => setFormData(prev => ({ ...prev, barcode_pattern: e.target.value }))}
                    placeholder="예: ABC-####-### (선택사항)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="검사 모델에 대한 설명 (선택사항)"
                />
              </div>

              {/* 측정 기준값 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">측정 기준값</h3>
                
                {/* P1 단계 */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-blue-600">P1 단계</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="p1_min">최소값</Label>
                      <Input
                        id="p1_min"
                        type="number"
                        step="0.01"
                        value={formData.p1_min_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, p1_min_value: parseFloat(e.target.value) }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p1_max">최대값</Label>
                      <Input
                        id="p1_max"
                        type="number"
                        step="0.01"
                        value={formData.p1_max_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, p1_max_value: parseFloat(e.target.value) }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* P2 단계 */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-green-600">P2 단계</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="p2_min">최소값</Label>
                      <Input
                        id="p2_min"
                        type="number"
                        step="0.01"
                        value={formData.p2_min_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, p2_min_value: parseFloat(e.target.value) }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2_max">최대값</Label>
                      <Input
                        id="p2_max"
                        type="number"
                        step="0.01"
                        value={formData.p2_max_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, p2_max_value: parseFloat(e.target.value) }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* P3 단계 */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-purple-600">P3 단계</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="p3_min">최소값</Label>
                      <Input
                        id="p3_min"
                        type="number"
                        step="0.01"
                        value={formData.p3_min_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, p3_min_value: parseFloat(e.target.value) }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p3_max">최대값</Label>
                      <Input
                        id="p3_max"
                        type="number"
                        step="0.01"
                        value={formData.p3_max_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, p3_max_value: parseFloat(e.target.value) }))}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  {editingModel ? '수정' : '추가'}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEditing}>
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 검사 모델 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading && models.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              로딩 중...
            </CardContent>
          </Card>
        ) : models.length > 0 ? (
          models.map((model) => (
            <Card key={model.id} className={`relative ${model.is_active ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{model.name}</CardTitle>
                      {model.is_active && (
                        <Badge variant="success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          활성
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{model.description || '설명 없음'}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditing(model)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteModel(model.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 바코드 패턴 */}
                {model.barcode_pattern && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">바코드 패턴</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {model.barcode_pattern}
                    </Badge>
                  </div>
                )}

                {/* 측정 기준값 */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">측정 기준값</h4>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {/* P1 */}
                    <div className="bg-blue-50 p-2 rounded border-l-2 border-blue-500">
                      <div className="font-medium text-blue-700">P1</div>
                      <div className="text-blue-600">
                        {model.p1_min_value} - {model.p1_max_value}
                      </div>
                    </div>
                    
                    {/* P2 */}
                    <div className="bg-green-50 p-2 rounded border-l-2 border-green-500">
                      <div className="font-medium text-green-700">P2</div>
                      <div className="text-green-600">
                        {model.p2_min_value} - {model.p2_max_value}
                      </div>
                    </div>
                    
                    {/* P3 */}
                    <div className="bg-purple-50 p-2 rounded border-l-2 border-purple-500">
                      <div className="font-medium text-purple-700">P3</div>
                      <div className="text-purple-600">
                        {model.p3_min_value} - {model.p3_max_value}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  생성일: {new Date(model.created_at).toLocaleDateString('ko-KR')}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={model.is_active ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleActivateModel(model.id)}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {model.is_active ? (
                      <>
                        <Square className="h-3 w-3 mr-1" />
                        비활성화
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" />
                        활성화
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Database className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">등록된 검사 모델이 없습니다</p>
              <Button 
                onClick={() => setShowAddForm(true)} 
                className="mt-4"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                첫 번째 모델 추가
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}