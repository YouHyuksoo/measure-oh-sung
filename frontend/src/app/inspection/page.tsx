"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  Database,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Power,
} from "lucide-react";
import { PhaseChart } from "@/components/charts/PhaseChart";

type BadgeVariant =
  | "secondary"
  | "default"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

const statusStyles: {
  [key: string]: {
    variant: BadgeVariant;
    className?: string;
    icon: ReactNode;
    label: string;
  };
} = {
  connecting: {
    variant: "secondary",
    className: "bg-blue-500",
    icon: <Activity className="h-3 w-3 mr-1 animate-spin" />,
    label: "연결 중",
  },
  connected: {
    variant: "default",
    className: "bg-green-500",
    icon: <Power className="h-3 w-3 mr-1" />,
    label: "연결됨",
  },
  disconnected: {
    variant: "destructive",
    icon: <AlertCircle className="h-3 w-3 mr-1" />,
    label: "미연결",
  },
  error: {
    variant: "destructive",
    icon: <AlertCircle className="h-3 w-3 mr-1" />,
    label: "오류",
  },
};

// Helper component for status badges
const StatusBadge = ({ status }: { status: string }) => {
  const style = statusStyles[status] || {
    variant: "secondary" as BadgeVariant,
    label: status,
    icon: null,
  };

  return (
    <Badge variant={style.variant} className={style.className}>
      {style.icon}
      {style.label}
    </Badge>
  );
};

export default function InspectionPage() {
  // --- State from Store ---
  const store = useInspectionStore();
  const [isMounted, setIsMounted] = useState(false);

  // --- Effects ---
  useEffect(() => {
    setIsMounted(true);
    store.initialize();

    // 브라우저 탭을 닫을 때만 연결 해제
    const handleBeforeUnload = async () => {
      await store.disconnectAll();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // 페이지 이동 시에는 연결 유지 (beforeunload에서만 해제)
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 바코드 스캔은 useInspectionStore에서 처리됨

  // 장비 정보는 store에서 가져옴

  if (!isMounted) {
    return null; // or a loading spinner
  }

  // --- UI Event Handlers ---
  const handleStartInspection = () => {
    if (store.currentBarcode) {
      store.startSequentialInspection(store.currentBarcode);
    }
  };

  // --- Render ---

  // Chart data requires a 'time' property, so we map it here.
  const toChartData = (data: typeof store.measurementHistory): any[] => {
    return data.map((m) => ({
      ...m,
      time: new Date(m.timestamp).toLocaleTimeString("ko-KR"),
    }));
  };

  const p1Data = toChartData(
    store.measurementHistory.filter((m) => m.phase === "P1")
  );
  const p2Data = toChartData(
    store.measurementHistory.filter((m) => m.phase === "P2")
  );
  const p3Data = toChartData(
    store.measurementHistory.filter((m) => m.phase === "P3")
  );

  const selectedModel = store.inspectionModels.find(
    (m) => m.id === store.selectedModelId
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">검사 실행</h1>
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
                  value={store.selectedModelId?.toString() || ""}
                  onValueChange={(value) =>
                    store.setSelectedModelId(parseInt(value))
                  }
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
                    disabled={
                      !store.currentBarcode ||
                      store.inspectionStatus === "running"
                    }
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
                      !store.currentBarcode ||
                      !store.selectedModelId ||
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
              data={p1Data}
              phase="P1"
              title="P1"
              limits={
                selectedModel
                  ? {
                      lower: selectedModel.p1_lower_limit,
                      upper: selectedModel.p1_upper_limit,
                    }
                  : undefined
              }
              isActive={!!selectedModel && store.currentPhase === "P1"}
              isCompleted={
                !!selectedModel &&
                store.currentPhase !== "P1" &&
                store.inspectionStatus === "completed"
              }
              isPending={
                !!selectedModel &&
                !store.currentPhase &&
                store.inspectionStatus === "idle"
              }
            />
            <PhaseChart
              data={p2Data}
              phase="P2"
              title="P2"
              limits={
                selectedModel
                  ? {
                      lower: selectedModel.p2_lower_limit,
                      upper: selectedModel.p2_upper_limit,
                    }
                  : undefined
              }
              isActive={!!selectedModel && store.currentPhase === "P2"}
              isCompleted={
                !!selectedModel &&
                store.currentPhase !== "P2" &&
                store.inspectionStatus === "completed"
              }
              isPending={
                !!selectedModel &&
                !store.currentPhase &&
                store.inspectionStatus === "idle"
              }
            />
            <PhaseChart
              data={p3Data}
              phase="P3"
              title="P3"
              limits={
                selectedModel
                  ? {
                      lower: selectedModel.p3_lower_limit,
                      upper: selectedModel.p3_upper_limit,
                    }
                  : undefined
              }
              isActive={!!selectedModel && store.currentPhase === "P3"}
              isCompleted={
                !!selectedModel &&
                store.currentPhase !== "P3" &&
                store.inspectionStatus === "completed"
              }
              isPending={
                !!selectedModel &&
                !store.currentPhase &&
                store.inspectionStatus === "idle"
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>설비 통신 로그</CardTitle>
              <CardDescription>
                전력측정 설비와 주고받은 메시지 ({store.messageLogs.length}건)
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              {store.messageLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  아직 통신 메시지가 없습니다
                </div>
              ) : (
                store.messageLogs
                  .slice()
                  .reverse()
                  .map((log, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2 border-b text-sm"
                    >
                      <div className="flex-shrink-0">
                        <Badge
                          variant={
                            log.direction === "OUT" ? "default" : "secondary"
                          }
                          className={
                            log.direction === "OUT"
                              ? "bg-blue-500 text-white"
                              : "bg-green-500 text-white"
                          }
                        >
                          {log.direction === "OUT" ? "→" : "←"}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                            {log.type}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="font-mono text-xs break-all">
                          {log.content}
                        </div>
                      </div>
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
