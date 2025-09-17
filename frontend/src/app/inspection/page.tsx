"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  useInspectionStore,
  type InspectionModel,
  type InspectionStep,
} from "@/stores/useInspectionStore";
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
  Activity,
  AlertCircle,
  CheckCircle2,
  Power,
  Target,
} from "lucide-react";
import { PhaseChart } from "@/components/charts/PhaseChart";
import { apiClient } from "@/lib/api";

interface MessageLog {
  timestamp: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  message: string;
}

type BadgeVariant = "secondary" | "default" | "destructive" | "outline";

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = () => {
    switch (status) {
      case "connecting":
        return {
          variant: "secondary" as BadgeVariant,
          icon: <Activity className="h-3 w-3 mr-1 animate-spin" />,
          label: "연결 중",
          className: "bg-blue-500",
        };
      case "connected":
        return {
          variant: "default" as BadgeVariant,
          icon: <Power className="h-3 w-3 mr-1" />,
          label: "연결됨",
          className: "bg-green-500",
        };
      case "error":
        return {
          variant: "destructive" as BadgeVariant,
          icon: <AlertCircle className="h-3 w-3 mr-1" />,
          label: "오류",
        };
      default:
        return {
          variant: "destructive" as BadgeVariant,
          icon: <AlertCircle className="h-3 w-3 mr-1" />,
          label: "미연결",
        };
    }
  };

  const config = getStatusConfig();
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.icon}
      {config.label}
    </Badge>
  );
};

