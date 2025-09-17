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

interface InspectionStep {
  id: number;
  step_name: string;
  step_order: number;
  lower_limit: number;
  upper_limit: number;
  inspection_model_id: number;
  created_at: string;
  updated_at: string;
}

interface InspectionModel {
  id: number;
  model_name: string;
  description?: string;
  is_active: boolean;
  inspection_steps: InspectionStep[];
  created_at: string;
  updated_at: string;
}

export default function InspectionModelsPage() {
  const [models, setModels] = useState<InspectionModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<InspectionModel | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState({
    model_name: "",
    description: "",
    inspection_steps: [] as Array<{
      step_name: string;
      step_order: number;
      lower_limit: number;
      upper_limit: number;
    }>,
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
      // 검사단계가 있는지 확인
      if (formData.inspection_steps.length === 0) {
        setError("최소 하나의 검사단계를 추가해주세요");
        setIsSubmitting(false);
        return;
      }

      // 백엔드 스키마에 맞게 데이터 변환
      const backendData = {
        model_name: formData.model_name,
        description: formData.description,
        inspection_steps: formData.inspection_steps
          .filter((step) => step)
          .map((step, index) => ({
            step_name: step.step_name,
            step_order: step.step_order || index + 1,
            lower_limit: step.lower_limit,
            upper_limit: step.upper_limit,
          })),
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
      // 검사단계가 있는지 확인
      if (formData.inspection_steps.length === 0) {
        setError("최소 하나의 검사단계를 추가해주세요");
        setIsSubmitting(false);
        return;
      }

      // 백엔드 스키마에 맞게 데이터 변환
      const backendData = {
        model_name: formData.model_name,
        description: formData.description,
        inspection_steps: formData.inspection_steps
          .filter((step) => step)
          .map((step, index) => ({
            step_name: step.step_name,
            step_order: step.step_order || index + 1,
            lower_limit: step.lower_limit,
            upper_limit: step.upper_limit,
          })),
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
      model_name: model.model_name,
      description: model.description || "",
      inspection_steps: model.inspection_steps.map((step) => ({
        step_name: step.step_name,
        step_order: step.step_order,
        lower_limit: step.lower_limit,
        upper_limit: step.upper_limit,
      })),
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
      model_name: "",
      description: "",
      inspection_steps: [],
    });
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingModel(null);
    resetForm();
  };

  // 검사단계 관리 함수들
  const addInspectionStep = () => {
    const newStep = {
      step_name: "",
      step_order: formData.inspection_steps.length + 1,
      lower_limit: 0,
      upper_limit: 100,
    };
    setFormData((prev) => ({
      ...prev,
      inspection_steps: [...prev.inspection_steps, newStep],
    }));
  };

  const removeInspectionStep = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      inspection_steps: prev.inspection_steps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, step_order: i + 1 })),
    }));
  };

  const updateInspectionStep = (index: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      inspection_steps: prev.inspection_steps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step
      ),
    }));
  };

  const moveInspectionStep = (index: number, direction: "up" | "down") => {
    const steps = [...formData.inspection_steps].filter(
      (step) => step
    ) as Array<{
      step_name: string;
      step_order: number;
      lower_limit: number;
      upper_limit: number;
    }>;
    const newIndex = direction === "up" ? index - 1 : index + 1;

    if (newIndex >= 0 && newIndex < steps.length) {
      const temp = steps[index]!;
      steps[index] = steps[newIndex]!;
      steps[newIndex] = temp;

      // 순서 재정렬
      const reorderedSteps = steps.map((step, i) => ({
        ...step,
        step_order: i + 1,
      }));

      setFormData((prev) => ({
        ...prev,
        inspection_steps: reorderedSteps,
      }));
    }
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
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={startCreating}>
                  <Plus className="h-4 w-4 mr-2" />새 모델 추가
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
                  model.is_active ? "ring-2 ring-primary shadow-lg" : ""
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">
                          {model.model_name}
                        </CardTitle>
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
                  {/* 검사단계 목록 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">
                        검사단계 ({model.inspection_steps.length}개)
                      </h4>
                    </div>

                    <div className="space-y-2">
                      {model.inspection_steps.length > 0 ? (
                        model.inspection_steps
                          .sort((a, b) => a.step_order - b.step_order)
                          .map((step, index) => (
                            <div
                              key={step.id}
                              className={`p-3 rounded-lg border-l-4 ${
                                index % 3 === 0
                                  ? "bg-blue-50 border-blue-500"
                                  : index % 3 === 1
                                  ? "bg-green-50 border-green-500"
                                  : "bg-purple-50 border-purple-500"
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span
                                  className={`font-medium text-sm ${
                                    index % 3 === 0
                                      ? "text-blue-700"
                                      : index % 3 === 1
                                      ? "text-green-700"
                                      : "text-purple-700"
                                  }`}
                                >
                                  {step.step_order}. {step.step_name}
                                </span>
                                <span
                                  className={`font-mono text-sm ${
                                    index % 3 === 0
                                      ? "text-blue-600"
                                      : index % 3 === 1
                                      ? "text-green-600"
                                      : "text-purple-600"
                                  }`}
                                >
                                  {step.lower_limit} - {step.upper_limit}
                                </span>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="p-3 rounded-lg border border-dashed text-center text-muted-foreground">
                          검사단계가 없습니다
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 생성일 */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    생성일:{" "}
                    {new Date(model.created_at).toLocaleDateString("ko-KR")}
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
                <h3 className="text-lg font-semibold mb-2">
                  등록된 검사 모델이 없습니다
                </h3>
                <p className="text-muted-foreground mb-4">
                  첫 번째 검사 모델을 추가해보세요
                </p>
                <Button onClick={startCreating} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />첫 번째 모델 추가
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

            <form
              onSubmit={editingModel ? handleUpdateModel : handleCreateModel}
            >
              <div className="space-y-6 py-4">
                {/* 기본 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="model_name">모델명 *</Label>
                    <Input
                      id="model_name"
                      value={formData.model_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          model_name: e.target.value,
                        }))
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

                {/* 검사단계 관리 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      검사단계 관리
                    </h3>
                    <Button
                      type="button"
                      onClick={addInspectionStep}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      검사단계 추가
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {formData.inspection_steps.length === 0 ? (
                      <div className="p-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">
                          검사단계가 없습니다
                        </p>
                        <p className="text-sm">
                          위의 &quot;검사단계 추가&quot; 버튼을 클릭하여 첫 번째
                          검사단계를 추가하세요.
                        </p>
                      </div>
                    ) : (
                      formData.inspection_steps.map((step, index) => (
                        <div
                          key={index}
                          className={`border rounded-lg p-4 space-y-3 ${
                            index % 3 === 0
                              ? "bg-blue-50 border-blue-200"
                              : index % 3 === 1
                              ? "bg-green-50 border-green-200"
                              : "bg-purple-50 border-purple-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h4
                              className={`font-medium ${
                                index % 3 === 0
                                  ? "text-blue-700"
                                  : index % 3 === 1
                                  ? "text-green-700"
                                  : "text-purple-700"
                              }`}
                            >
                              {step.step_order}. 검사단계
                            </h4>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => moveInspectionStep(index, "up")}
                                disabled={index === 0}
                                className="h-6 w-6"
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  moveInspectionStep(index, "down")
                                }
                                disabled={
                                  index === formData.inspection_steps.length - 1
                                }
                                className="h-6 w-6"
                              >
                                ↓
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeInspectionStep(index)}
                                className="h-6 w-6 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label className="text-sm">검사항목명 *</Label>
                              <Input
                                value={step.step_name}
                                onChange={(e) =>
                                  updateInspectionStep(
                                    index,
                                    "step_name",
                                    e.target.value
                                  )
                                }
                                placeholder="예: 절연저항 측정"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">하한값 *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={step.lower_limit}
                                onChange={(e) =>
                                  updateInspectionStep(
                                    index,
                                    "lower_limit",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">상한값 *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={step.upper_limit}
                                onChange={(e) =>
                                  updateInspectionStep(
                                    index,
                                    "upper_limit",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                required
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
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
                    ? editingModel
                      ? "수정 중..."
                      : "추가 중..."
                    : editingModel
                    ? "수정 완료"
                    : "추가 완료"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
