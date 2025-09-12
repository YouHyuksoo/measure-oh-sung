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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Square,
  Scan,
  Zap,
  Database,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useInspection } from "@/hooks/useInspection";
import { apiClient } from "@/lib/api";
import { RealTimeChart } from "@/components/charts/RealTimeChart";

interface InspectionModel {
  id: number;
  name: string;
  description: string;
  is_active?: boolean;
  limits?: {
    p1: { lower: number; upper: number };
    p2: { lower: number; upper: number };
    p3: { lower: number; upper: number };
  };
}

export default function InspectionPage() {
  const {
    status,
    currentMeasurement,
    measurementHistory,
    isLoading,
    error,
    wsConnected,
    startListening,
    processBarcodeScann,
    stopInspection,
    refreshStatus,
    clearError,
  } = useInspection();

  const [barcode, setBarcode] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [inspectionModels, setInspectionModels] = useState<InspectionModel[]>(
    []
  );
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // 차트 데이터
  const [chartData, setChartData] = useState<any[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // 검사 모델 목록 로드
  useEffect(() => {
    loadInspectionModels();
  }, []);

  // 측정 데이터를 차트 데이터로 변환
  useEffect(() => {
    if (measurementHistory.length > 0 && !isPaused) {
      const newChartData = measurementHistory.map((measurement) => ({
        timestamp: measurement.timestamp,
        time: new Date(measurement.timestamp).toLocaleTimeString("ko-KR"),
        [measurement.phase.toLowerCase()]: measurement.value,
        barcode: measurement.barcode,
      }));

      setChartData(newChartData);
    }
  }, [measurementHistory, isPaused]);

  const loadInspectionModels = async () => {
    try {
      setIsLoadingModels(true);
      const response = (await apiClient.getInspectionModels()) as
        | { models?: InspectionModel[] }
        | InspectionModel[];

      // API 응답에서 models 배열 추출
      const models = Array.isArray(response) ? response : response.models || [];
      setInspectionModels(models as InspectionModel[]);

      // 첫 번째 모델을 자동 선택
      if (models && models.length > 0) {
        setSelectedModelId(models[0].id);
      }
    } catch (err) {
      console.error("검사 모델 로드 오류:", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleStartListening = async () => {
    await startListening();
  };

  const handleStopInspection = async () => {
    await stopInspection();
    setBarcode("");
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!barcode.trim()) {
      return;
    }

    if (!selectedModelId) {
      alert("검사 모델을 선택해주세요");
      return;
    }

    await processBarcodeScann(barcode.trim(), selectedModelId);
    setBarcode("");
  };

  const getStatusBadge = () => {
    if (!wsConnected) {
      return <Badge variant="destructive">연결 끊김</Badge>;
    }

    if (status.is_listening) {
      return <Badge variant="success">검사 중</Badge>;
    }

    return <Badge variant="secondary">대기 중</Badge>;
  };

  const getProgressBar = () => {
    if (!status.progress) return null;

    return (
      <div className="w-full bg-secondary rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${status.progress}%` }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">검사 실행</h1>
        <p className="text-muted-foreground">
          바코드 스캔으로 실시간 측정을 수행합니다
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="ml-2"
            >
              닫기
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 검사 제어 패널 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                검사 제어
              </CardTitle>
              <CardDescription>검사 상태 및 제어 옵션</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 상태 표시 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">연결 상태</span>
                  {getStatusBadge()}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">연결된 장비</span>
                  <span className="text-sm">
                    {status.connected_devices} / {status.total_devices}
                  </span>
                </div>

                {status.current_barcode && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">현재 바코드</span>
                    <Badge variant="outline">{status.current_barcode}</Badge>
                  </div>
                )}

                {status.phase && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">측정 단계</span>
                    <Badge variant="secondary">{status.phase}</Badge>
                  </div>
                )}
              </div>

              {getProgressBar()}

              {/* 검사 모델 선택 */}
              <div className="space-y-2">
                <Label htmlFor="inspection-model">검사 모델</Label>
                <Select
                  value={selectedModelId?.toString() || ""}
                  onValueChange={(value: string) =>
                    setSelectedModelId(parseInt(value))
                  }
                  disabled={isLoadingModels || status.is_listening}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="검사 모델 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {inspectionModels.map((model) => (
                      <SelectItem key={model.id} value={model.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          {model.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 바코드 입력 */}
              <form onSubmit={handleBarcodeSubmit} className="space-y-2">
                <Label htmlFor="barcode">바코드</Label>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="바코드를 입력하세요"
                    disabled={!status.is_listening || isLoading}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={
                      !status.is_listening || !barcode.trim() || isLoading
                    }
                  >
                    <Scan className="h-4 w-4" />
                  </Button>
                </div>
              </form>

              {/* 제어 버튼 */}
              <div className="flex gap-2">
                {!status.is_listening ? (
                  <Button
                    onClick={handleStartListening}
                    disabled={isLoading || !selectedModelId}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    검사 시작
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopInspection}
                    variant="destructive"
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    검사 중지
                  </Button>
                )}

                <Button
                  onClick={refreshStatus}
                  variant="outline"
                  size="icon"
                  disabled={isLoading}
                >
                  <Activity className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 실시간 측정 결과 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 실시간 차트 */}
          <RealTimeChart
            data={chartData}
            title="실시간 측정 추이"
            description="P1, P2, P3 단계별 측정값 변화"
            maxDataPoints={30}
            isRealTime={status.is_listening}
            onTogglePause={() => setIsPaused(!isPaused)}
            onClear={() => setChartData([])}
          />
          {/* 현재 측정값 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                실시간 측정값
              </CardTitle>
              <CardDescription>
                현재 진행 중인 측정의 실시간 데이터
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentMeasurement ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {currentMeasurement.value}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {currentMeasurement.unit}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">
                        {currentMeasurement.phase}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        측정 단계
                      </div>
                    </div>
                    <div className="text-center">
                      <Badge
                        variant={
                          currentMeasurement.result === "PASS"
                            ? "success"
                            : currentMeasurement.result === "FAIL"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {currentMeasurement.result}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">
                        결과
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-mono">
                        {new Date(
                          currentMeasurement.timestamp
                        ).toLocaleTimeString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        측정 시간
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  측정 대기 중
                </div>
              )}
            </CardContent>
          </Card>

          {/* 측정 이력 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                측정 이력
              </CardTitle>
              <CardDescription>
                현재 세션의 측정 기록 ({measurementHistory.length}건)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {measurementHistory.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {measurementHistory
                    .slice()
                    .reverse()
                    .map((measurement, index) => (
                      <div
                        key={measurement.measurement_id || index}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{measurement.barcode}</Badge>
                          <span className="text-sm font-medium">
                            {measurement.phase}
                          </span>
                          <span className="text-sm">
                            {measurement.value} {measurement.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              measurement.result === "PASS"
                                ? "success"
                                : measurement.result === "FAIL"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {measurement.result === "PASS" && (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            {measurement.result === "FAIL" && (
                              <AlertCircle className="h-3 w-3 mr-1" />
                            )}
                            {measurement.result}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(
                              measurement.timestamp
                            ).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  측정 이력이 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
