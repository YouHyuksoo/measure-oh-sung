"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useInspectionStore } from "@/stores/useInspectionStore";
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
  // 각 위상별 데이터를 독립적으로 구독
  const p1MeasurementHistory = useInspectionStore((state) => state.p1MeasurementHistory);
  const p2MeasurementHistory = useInspectionStore((state) => state.p2MeasurementHistory);
  const p3MeasurementHistory = useInspectionStore((state) => state.p3MeasurementHistory);

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

  // 각 위상별로 완전히 분리된 변환 함수와 데이터
  const p1ChartData = useMemo(() =>
    p1MeasurementHistory.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp).toISOString(),
      time: new Date(m.timestamp).toLocaleTimeString("ko-KR"),
    })),
    [p1MeasurementHistory]
  );

  const p2ChartData = useMemo(() =>
    p2MeasurementHistory.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp).toISOString(),
      time: new Date(m.timestamp).toLocaleTimeString("ko-KR"),
    })),
    [p2MeasurementHistory]
  );

  const p3ChartData = useMemo(() =>
    p3MeasurementHistory.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp).toISOString(),
      time: new Date(m.timestamp).toLocaleTimeString("ko-KR"),
    })),
    [p3MeasurementHistory]
  );

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

  // 각 위상별 최신 데이터를 로그에 추가 (독립적으로 감지)
  useEffect(() => {
    const latestP1 = p1MeasurementHistory[p1MeasurementHistory.length - 1];
    if (latestP1) {
      addLog(
        latestP1.result === "PASS" ? "SUCCESS" : "WARNING",
        `P1: ${latestP1.value} (${latestP1.result})`
      );
    }
  }, [p1MeasurementHistory, addLog]);

  useEffect(() => {
    const latestP2 = p2MeasurementHistory[p2MeasurementHistory.length - 1];
    if (latestP2) {
      addLog(
        latestP2.result === "PASS" ? "SUCCESS" : "WARNING",
        `P2: ${latestP2.value} (${latestP2.result})`
      );
    }
  }, [p2MeasurementHistory, addLog]);

  useEffect(() => {
    const latestP3 = p3MeasurementHistory[p3MeasurementHistory.length - 1];
    if (latestP3) {
      addLog(
        latestP3.result === "PASS" ? "SUCCESS" : "WARNING",
        `P3: ${latestP3.value} (${latestP3.result})`
      );
    }
  }, [p3MeasurementHistory, addLog]);

  const handleStartInspection = useCallback(() => {
    const barcode = store.currentBarcode || `TEST_${Date.now()}`;
    store.startSequentialInspection(barcode);
    addLog("INFO", `검사 시작: ${barcode}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedModelId = useMemo(() => store.selectedModelId, [store.selectedModelId]);
  const selectedModel = useMemo(() =>
    store.inspectionModels.find((m) => m.id === selectedModelId),
    [store.inspectionModels, selectedModelId]
  );

  // 각 위상별로 독립적인 한계값과 활성 상태
  const p1Limits = useMemo(() =>
    selectedModel ? {
      lower: selectedModel.p1_lower_limit,
      upper: selectedModel.p1_upper_limit,
    } : undefined,
    [selectedModel?.p1_lower_limit, selectedModel?.p1_upper_limit]
  );

  const p2Limits = useMemo(() =>
    selectedModel ? {
      lower: selectedModel.p2_lower_limit,
      upper: selectedModel.p2_upper_limit,
    } : undefined,
    [selectedModel?.p2_lower_limit, selectedModel?.p2_upper_limit]
  );

  const p3Limits = useMemo(() =>
    selectedModel ? {
      lower: selectedModel.p3_lower_limit,
      upper: selectedModel.p3_upper_limit,
    } : undefined,
    [selectedModel?.p3_lower_limit, selectedModel?.p3_upper_limit]
  );

  const isP1Active = useMemo(() => store.currentPhase === "P1", [store.currentPhase]);
  const isP2Active = useMemo(() => store.currentPhase === "P2", [store.currentPhase]);
  const isP3Active = useMemo(() => store.currentPhase === "P3", [store.currentPhase]);

  if (!isMounted) {
    return <div className="flex justify-center items-center min-h-screen">로딩 중...</div>;
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
      <div className={`flex items-center gap-3 px-4 py-3 ${config.bg} border-2 rounded-lg`}>
        <div className="flex items-center gap-2">
          {config.icon}
          <span className={`font-semibold ${config.textColor}`}>{config.text}</span>
        </div>
        {store.currentPhase && (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Control Panel */}
        <div className="lg:col-span-1">
          <Card>
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
                  disabled={store.isLoading || store.inspectionStatus === "running"}
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

              {/* Control Buttons */}
              <div className="flex gap-2">
                {store.inspectionStatus !== "running" ? (
                  <Button
                    onClick={handleStartInspection}
                    disabled={
                      !selectedModelId ||
                      store.powerMeterStatus !== "connected"
                    }
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    검사 시작
                  </Button>
                ) : (
                  <Button
                    onClick={store.stopInspection}
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

        {/* Real-time Data */}
        <div className="lg:col-span-4 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <PhaseChart
              data={p1ChartData}
              phase="P1"
              title="P1"
              limits={p1Limits}
              isActive={isP1Active}
            />
            <PhaseChart
              data={p2ChartData}
              phase="P2"
              title="P2"
              limits={p2Limits}
              isActive={isP2Active}
            />
            <PhaseChart
              data={p3ChartData}
              phase="P3"
              title="P3"
              limits={p3Limits}
              isActive={isP3Active}
            />
          </div>

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
                    <span className="text-gray-400 shrink-0">[{log.timestamp}]</span>
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
