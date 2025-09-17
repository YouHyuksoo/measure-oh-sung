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

interface PollingSettings {
  id: number;
  model_id: number;
  polling_interval: number; // 폴링 간격 (초)
  polling_duration: number; // 폴링 지속 시간 (초)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface InspectionModel {
  id: number;
  model_name: string;
  description?: string;
  is_active: boolean;
}

export default function PollingSettingsPage() {
  const [pollingSettings, setPollingSettings] = useState<PollingSettings[]>([]);
  const [inspectionModels, setInspectionModels] = useState<InspectionModel[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 폼 데이터
  const [formData, setFormData] = useState({
    model_id: 0,
    polling_interval: 0.5,
    polling_duration: 30.0,
    is_active: true,
  });

  // 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [settingsResponse, modelsResponse] = await Promise.all([
        apiClient.getPollingSettings(),
        apiClient.getInspectionModelsAll(),
      ]);

      setPollingSettings(
        Array.isArray(settingsResponse) ? settingsResponse : []
      );
      setInspectionModels(Array.isArray(modelsResponse) ? modelsResponse : []);
    } catch (err) {
      setError(`데이터 로드 실패: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 폼 리셋
  const resetForm = () => {
    setFormData({
      model_id: 0,
      polling_interval: 0.5,
      polling_duration: 30.0,
      is_active: true,
    });
    setEditingId(null);
    setShowCreateForm(false);
  };

  // 생성/수정 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (editingId) {
        // 수정
        await apiClient.updatePollingSettings(editingId, formData);
      } else {
        // 생성
        await apiClient.createPollingSettings(formData);
      }

      await loadData();
      resetForm();
    } catch (err) {
      setError(`저장 실패: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 편집 시작
  const startEditing = (settings: PollingSettings) => {
    setFormData({
      model_id: settings.model_id,
      polling_interval: settings.polling_interval,
      polling_duration: settings.polling_duration,
      is_active: settings.is_active,
    });
    setEditingId(settings.id);
    setShowCreateForm(true);
  };

  // 삭제
  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    setIsLoading(true);
    try {
      await apiClient.deletePollingSettings(id);
      await loadData();
    } catch (err) {
      setError(`삭제 실패: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 모델명 가져오기
  const getModelName = (modelId: number) => {
    const model = inspectionModels.find((m) => m.id === modelId);
    return model ? model.model_name : `모델 ID: ${modelId}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">폴링 설정 관리</h1>
          <p className="text-muted-foreground">
            모델별 폴링 간격과 지속 시간을 설정합니다
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />새 설정 추가
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 생성/수정 폼 */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {editingId ? "폴링 설정 수정" : "새 폴링 설정"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="model_id">검사 모델</Label>
                  <Select
                    value={formData.model_id.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, model_id: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="모델 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {inspectionModels.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                          {model.model_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="is_active">활성 상태</Label>
                  <Select
                    value={formData.is_active.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, is_active: value === "true" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">활성</SelectItem>
                      <SelectItem value="false">비활성</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="polling_interval">폴링 간격 (초)</Label>
                  <Input
                    id="polling_interval"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10.0"
                    value={formData.polling_interval}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        polling_interval: parseFloat(e.target.value),
                      })
                    }
                    placeholder="0.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    WT310에 측정 명령을 보내는 간격 (0.1~10.0초)
                  </p>
                </div>

                <div>
                  <Label htmlFor="polling_duration">폴링 지속 시간 (초)</Label>
                  <Input
                    id="polling_duration"
                    type="number"
                    step="1"
                    min="1"
                    max="3600"
                    value={formData.polling_duration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        polling_duration: parseFloat(e.target.value),
                      })
                    }
                    placeholder="30"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    폴링을 지속할 시간 (1~3600초)
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingId ? "수정" : "생성"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 설정 목록 */}
      <div className="grid gap-4">
        {pollingSettings.map((settings) => (
          <Card key={settings.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      {getModelName(settings.model_id)}
                    </h3>
                    <Badge
                      variant={settings.is_active ? "default" : "secondary"}
                    >
                      {settings.is_active ? "활성" : "비활성"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span>폴링 간격: {settings.polling_interval}초</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-green-500" />
                      <span>지속 시간: {settings.polling_duration}초</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    생성:{" "}
                    {new Date(settings.created_at).toLocaleString("ko-KR")}
                    {settings.updated_at !== settings.created_at && (
                      <span>
                        {" | "}수정:{" "}
                        {new Date(settings.updated_at).toLocaleString("ko-KR")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditing(settings)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(settings.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pollingSettings.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">폴링 설정이 없습니다</h3>
            <p className="text-muted-foreground mb-4">
              새 폴링 설정을 추가하여 모델별 측정 조건을 설정하세요
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />첫 번째 설정 추가
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>로딩 중...</span>
        </div>
      )}
    </div>
  );
}
