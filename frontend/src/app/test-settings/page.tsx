"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Activity,
} from "lucide-react";
import { apiClient } from "@/lib/api";

// Interfaces remain the same
interface TestSettings {
  id: number;
  name: string;
  description?: string;
  p1_measure_duration: number;
  wait_duration_1_to_2: number;
  p2_measure_duration: number;
  wait_duration_2_to_3: number;
  p3_measure_duration: number;
  measurement_method: "polling" | "synchronized"; // 폴링 vs 동기화
  data_collection_interval: number; // 데이터 수집 간격 (초)
  is_active: boolean;
  inspection_model_id?: number;
  created_at: string;
  updated_at: string;
}

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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateTestSettings {
  name: string;
  description?: string;
  p1_measure_duration: number;
  wait_duration_1_to_2: number;
  p2_measure_duration: number;
  wait_duration_2_to_3: number;
  p3_measure_duration: number;
  measurement_method: "polling" | "synchronized";
  data_collection_interval: number;
  is_active: boolean;
  inspection_model_id?: number;
}

export default function TestSettingsPage() {
  const [testSettings, setTestSettings] = useState<TestSettings[]>([]);
  const [inspectionModels, setInspectionModels] = useState<InspectionModel[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSettings, setEditingSettings] = useState<TestSettings | null>(
    null
  );
  const [filterByModel, setFilterByModel] = useState<number | null>(null);

  const [formData, setFormData] = useState<CreateTestSettings>({
    name: "",
    description: "",
    p1_measure_duration: 5.0,
    wait_duration_1_to_2: 2.0,
    p2_measure_duration: 5.0,
    wait_duration_2_to_3: 2.0,
    p3_measure_duration: 5.0,
    measurement_method: "polling",
    data_collection_interval: 0.25,
    is_active: false,
    inspection_model_id: undefined,
  });

  const fetchInspectionModels = useCallback(async () => {
    try {
      const response =
        (await apiClient.getInspectionModelsAll()) as InspectionModel[];
      setInspectionModels(response);
    } catch (err) {
      console.error("검사 모델 조회 실패:", err);
    }
  }, [setInspectionModels]);

  const fetchTestSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let response = (await apiClient.getTestSettings()) as TestSettings[];
      if (filterByModel === -1) {
        response = response.filter((s) => !s.inspection_model_id);
      } else if (filterByModel && filterByModel > 0) {
        response = response.filter(
          (s) => s.inspection_model_id === filterByModel
        );
      }
      setTestSettings(response);
    } catch (err) {
      setError("테스트 설정을 불러오는데 실패했습니다.");
      console.error("테스트 설정 조회 실패:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filterByModel, setIsLoading, setError, setTestSettings]);

  useEffect(() => {
    fetchInspectionModels();
    fetchTestSettings();
  }, [filterByModel, fetchTestSettings, fetchInspectionModels]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      p1_measure_duration: 5.0,
      wait_duration_1_to_2: 2.0,
      p2_measure_duration: 5.0,
      wait_duration_2_to_3: 2.0,
      p3_measure_duration: 5.0,
      measurement_method: "polling",
      data_collection_interval: 0.25,
      is_active: false,
      inspection_model_id: undefined,
    });
  };

  const createTestSettings = async () => {
    try {
      await apiClient.createTestSettings(formData);
      await fetchTestSettings();
      setShowAddForm(false);
      resetForm();
    } catch (err) {
      setError("테스트 설정 생성에 실패했습니다.");
    }
  };

  const updateTestSettings = async () => {
    if (!editingSettings) return;
    try {
      await apiClient.updateTestSettings(editingSettings.id, formData);
      await fetchTestSettings();
      setEditingSettings(null);
      resetForm();
    } catch (err) {
      setError("테스트 설정 수정에 실패했습니다.");
    }
  };

  const deleteTestSettings = async (id: number) => {
    if (!confirm("정말로 이 테스트 설정을 삭제하시겠습니까?")) return;
    try {
      await apiClient.deleteTestSettings(id);
      await fetchTestSettings();
    } catch (err) {
      setError("테스트 설정 삭제에 실패했습니다.");
    }
  };

  const activateTestSettings = async (id: number) => {
    try {
      await apiClient.activateTestSettings(id);
      await fetchTestSettings();
    } catch (err) {
      setError("테스트 설정 활성화에 실패했습니다.");
    }
  };

  const startEdit = (settings: TestSettings) => {
    setEditingSettings(settings);
    setFormData({
      name: settings.name,
      description: settings.description || "",
      p1_measure_duration: settings.p1_measure_duration,
      wait_duration_1_to_2: settings.wait_duration_1_to_2,
      p2_measure_duration: settings.p2_measure_duration,
      wait_duration_2_to_3: settings.wait_duration_2_to_3,
      p3_measure_duration: settings.p3_measure_duration,
      measurement_method: settings.measurement_method || "polling",
      data_collection_interval: settings.data_collection_interval || 0.25,
      is_active: settings.is_active,
      inspection_model_id: settings.inspection_model_id,
    });
  };

  const cancelEdit = () => {
    setEditingSettings(null);
    resetForm();
  };

  const calculateTotalDuration = (settings: CreateTestSettings) => {
    return (
      settings.p1_measure_duration +
      settings.wait_duration_1_to_2 +
      settings.p2_measure_duration +
      settings.wait_duration_2_to_3 +
      settings.p3_measure_duration
    );
  };

  // The rest of the component is JSX and should be fine.
  // I will copy the JSX from the original file.
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            테스트 설정 관리
          </h1>
          <p className="text-muted-foreground">
            SCPI 명령 실행 관련 기술적 설정을 관리합니다
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />새 테스트 설정 추가
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
                value={
                  filterByModel === -1
                    ? "global"
                    : filterByModel?.toString() || "all"
                }
                onValueChange={(value) => {
                  if (value === "all") {
                    setFilterByModel(null);
                  } else if (value === "global") {
                    setFilterByModel(-1);
                  } else {
                    setFilterByModel(parseInt(value));
                  }
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 설정</SelectItem>
                  <SelectItem value="global">전역 설정만</SelectItem>
                  {inspectionModels.map((model) => (
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
              {editingSettings ? "테스트 설정 수정" : "새 테스트 설정 추가"}
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
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="예: 고정밀 측정 설정"
                  />
                </div>
                <div>
                  <Label htmlFor="description">설명</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="설정에 대한 설명"
                  />
                </div>
                <div>
                  <Label>검사 모델 연결</Label>
                  <Select
                    value={formData.inspection_model_id?.toString() || "global"}
                    onValueChange={(value) => {
                      const modelId =
                        value === "global" ? undefined : parseInt(value);
                      setFormData({
                        ...formData,
                        inspection_model_id: modelId,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">전역 설정</SelectItem>
                      {inspectionModels.map((model) => (
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
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        p1_measure_duration: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="wait_duration_1_to_2">
                    P1-P2 대기 시간 (초)
                  </Label>
                  <Input
                    id="wait_duration_1_to_2"
                    type="number"
                    step="0.1"
                    value={formData.wait_duration_1_to_2}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wait_duration_1_to_2: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="p2_measure_duration">P2 측정 시간 (초)</Label>
                  <Input
                    id="p2_measure_duration"
                    type="number"
                    step="0.1"
                    value={formData.p2_measure_duration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        p2_measure_duration: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="wait_duration_2_to_3">
                    P2-P3 대기 시간 (초)
                  </Label>
                  <Input
                    id="wait_duration_2_to_3"
                    type="number"
                    step="0.1"
                    value={formData.wait_duration_2_to_3}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wait_duration_2_to_3: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="p3_measure_duration">P3 측정 시간 (초)</Label>
                  <Input
                    id="p3_measure_duration"
                    type="number"
                    step="0.1"
                    value={formData.p3_measure_duration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        p3_measure_duration: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* 측정 방식 설정 */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                측정 방식 설정
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="measurement_method">호출 방식</Label>
                  <Select
                    value={formData.measurement_method}
                    onValueChange={(value: "polling" | "synchronized") =>
                      setFormData({ ...formData, measurement_method: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="polling">폴링 (Polling)</SelectItem>
                      <SelectItem value="synchronized">
                        동기화 (Synchronized)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500 mt-1">
                    {formData.measurement_method === "polling"
                      ? "일정 간격으로 데이터를 수집합니다"
                      : "장비의 갱신 신호를 기다려 최신 데이터를 수집합니다"}
                  </p>
                </div>
                <div>
                  <Label htmlFor="data_collection_interval">
                    데이터 수집 간격 (초)
                  </Label>
                  <Input
                    id="data_collection_interval"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="1.0"
                    value={formData.data_collection_interval}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        data_collection_interval: parseFloat(e.target.value),
                      })
                    }
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    폴링 방식에서 사용되는 수집 간격입니다
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <Clock className="inline h-4 w-4 mr-1" />총 테스트 시간:{" "}
                <strong>{calculateTotalDuration(formData).toFixed(1)}초</strong>
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={
                  editingSettings ? cancelEdit : () => setShowAddForm(false)
                }
              >
                취소
              </Button>
              <Button
                onClick={
                  editingSettings ? updateTestSettings : createTestSettings
                }
              >
                <Save className="h-4 w-4 mr-2" />
                {editingSettings ? "수정" : "생성"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            테스트 설정 목록
          </CardTitle>
          <CardDescription>현재 등록된 테스트 설정들입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">로딩 중...</div>
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
                            활성
                          </Badge>
                        )}
                        <Badge
                          variant={
                            settings.inspection_model_id
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {settings.inspection_model_id
                            ? `모델: ${
                                inspectionModels.find(
                                  (m) => m.id === settings.inspection_model_id
                                )?.model_name
                              }`
                            : "전역"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {settings.description}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">P1:</span>{" "}
                          {settings.p1_measure_duration}초
                        </div>
                        <div>
                          <span className="text-muted-foreground">대기:</span>{" "}
                          {settings.wait_duration_1_to_2}초
                        </div>
                        <div>
                          <span className="text-muted-foreground">P2:</span>{" "}
                          {settings.p2_measure_duration}초
                        </div>
                        <div>
                          <span className="text-muted-foreground">대기:</span>{" "}
                          {settings.wait_duration_2_to_3}초
                        </div>
                        <div>
                          <span className="text-muted-foreground">P3:</span>{" "}
                          {settings.p3_measure_duration}초
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 text-sm mt-2">
                        <div>
                          <span className="text-muted-foreground">
                            호출방식:
                          </span>
                          <Badge
                            variant={
                              settings.measurement_method === "polling"
                                ? "secondary"
                                : "default"
                            }
                            className="ml-1"
                          >
                            {settings.measurement_method === "polling"
                              ? "폴링"
                              : "동기화"}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            수집간격:
                          </span>{" "}
                          {settings.data_collection_interval}초
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!settings.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activateTestSettings(settings.id)}
                        >
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
                        className="text-red-600"
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
  );
}