export default function InspectionPage() {
  // 검사단계별 데이터를 동적으로 관리
  const measurementHistory = useInspectionStore(
    (state) => state.measurementHistory
  );

  // 기타 필요한 상태들
  const store = useInspectionStore();
  const [isMounted, setIsMounted] = useState(false);
  const [logs, setLogs] = useState<MessageLog[]>([]);

  useEffect(() => {
    setIsMounted(true);
    store.initialize();

    const handleBeforeUnload = () => {
      store.disconnectAll();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedModelId = useMemo(
    () => store.selectedModelId,
    [store.selectedModelId]
  );
  const selectedModel = useMemo(
    () => store.inspectionModels.find((m) => m.id === selectedModelId),
    [store.inspectionModels, selectedModelId]
  );

  // 선택된 모델의 검사단계별 차트 데이터 생성
  const stepChartData = useMemo(() => {
    if (!selectedModel || !selectedModel.inspection_steps) return {};

    const data: Record<number, any[]> = {};

    selectedModel.inspection_steps.forEach((step) => {
      data[step.id] = measurementHistory
        .filter((m) => m.step_id === step.id)
        .map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp).toISOString(),
          time: new Date(m.timestamp).toLocaleTimeString("ko-KR"),
        }));
    });

    return data;
  }, [selectedModel, measurementHistory]);

  const addLog = useCallback((type: MessageLog["type"], message: string) => {
    const newLog: MessageLog = {
      timestamp: new Date().toLocaleTimeString("ko-KR"),
      type,
      message,
    };
    setLogs((prev) => [...prev.slice(-19), newLog]); // 최대 20개까지만 유지
  }, []);

  useEffect(() => {
    if (store.inspectionStatus === "running" && store.currentPhase) {
      addLog("INFO", `${store.currentPhase} 단계 측정 중...`);
    }
  }, [store.inspectionStatus, store.currentPhase, addLog]);

  // 검사단계별 최신 데이터를 로그에 추가
  useEffect(() => {
    if (selectedModel && selectedModel.inspection_steps) {
      selectedModel.inspection_steps.forEach((step) => {
        const stepData = stepChartData[step.id];
        if (stepData && stepData.length > 0) {
          const latest = stepData[stepData.length - 1];
          if (latest) {
            addLog(
              latest.result === "PASS" ? "SUCCESS" : "WARNING",
              `${step.step_name}: ${latest.value} (${latest.result})`
            );
          }
        }
      });
    }
  }, [stepChartData, selectedModel, addLog]);

  const handleStartInspection = useCallback(async () => {
    const barcode = store.currentBarcode || `TEST_${Date.now()}`;
    try {
      await apiClient.startContinuousInspection({
        barcode,
        inspection_model_id: selectedModelId!,
      });
      addLog("INFO", `연속 검사 시작: ${barcode}`);
    } catch (error) {
      addLog("ERROR", `검사 시작 실패: ${error}`);
    }
  }, [selectedModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        로딩 중...
      </div>
    );
  }

  const StatusBox = () => {
    const statusConfig = {
      running: {
        bg: "bg-blue-50 border-blue-200",
        icon: <Activity className="h-5 w-5 text-blue-600 animate-pulse" />,
        text: "검사 진행 중",
        textColor: "text-blue-800",
      },
      completed: {
        bg: "bg-green-50 border-green-200",
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
        text: "검사 완료",
        textColor: "text-green-800",
      },
      error: {
        bg: "bg-red-50 border-red-200",
        icon: <AlertCircle className="h-5 w-5 text-red-600" />,
        text: "검사 오류",
        textColor: "text-red-800",
      },
      idle: {
        bg: "bg-gray-50 border-gray-200",
        icon: <Target className="h-5 w-5 text-gray-600" />,
        text: "검사 대기 중",
        textColor: "text-gray-800",
      },
    };

    const config = statusConfig[store.inspectionStatus] || statusConfig.idle;

    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 ${config.bg} border-2 rounded-lg`}
      >
        <div className="flex items-center gap-2">
          {config.icon}
          <span className={`font-semibold ${config.textColor}`}>
            {config.text}
          </span>
        </div>
        {store.currentPhase && (
          <Badge
            variant="outline"
            className="bg-blue-100 text-blue-800 border-blue-300"
          >
            현재: {store.currentPhase}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">검사 실행</h1>
        <StatusBox />
      </div>
      {store.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{store.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Control Panel - 왼쪽 세로 전체 */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>검사 제어</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Power Meter Status */}
              <div>
                <Label>전력측정설비</Label>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                  <div className="flex flex-col">
                    <StatusBadge status={store.powerMeterStatus} />
                    {store.connectedPowerMeter && (
                      <div className="text-xs text-gray-600 mt-1">
                        <div>포트: {store.connectedPowerMeter.port}</div>
                        <div>
                          보드레이트:{" "}
                          {store.connectedPowerMeter.baud_rate || "N/A"}
                        </div>
                      </div>
                    )}
                  </div>
                  {store.powerMeterStatus !== "connected" && (
                    <Button
                      onClick={store.connectPowerMeter}
                      size="sm"
                      variant="outline"
                      disabled={store.powerMeterStatus === "connecting"}
                    >
                      연결
                    </Button>
                  )}
                </div>
                {store.powerMeterError && (
                  <p className="text-xs text-red-500 mt-1">
                    {store.powerMeterError}
                  </p>
                )}
              </div>

              {/* Barcode Scanner Status */}
              <div>
                <Label>바코드 스캐너</Label>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                  <div className="flex flex-col">
                    <StatusBadge
                      status={
                        store.isBarcodeScannerListening
                          ? "connected"
                          : store.barcodeScannerStatus
                      }
                    />
                    {store.connectedBarcodeScanner && (
                      <div className="text-xs text-gray-600 mt-1">
                        <div>포트: {store.connectedBarcodeScanner.port}</div>
                        <div>
                          보드레이트:{" "}
                          {store.connectedBarcodeScanner.baud_rate || "N/A"}
                        </div>
                      </div>
                    )}
                  </div>
                  {store.barcodeScannerStatus !== "connected" && (
                    <Button
                      onClick={store.connectBarcodeScanner}
                      size="sm"
                      variant="outline"
                      disabled={store.barcodeScannerStatus === "connecting"}
                    >
                      연결
                    </Button>
                  )}
                </div>
                {store.barcodeScannerError && (
                  <p className="text-xs text-red-500 mt-1">
                    {store.barcodeScannerError}
                  </p>
                )}
              </div>

              {/* Real-time Connection Status */}
              <div>
                <Label>실시간 연결 상태</Label>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                  <div className="flex flex-col">
                    <StatusBadge status={store.sseStatus} />
                    <div className="text-xs text-gray-600 mt-1">
                      {store.sseStatus === "connected"
                        ? "실시간 연결됨"
                        : "연결 안됨"}
                    </div>
                  </div>
                  {store.sseStatus !== "connected" && (
                    <Button
                      onClick={() => {
                        console.log("🔄 [UI] SSE 재연결 시도");
                        store._connectSse();
                      }}
                      size="sm"
                      variant="outline"
                    >
                      재연결
                    </Button>
                  )}
                </div>
              </div>

              {/* Inspection Model Select */}
              <div>
                <Label>검사 모델</Label>
                <Select
                  value={selectedModelId?.toString() || ""}
                  onValueChange={(value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue)) {
                      store.setSelectedModelId(numValue);
                    }
                  }}
                  disabled={
                    store.isLoading || store.inspectionStatus === "running"
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="모델 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {store.inspectionModels.length > 0 ? (
                      store.inspectionModels.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                          {model.model_name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-models" disabled>
                        검사 모델이 없습니다
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Barcode Input */}
              <div>
                <Label>바코드</Label>
                <div className="flex gap-2">
                  <Input
                    value={store.currentBarcode || ""}
                    onChange={(e) => store.setBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        store.currentBarcode &&
                        selectedModelId &&
                        store.powerMeterStatus === "connected"
                      ) {
                        handleStartInspection();
                      }
                    }}
                    placeholder={
                      store.isBarcodeScannerListening
                        ? "바코드 스캔 대기 중..."
                        : "바코드 스캔 또는 입력"
                    }
                    disabled={store.inspectionStatus === "running"}
                    className={
                      store.isBarcodeScannerListening
                        ? "border-green-500 bg-green-50"
                        : ""
                    }
                  />
                  <Button
                    onClick={handleStartInspection}
                    size="icon"
                    disabled={store.inspectionStatus === "running"}
                  >
                    <Scan className="h-4 w-4" />
                  </Button>
                </div>
                {/* 바코드 스캔 상태 표시 */}
                {store.isBarcodeScannerListening && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
                    <Activity className="h-3 w-3 animate-pulse" />
                    <span>바코드 스캐너 대기 중...</span>
                  </div>
                )}
              </div>

              {/* Control Buttons */}
              <div className="flex gap-2">
                {store.inspectionStatus !== "running" ? (
                  <Button
                    onClick={handleStartInspection}
                    disabled={
                      !selectedModelId || store.powerMeterStatus !== "connected"
                    }
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    검사 시작
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      try {
                        await apiClient.stopContinuousInspection();
                        addLog("INFO", "연속 검사 중지");
                      } catch (error) {
                        addLog("ERROR", `검사 중지 실패: ${error}`);
                      }
                    }}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    검사 중지
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽 영역 - 검사단계 테이블과 차트 */}
        <div className="lg:col-span-3 space-y-6">
          {/* 검사단계 테이블 */}
          <Card>
            <CardContent className="p-0">
              {selectedModel &&
              selectedModel.inspection_steps &&
              selectedModel.inspection_steps.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 font-semibold text-gray-700 text-xs">
                          순서
                        </th>
                        <th className="text-left p-2 font-semibold text-gray-700 text-xs">
                          검사항목
                        </th>
                        <th className="text-center p-2 font-semibold text-gray-700 text-xs">
                          하한값
                        </th>
                        <th className="text-center p-2 font-semibold text-gray-700 text-xs">
                          상한값
                        </th>
                        <th className="text-center p-2 font-semibold text-gray-700 text-xs">
                          측정값
                        </th>
                        <th className="text-center p-2 font-semibold text-gray-700 text-xs">
                          합불
                        </th>
                        <th className="text-center p-2 font-semibold text-gray-700 text-xs">
                          상태
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedModel.inspection_steps
                        .sort((a, b) => a.step_order - b.step_order)
                        .map((step, index) => {
                          // 현재 측정값 가져오기
                          const stepData = stepChartData[step.id] || [];
                          const latestMeasurement =
                            stepData[stepData.length - 1];
                          const currentValue = latestMeasurement
                            ? latestMeasurement.value
                            : 0;
                          const isPass =
                            currentValue >= step.lower_limit &&
                            currentValue <= step.upper_limit;
                          const isActive =
                            store.currentPhase === step.step_name;

                          return (
                            <tr
                              key={step.id}
                              className={`border-b hover:bg-gray-50 transition-colors ${
                                isActive ? "bg-blue-50 border-blue-200" : ""
                              }`}
                            >
                              <td className="p-2 font-medium text-gray-900 text-xs">
                                {step.step_order}
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-gray-900 text-xs">
                                    {step.step_name}
                                  </span>
                                  {isActive && (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-100 text-blue-800 border-blue-300 text-xs px-1 py-0"
                                    >
                                      진행중
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 text-center font-mono text-gray-600 text-xs">
                                {step.lower_limit}
                              </td>
                              <td className="p-2 text-center font-mono text-gray-600 text-xs">
                                {step.upper_limit}
                              </td>
                              <td className="p-2 text-center">
                                <span
                                  className={`font-mono font-semibold text-xs ${
                                    isPass ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {currentValue.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-2 text-center">
                                <Badge
                                  variant={isPass ? "default" : "destructive"}
                                  className={`text-xs px-1 py-0 ${
                                    isPass
                                      ? "bg-green-500 hover:bg-green-600"
                                      : "bg-red-500 hover:bg-red-600"
                                  }`}
                                >
                                  {isPass ? "합격" : "불합격"}
                                </Badge>
                              </td>
                              <td className="p-2 text-center">
                                {isActive ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-blue-600">
                                      측정중
                                    </span>
                                  </div>
                                ) : stepData.length > 0 ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                    <span className="text-xs text-gray-600">
                                      완료
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                                    <span className="text-xs text-gray-500">
                                      대기
                                    </span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium mb-1">
                    검사단계가 없습니다
                  </p>
                  <p className="text-xs">
                    검사 모델을 선택하거나 검사단계를 설정해주세요
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 차트 */}
          <Card>
            <CardContent className="p-0">
              {selectedModel && selectedModel.inspection_steps ? (
                <PhaseChart
                  data={measurementHistory.map((m) => ({
                    timestamp: m.timestamp,
                    time: new Date(m.timestamp).toLocaleTimeString("ko-KR"),
                    value: m.value,
                    barcode: m.barcode,
                    result: m.result,
                  }))}
                  phase="연속 측정"
                  title="실시간 측정 그래프"
                  limits={undefined} // 연속 데이터이므로 단일 limits 없음
                  isActive={store.inspectionStatus === "running"}
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    측정 데이터 대기 중
                  </p>
                  <p className="text-sm">
                    검사 모델을 선택하고 검사를 시작해주세요
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 실시간 로그 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                실시간 로그
                <Badge variant="outline">{logs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto bg-gray-900 text-green-400 p-3 rounded-md font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  로그 대기 중...
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-gray-400 shrink-0">
                      [{log.timestamp}]
                    </span>
                    <span
                      className={`${
                        log.type === "SUCCESS"
                          ? "text-green-400"
                          : log.type === "WARNING"
                          ? "text-yellow-400"
                          : log.type === "ERROR"
                          ? "text-red-400"
                          : "text-blue-400"
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
