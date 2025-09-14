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

  // 바코드 스캔 메시지 처리
  useEffect(() => {
    if (store.ws && store.wsStatus === "connected") {
      const handleMessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          console.log("🔍 [INSPECTION] WebSocket 메시지 수신:", message);

          if (message.type === "barcode_scan") {
            const barcode = message.data?.barcode;
            if (barcode) {
              console.log("📱 [INSPECTION] 바코드 스캔 감지:", barcode);
              store.setBarcode(barcode);

              // 자동으로 검사 시작 (모델이 선택되어 있고 설비가 연결된 경우)
              if (
                store.selectedModelId &&
                store.powerMeterStatus === "connected"
              ) {
                console.log("🚀 [INSPECTION] 자동 검사 시작");
                store.startInspection(barcode);
              }
            }
          }
        } catch (error) {
          console.error("❌ [INSPECTION] WebSocket 메시지 파싱 오류:", error);
        }
      };

      store.ws.addEventListener("message", handleMessage);

      return () => {
        store.ws?.removeEventListener("message", handleMessage);
      };
    }

    // 조건이 맞지 않을 때도 cleanup 함수 반환
    return () => {};
  }, [store.ws, store.wsStatus, store.setBarcode]);

  if (!isMounted) {
    return null; // or a loading spinner
  }

  // --- UI Event Handlers ---
  const handleStartInspection = () => {
    if (store.currentBarcode) {
      store.startInspection(store.currentBarcode);
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
                  <StatusBadge status={store.powerMeterStatus} />
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
                  <StatusBadge
                    status={
                      store.isBarcodeScannerListening
                        ? "connected"
                        : store.barcodeScannerStatus
                    }
                  />
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
              <CardTitle>측정 이력</CardTitle>
              <CardDescription>
                현재 세션의 측정 기록 ({store.measurementHistory.length}건)
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              {store.measurementHistory
                .slice()
                .reverse()
                .map((m, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-2 border-b"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{m.barcode}</Badge>
                      <span className="font-medium">{m.phase}</span>
                      <span>
                        {m.value} {m.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          m.result === "PASS" ? "success" : "destructive"
                        }
                      >
                        {m.result}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
