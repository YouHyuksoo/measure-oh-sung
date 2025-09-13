"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Settings,
  BarChart3,
  Calendar,
  FileText,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface InspectionModel {
  id: number;
  model_name: string;
  description?: string;
  p1_lower_limit: number;
  p1_upper_limit: number;
  p2_lower_limit: number;
  p2_upper_limit: number;
  p3_lower_limit: number;
  p3_upper_limit: number;
  p1_enabled: boolean;
  p2_enabled: boolean;
  p3_enabled: boolean;
  is_active: boolean;
  created_at: string;
}

export default function InspectionModelsPage() {
  const [models, setModels] = useState<InspectionModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<InspectionModel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    barcode_pattern: "",
    p1_min_value: 0,
    p1_max_value: 100,
    p1_enabled: true,
    p2_min_value: 0,
    p2_max_value: 100,
    p2_enabled: true,
    p3_min_value: 0,
    p3_max_value: 100,
    p3_enabled: false,
  });

  // 데이터 로드
  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getInspectionModelsAll();
      setModels(data as InspectionModel[]);
    } catch (err) {
      setError("검사 모델 목록을 불러올 수 없습니다");
      console.error("모델 로드 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // 백엔드 스키마에 맞게 데이터 변환
      const backendData = {
        model_name: formData.name,
        description: formData.description,
        p1_lower_limit: formData.p1_min_value,
        p1_upper_limit: formData.p1_max_value,
        p1_enabled: formData.p1_enabled,
        p2_lower_limit: formData.p2_min_value,
        p2_upper_limit: formData.p2_max_value,
        p2_enabled: formData.p2_enabled,
        p3_lower_limit: formData.p3_min_value,
        p3_upper_limit: formData.p3_max_value,
        p3_enabled: formData.p3_enabled,
      };
      
      await apiClient.createInspectionModel(backendData);
      await loadModels();
      setIsDialogOpen(false);
      resetForm();
      setError(null);
    } catch (err) {
      setError("검사 모델을 추가할 수 없습니다");
      console.error("모델 생성 오류:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel) return;

    setIsSubmitting(true);
    try {
      // 백엔드 스키마에 맞게 데이터 변환
      const backendData = {
        model_name: formData.name,
        description: formData.description,
        p1_lower_limit: formData.p1_min_value,
        p1_upper_limit: formData.p1_max_value,
        p1_enabled: formData.p1_enabled,
        p2_lower_limit: formData.p2_min_value,
        p2_upper_limit: formData.p2_max_value,
        p2_enabled: formData.p2_enabled,
        p3_lower_limit: formData.p3_min_value,
        p3_upper_limit: formData.p3_max_value,
        p3_enabled: formData.p3_enabled,
      };
      
      await apiClient.updateInspectionModel(editingModel.id, backendData);
      await loadModels();
      setIsDialogOpen(false);
      setEditingModel(null);
      resetForm();
      setError(null);
    } catch (err) {
      setError("검사 모델을 수정할 수 없습니다");
      console.error("모델 수정 오류:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteModel = async (modelId: number) => {
    if (!confirm("이 검사 모델을 삭제하시겠습니까?")) return;

    try {
      setIsLoading(true);
      await apiClient.deleteInspectionModel(modelId);
      await loadModels();
      setError(null);
    } catch (err) {
      setError("검사 모델을 삭제할 수 없습니다");
      console.error("모델 삭제 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateModel = async (modelId: number) => {
    try {
      setIsLoading(true);
      const model = models.find((m) => m.id === modelId);
      if (model) {
        // 백엔드 스키마에 맞게 데이터 변환
        const backendData = {
          model_name: model.model_name,
          description: model.description,
          p1_lower_limit: model.p1_lower_limit,
          p1_upper_limit: model.p1_upper_limit,
          p1_enabled: model.p1_enabled,
          p2_lower_limit: model.p2_lower_limit,
          p2_upper_limit: model.p2_upper_limit,
          p2_enabled: model.p2_enabled,
          p3_lower_limit: model.p3_lower_limit,
          p3_upper_limit: model.p3_upper_limit,
          p3_enabled: model.p3_enabled,
          is_active: !model.is_active,
        };
        
        await apiClient.updateInspectionModel(modelId, backendData);
      }
      await loadModels();
      setError(null);
    } catch (err) {
      setError("검사 모델 활성화 상태를 변경할 수 없습니다");
      console.error("모델 활성화 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (model: InspectionModel) => {
    setEditingModel(model);
    setFormData({
      name: model.model_name,
      description: model.description || "",
      barcode_pattern: "",
      p1_min_value: model.p1_lower_limit,
      p1_max_value: model.p1_upper_limit,
      p1_enabled: model.p1_enabled || false,
      p2_min_value: model.p2_lower_limit,
      p2_max_value: model.p2_upper_limit,
      p2_enabled: model.p2_enabled || false,
      p3_min_value: model.p3_lower_limit,
      p3_max_value: model.p3_upper_limit,
      p3_enabled: model.p3_enabled || false,
    });
    setIsDialogOpen(true);
  };

  const startCreating = () => {
    setEditingModel(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      barcode_pattern: "",
      p1_min_value: 0,
      p1_max_value: 100,
      p1_enabled: true,
      p2_min_value: 0,
      p2_max_value: 100,
      p2_enabled: true,
      p3_min_value: 0,
      p3_max_value: 100,
      p3_enabled: false,
    });
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingModel(null);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">검사 모델 관리</h1>
            <p className="text-muted-foreground">
              검사 모델 관리 및 측정 기준 설정
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={loadModels} variant="outline" size="icon">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={startCreating}>
                  <Plus className="h-4 w-4 mr-2" />
                  새 모델 추가
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>

        {/* 오류 메시지 */}
        {error && (
          <Alert variant="destructive" className="mb-6">
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

        {/* 검사 모델 카드 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading && models.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">모델을 불러오는 중...</p>
                </div>
              </CardContent>
            </Card>
          ) : models.length > 0 ? (
            models.map((model) => (
              <Card 
                key={model.id} 
                className={`relative transition-all duration-200 hover:shadow-md ${
                  model.is_active ? 'ring-2 ring-primary shadow-lg' : ''
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{model.model_name}</CardTitle>
                        {model.is_active && (
                          <Badge className="bg-green-500 hover:bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            활성
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="line-clamp-2">
                        {model.description || "설명이 없습니다"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditing(model)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteModel(model.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">

                  {/* 측정 기준값 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">측정 기준값</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {/* P1 */}
                      <div className={`p-3 rounded-lg border-l-4 ${
                        model.p1_enabled !== false 
                          ? 'bg-blue-50 border-blue-500' 
                          : 'bg-gray-100 border-gray-300'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-medium text-sm flex items-center gap-2 ${
                            model.p1_enabled !== false ? 'text-blue-700' : 'text-gray-500'
                          }`}>
                            P1 단계
                            {model.p1_enabled === false && (
                              <Badge variant="secondary" className="text-xs">미사용</Badge>
                            )}
                          </span>
                          <span className={`font-mono text-sm ${
                            model.p1_enabled !== false ? 'text-blue-600' : 'text-gray-400'
                          }`}>
                            {model.p1_lower_limit} - {model.p1_upper_limit}
                          </span>
                        </div>
                      </div>
                      
                      {/* P2 */}
                      <div className={`p-3 rounded-lg border-l-4 ${
                        model.p2_enabled !== false 
                          ? 'bg-green-50 border-green-500' 
                          : 'bg-gray-100 border-gray-300'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-medium text-sm flex items-center gap-2 ${
                            model.p2_enabled !== false ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            P2 단계
                            {model.p2_enabled === false && (
                              <Badge variant="secondary" className="text-xs">미사용</Badge>
                            )}
                          </span>
                          <span className={`font-mono text-sm ${
                            model.p2_enabled !== false ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {model.p2_lower_limit} - {model.p2_upper_limit}
                          </span>
                        </div>
                      </div>
                      
                      {/* P3 */}
                      <div className={`p-3 rounded-lg border-l-4 ${
                        model.p3_enabled !== false 
                          ? 'bg-purple-50 border-purple-500' 
                          : 'bg-gray-100 border-gray-300'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-medium text-sm flex items-center gap-2 ${
                            model.p3_enabled !== false ? 'text-purple-700' : 'text-gray-500'
                          }`}>
                            P3 단계
                            {model.p3_enabled === false && (
                              <Badge variant="secondary" className="text-xs">미사용</Badge>
                            )}
                          </span>
                          <span className={`font-mono text-sm ${
                            model.p3_enabled !== false ? 'text-purple-600' : 'text-gray-400'
                          }`}>
                            {model.p3_lower_limit} - {model.p3_upper_limit}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 생성일 */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    생성일: {new Date(model.created_at).toLocaleDateString("ko-KR")}
                  </div>

                  {/* 액션 버튼 */}
                  <Button
                    variant={model.is_active ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleActivateModel(model.id)}
                    disabled={isLoading}
                    className="w-full"
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
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Database className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">등록된 검사 모델이 없습니다</h3>
                <p className="text-muted-foreground mb-4">
                  첫 번째 검사 모델을 추가해보세요
                </p>
                <Button onClick={startCreating} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  첫 번째 모델 추가
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 모달 입력창 */}
        <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingModel ? "검사 모델 수정" : "새 검사 모델 추가"}
              </DialogTitle>
              <DialogDescription>
                검사 모델의 정보와 각 단계별 측정 기준값을 설정하세요
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={editingModel ? handleUpdateModel : handleCreateModel}>
              <div className="space-y-6 py-4">
                {/* 기본 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">모델명 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="검사 모델명을 입력하세요"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">설명</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="검사 모델에 대한 설명"
                    />
                  </div>
                </div>

                {/* 측정 기준값 - 3단계 가로 배치 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    측정 기준값
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* P1 단계 */}
                    <div className="border rounded-lg p-4 space-y-3 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-blue-700">P1 단계</h4>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="p1_enabled"
                            checked={formData.p1_enabled}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                p1_enabled: checked as boolean,
                              }))
                            }
                          />
                          <Label htmlFor="p1_enabled" className="text-sm">사용</Label>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="p1_min" className="text-sm">최소값</Label>
                          <Input
                            id="p1_min"
                            type="number"
                            step="0.01"
                            value={formData.p1_min_value}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                p1_min_value: parseFloat(e.target.value) || 0,
                              }))
                            }
                            disabled={!formData.p1_enabled}
                            required={formData.p1_enabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="p1_max" className="text-sm">최대값</Label>
                          <Input
                            id="p1_max"
                            type="number"
                            step="0.01"
                            value={formData.p1_max_value}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                p1_max_value: parseFloat(e.target.value) || 0,
                              }))
                            }
                            disabled={!formData.p1_enabled}
                            required={formData.p1_enabled}
                          />
                        </div>
                      </div>
                    </div>

                    {/* P2 단계 */}
                    <div className="border rounded-lg p-4 space-y-3 bg-green-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-green-700">P2 단계</h4>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="p2_enabled"
                            checked={formData.p2_enabled}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                p2_enabled: checked as boolean,
                              }))
                            }
                          />
                          <Label htmlFor="p2_enabled" className="text-sm">사용</Label>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="p2_min" className="text-sm">최소값</Label>
                          <Input
                            id="p2_min"
                            type="number"
                            step="0.01"
                            value={formData.p2_min_value}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                p2_min_value: parseFloat(e.target.value) || 0,
                              }))
                            }
                            disabled={!formData.p2_enabled}
                            required={formData.p2_enabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="p2_max" className="text-sm">최대값</Label>
                          <Input
                            id="p2_max"
                            type="number"
                            step="0.01"
                            value={formData.p2_max_value}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                p2_max_value: parseFloat(e.target.value) || 0,
                              }))
                            }
                            disabled={!formData.p2_enabled}
                            required={formData.p2_enabled}
                          />
                        </div>
                      </div>
                    </div>

                    {/* P3 단계 */}
                    <div className="border rounded-lg p-4 space-y-3 bg-purple-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-purple-700">P3 단계</h4>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="p3_enabled"
                            checked={formData.p3_enabled}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                p3_enabled: checked as boolean,
                              }))
                            }
                          />
                          <Label htmlFor="p3_enabled" className="text-sm">사용</Label>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="p3_min" className="text-sm">최소값</Label>
                          <Input
                            id="p3_min"
                            type="number"
                            step="0.01"
                            value={formData.p3_min_value}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                p3_min_value: parseFloat(e.target.value) || 0,
                              }))
                            }
                            disabled={!formData.p3_enabled}
                            required={formData.p3_enabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="p3_max" className="text-sm">최대값</Label>
                          <Input
                            id="p3_max"
                            type="number"
                            step="0.01"
                            value={formData.p3_max_value}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                p3_max_value: parseFloat(e.target.value) || 0,
                              }))
                            }
                            disabled={!formData.p3_enabled}
                            required={formData.p3_enabled}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDialog}
                  disabled={isSubmitting}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting 
                    ? (editingModel ? "수정 중..." : "추가 중...") 
                    : (editingModel ? "수정 완료" : "추가 완료")
                  }
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}