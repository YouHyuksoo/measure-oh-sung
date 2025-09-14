"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Terminal,
  Settings,
  Power,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useInspection } from "@/hooks/useInspection";
import { apiClient } from "@/lib/api";
import { PhaseChart } from "@/components/charts/PhaseChart";
import {
  useBarcodeStore,
  selectBarcodeScanner,
  selectConnectionStatus,
} from "@/stores/useBarcodeStore";
import {
  useDeviceStore,
  selectDeviceConnectionStatus,
  selectConnectionDebugInfo,
  DeviceInfo,
} from "@/stores/useDeviceStore";

interface InspectionModel {
  id: number;
  model_name: string;
  description: string;
  is_active?: boolean;
  p1_lower_limit: number;
  p1_upper_limit: number;
  p2_lower_limit: number;
  p2_upper_limit: number;
  p3_lower_limit: number;
  p3_upper_limit: number;
}

// 자동 검사 타이머 설정 인터페이스
interface InspectionTimerSettings {
  p1PrepareTime: number;
  p1Duration: number;
  p2PrepareTime: number;
  p2Duration: number;
  p3PrepareTime: number;
  p3Duration: number;
  autoProgress: boolean;
}

// 자동 검사 상태
interface AutoInspectionState {
  isRunning: boolean;
  currentPhase: "prepare" | "inspect" | null;
  currentStep: "P1" | "P2" | "P3" | null;
  remainingTime: number;
  totalTime: number;
}

// SCPI 실행 상태
interface SCPIExecutionState {
  isRunning: boolean;
  deviceType: "GPT-9800" | "WT310" | null;
  currentCommand: string;
  commandResults: Record<string, any>;
  executionLog: Array<{
    timestamp: string;
    command: string;
    result: string;
    success: boolean;
  }>;
}

export default function InspectionPage() {
  const {
    status,
    currentMeasurement,
    measurementHistory,
    isLoading,
    error,
    wsConnected,
    inspectionWsConnected,
    barcodeWsConnected,
    startListening,
    processBarcodeScan,
    stopInspection,
    refreshStatus,
    clearError,
    setBarcodeCallback,
    sendInspectionMessage,
    sendBarcodeMessage,
  } = useInspection();

  // Zustand 스토어 사용
  const {
    currentBarcode: barcode,
    setCurrentBarcode: setBarcode,
    selectedModelId,
    setSelectedModelId,
    lastScannedBarcode,
    setLastScannedBarcode,
    isListening: barcodeListening,
    setListening: setBarcodeListening,
    port: barcodePort,
    setPort: setBarcodePort,
    scanCount,
    connectionStatus: barcodeConnectionStatus,
    setConnectionStatus: setBarcodeConnectionStatus,
    connectionError: barcodeConnectionError,
    setConnectionError: setBarcodeConnectionError,
    setInitialized: setBarcodeInitialized,
  } = useBarcodeStore();

  // 디바이스 연결 상태 관리
  const {
    deviceConnectionStatus,
    setDeviceConnectionStatus,
    connectionError,
    setConnectionError,
    connectedDevices,
    setConnectedDevices,
    connectionDebugInfo,
    setConnectionDebugInfo,
    updateApiResponse,
    retryCount,
    incrementRetryCount,
    resetRetryCount,
    maxRetries,
  } = useDeviceStore();
  const [inspectionModels, setInspectionModels] = useState<InspectionModel[]>(
    []
  );
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // 자동 검사 관련 상태
  const [timerSettings, setTimerSettings] = useState<InspectionTimerSettings>({
    p1PrepareTime: 3,
    p1Duration: 10,
    p2PrepareTime: 3,
    p2Duration: 10,
    p3PrepareTime: 3,
    p3Duration: 10,
    autoProgress: false,
  });
  const [autoInspection, setAutoInspection] = useState<AutoInspectionState>({
    isRunning: false,
    currentPhase: null,
    currentStep: null,
    remainingTime: 0,
    totalTime: 0,
  });

  // 타이머 관리용 ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoInspectionRef = useRef(autoInspection);

  // ref 동기화
  useEffect(() => {
    autoInspectionRef.current = autoInspection;
  }, [autoInspection]);

  // cleanup에서 현재 상태를 참조하기 위한 ref (Zustand 상태 기반)
  const barcodeListeningRef = useRef(barcodeListening);

  // ref 동기화 (Zustand 상태와 동기화)
  useEffect(() => {
    barcodeListeningRef.current = barcodeListening;
  }, [barcodeListening]);

  // 단계별 차트 데이터
  const [p1Data, setP1Data] = useState<any[]>([]);
  const [p2Data, setP2Data] = useState<any[]>([]);
  const [p3Data, setP3Data] = useState<any[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // SCPI 실행 상태
  const [scpiExecution, setSCPIExecution] = useState<SCPIExecutionState>({
    isRunning: false,
    deviceType: null,
    currentCommand: "",
    commandResults: {},
    executionLog: [],
  });

  const initializeInspectionPage = useCallback(async () => {
    await loadInspectionModels();
    await loadTimerSettings();
    await loadPowerMeterDevices();
    await loadBarcodeScannerDevices();
  }, []);

  // 페이지 진입 시 초기화
  useEffect(() => {
    initializeInspectionPage();
  }, [initializeInspectionPage]);

  // 검사 페이지 초기화

  // 전력측정설비 목록 로드 (단순화)
  const loadPowerMeterDevices = async () => {
    console.log("🚀 [FRONTEND] loadPowerMeterDevices 함수 시작");

    try {
      console.log("🔌 [FRONTEND] 전력측정설비 목록 조회 중...");
      console.log(
        "🌐 [FRONTEND] API URL: http://localhost:8000/api/v1/devices/"
      );

      const response = await fetch("http://localhost:8000/api/v1/devices/");

      console.log("📡 [FRONTEND] 디바이스 목록 API 응답:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        console.error("❌ [FRONTEND] API 오류 발생:", response.status);
        throw new Error(`API 오류: ${response.status}`);
      }

      const allDevices = await response.json();
      console.log("📋 [FRONTEND] 전체 디바이스 목록:", allDevices);

      const powerDevices = allDevices.filter(
        (device: any) => device.device_type === "POWER_METER"
      );
      console.log("🔌 [FRONTEND] 필터링된 전력측정설비:", powerDevices);

      if (powerDevices.length === 0) {
        console.log("⚠️ [FRONTEND] 등록된 전력측정설비가 없음");
        setDeviceConnectionStatus("disconnected");
        setConnectionError(
          "등록된 전력측정설비가 없습니다. 장비 관리에서 설비를 등록해주세요."
        );
        return;
      }

      console.log(`✅ [FRONTEND] ${powerDevices.length}개의 전력측정설비 발견`);
      console.log("🔄 [FRONTEND] 디바이스 목록 상태 업데이트 중...");

      setConnectedDevices(powerDevices);
      setDeviceConnectionStatus("disconnected");
      setConnectionError("");

      console.log("✅ [FRONTEND] 전력측정설비 목록 로드 완료");
    } catch (error) {
      console.error("❌ [FRONTEND] 전력측정설비 목록 조회 실패!");
      console.error("📋 [FRONTEND] 에러 상세:", {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      setDeviceConnectionStatus("error");
      setConnectionError(`전력측정설비 목록 조회 실패: ${error}`);
    }
  };

  // 바코드 스캐너 목록 로드 (단순화)
  const loadBarcodeScannerDevices = async () => {
    console.log("🚀 [FRONTEND] loadBarcodeScannerDevices 함수 시작");

    try {
      console.log("📱 [FRONTEND] 바코드 스캐너 목록 조회 중...");
      console.log(
        "🌐 [FRONTEND] API URL: http://localhost:8000/api/v1/devices/"
      );

      const response = await fetch("http://localhost:8000/api/v1/devices/");

      console.log("📡 [FRONTEND] 바코드 스캐너 API 응답:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        console.error(
          "❌ [FRONTEND] 바코드 스캐너 API 오류 발생:",
          response.status
        );
        throw new Error(`API 오류: ${response.status}`);
      }

      const allDevices = await response.json();
      console.log("📋 [FRONTEND] 전체 디바이스 목록 (바코드용):", allDevices);

      const barcodeDevices = allDevices.filter(
        (device: any) => device.device_type === "BARCODE_SCANNER"
      );
      console.log("📱 [FRONTEND] 필터링된 바코드 스캐너:", barcodeDevices);

      if (barcodeDevices.length === 0) {
        console.log("⚠️ [FRONTEND] 등록된 바코드 스캐너가 없음");
        setBarcodeConnectionStatus("disconnected");
        setBarcodeConnectionError(
          "등록된 바코드 스캐너가 없습니다. 장비 관리에서 스캐너를 등록해주세요."
        );
        return;
      }

      // 첫 번째 바코드 스캐너 정보 설정
      const targetBarcodeDevice = barcodeDevices[0];
      console.log("🎯 [FRONTEND] 선택된 바코드 스캐너:", targetBarcodeDevice);

      console.log("🔄 [FRONTEND] 바코드 스캐너 상태 업데이트 중...");
      setBarcodePort(targetBarcodeDevice.port || "");
      setBarcodeConnectionStatus("disconnected");
      setBarcodeConnectionError("");

      console.log(
        `✅ [FRONTEND] ${barcodeDevices.length}개의 바코드 스캐너 발견`
      );
      console.log("✅ [FRONTEND] 바코드 스캐너 목록 로드 완료");
    } catch (error) {
      console.error("❌ [FRONTEND] 바코드 스캐너 목록 조회 실패!");
      console.error("📋 [FRONTEND] 에러 상세:", {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      setBarcodeConnectionStatus("error");
      setBarcodeConnectionError(`바코드 스캐너 목록 조회 실패: ${error}`);
    }
  };

  // 전력측정설비 수동 연결
  const connectPowerMeter = async () => {
    console.log("🚀 [FRONTEND] connectPowerMeter 함수 시작");
    console.log("📊 [FRONTEND] 현재 상태:", {
      connectedDevices: connectedDevices,
      deviceConnectionStatus: deviceConnectionStatus,
      connectionError: connectionError,
    });

    if (connectedDevices.length === 0) {
      console.log("❌ [FRONTEND] 연결할 전력측정설비가 없음");
      setConnectionError("연결할 전력측정설비가 없습니다.");
      return;
    }

    const targetDevice = connectedDevices[0];
    console.log("🎯 [FRONTEND] 대상 디바이스:", targetDevice);

    if (!targetDevice || !targetDevice.id) {
      console.log("❌ [FRONTEND] 유효하지 않은 디바이스 정보");
      setConnectionError("유효하지 않은 디바이스 정보입니다.");
      return;
    }

    try {
      console.log("🔄 [FRONTEND] 상태를 'connecting'으로 변경");
      setDeviceConnectionStatus("connecting");
      setConnectionError("");

      console.log(
        `🔌 [FRONTEND] ${targetDevice.name} (ID: ${targetDevice.id}) 연결 시도 중...`
      );
      console.log(
        `🌐 [FRONTEND] API URL: http://localhost:8000/api/v1/serial/devices/${targetDevice.id}/connect`
      );

      const response = await fetch(
        `http://localhost:8000/api/v1/serial/devices/${targetDevice.id}/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      console.log("📡 [FRONTEND] API 응답 받음:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ [FRONTEND] ${targetDevice.name} 연결 성공!`);
        console.log("📋 [FRONTEND] 백엔드 응답 데이터:", result);

        const updatedDevice: DeviceInfo = {
          ...targetDevice,
          connected: true,
        };

        console.log("🔄 [FRONTEND] 디바이스 상태 업데이트:", updatedDevice);
        setConnectedDevices([updatedDevice]);

        console.log("🔄 [FRONTEND] 연결 상태를 'connected'로 변경");
        setDeviceConnectionStatus("connected");
        setConnectionError("");

        console.log("✅ [FRONTEND] 모든 상태 업데이트 완료");
        console.log("📊 [FRONTEND] 업데이트 후 상태:", {
          connectedDevices: [updatedDevice],
          deviceConnectionStatus: "connected",
          connectionError: "",
        });
      } else {
        const errorText = await response.text();
        console.error(`❌ [FRONTEND] ${targetDevice.name} 연결 실패!`);
        console.error("📋 [FRONTEND] 에러 응답:", {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
        });

        setDeviceConnectionStatus("error");
        setConnectionError(`연결 실패: ${errorText}`);
      }
    } catch (error) {
      console.error("❌ [FRONTEND] 전력측정설비 연결 오류!");
      console.error("📋 [FRONTEND] 에러 상세:", {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      setDeviceConnectionStatus("error");
      setConnectionError(`연결 오류: ${error}`);
    }
  };

  // 바코드 스캐너 수동 연결
  const connectBarcodeScanner = async () => {
    console.log("🚀 [FRONTEND] connectBarcodeScanner 함수 시작");
    console.log("📊 [FRONTEND] 현재 바코드 상태:", {
      barcodePort: barcodePort,
      barcodeConnectionStatus: barcodeConnectionStatus,
      barcodeConnectionError: barcodeConnectionError,
      barcodeListening: barcodeListening,
    });

    if (!barcodePort) {
      console.log("❌ [FRONTEND] 바코드 스캐너 포트가 설정되지 않음");
      setBarcodeConnectionError("바코드 스캐너 포트가 설정되지 않았습니다.");
      return;
    }

    try {
      console.log("🔄 [FRONTEND] 바코드 연결 상태를 'connecting'으로 변경");
      setBarcodeConnectionStatus("connecting");
      setBarcodeConnectionError("");

      console.log("📱 [FRONTEND] 바코드 스캐너 연결 시도 중...");
      console.log(`🔌 [FRONTEND] 포트: ${barcodePort}`);

      const result = await apiClient.startBarcodeListening();
      console.log("📡 [FRONTEND] 바코드 API 응답:", result);

      if (
        result &&
        typeof result === "object" &&
        "success" in result &&
        result.success
      ) {
        console.log("✅ [FRONTEND] 바코드 스캐너 연결 성공!");
        console.log("🔄 [FRONTEND] 바코드 수신 상태를 true로 설정");
        setBarcodeListening(true);

        console.log("🔄 [FRONTEND] 바코드 연결 상태를 'connected'로 변경");
        setBarcodeConnectionStatus("connected");
        setBarcodeConnectionError("");

        console.log("✅ [FRONTEND] 바코드 스캐너 모든 상태 업데이트 완료");
      } else {
        const errorMessage =
          result && typeof result === "object" && "message" in result
            ? String((result as any).message)
            : "바코드 스캐너 연결 실패";
        console.error("❌ [FRONTEND] 바코드 스캐너 연결 실패!");
        console.error("📋 [FRONTEND] 에러 메시지:", errorMessage);
        console.error("📋 [FRONTEND] 원본 응답:", result);

        setBarcodeConnectionStatus("error");
        setBarcodeConnectionError(errorMessage);
      }
    } catch (error) {
      console.error("❌ [FRONTEND] 바코드 스캐너 연결 오류!");
      console.error("📋 [FRONTEND] 에러 상세:", {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      setBarcodeConnectionStatus("error");
      setBarcodeConnectionError(`연결 오류: ${error}`);
    }
  };

  // 검사설비로 검사 명령 전송
  const sendInspectionCommandToDevice = async (
    barcode: string,
    modelId: number
  ) => {
    try {
      console.log("검사설비로 명령 전송:", { barcode, modelId });

      // WebSocket을 통해 검사 명령 전송
      sendInspectionMessage({
        type: "start_inspection",
        data: {
          barcode: barcode,
          inspection_model_id: modelId,
          timestamp: new Date().toISOString(),
        },
      });

      // WebSocket 명령 전송만 수행 (API 호출은 장비 연결 확인 후 별도 처리)
      console.log("WebSocket 검사 명령 전송 완료");
    } catch (error) {
      console.error("검사 명령 전송 실패:", error);
      // setError는 useInspection 훅에서 제공되므로 error 상태를 직접 설정하지 않음
      console.error("검사 명령 전송에 실패했습니다");
    }
  };

  // 바코드 콜백 등록 및 cleanup
  useEffect(() => {
    if (setBarcodeCallback) {
      setBarcodeCallback(async (barcodeData: string) => {
        console.log("🔄 바코드 수신:", barcodeData.trim());

        // 1. 바코드 상태 업데이트
        setBarcode(barcodeData.trim());
        setLastScannedBarcode(barcodeData.trim());

        // 2. 검사 모델이 선택되지 않은 경우
        if (!selectedModelId) {
          console.log("⚠️ 검사 모델을 선택해주세요");
          return;
        }

        // 3. 전력측정설비 연결 상태 확인
        if (
          deviceConnectionStatus === "connected" &&
          connectedDevices.length > 0
        ) {
          console.log("🔋 전력측정설비 연결됨 - 검사 프로세스 시작");

          // 검사 명령 전송
          await sendInspectionCommandToDevice(
            barcodeData.trim(),
            selectedModelId
          );

          // 검사 프로세스 시작
          await processBarcodeScan(barcodeData.trim(), selectedModelId);
        } else {
          console.log("⚠️ 전력측정설비가 연결되지 않음 - 바코드만 수신됨");
        }
      });
    }

    return () => {
      if (setBarcodeCallback) {
        setBarcodeCallback(null);
      }
    };
  }, [
    selectedModelId,
    deviceConnectionStatus,
    connectedDevices.length,
    processBarcodeScan,
    sendInspectionCommandToDevice,
  ]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      const timer = timerRef.current;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  // 실시간 측정 데이터를 단계별로 분리하여 차트 데이터로 변환
  useEffect(() => {
    if (measurementHistory.length > 0 && !isPaused) {
      console.log("측정 데이터 업데이트:", measurementHistory.length, "개");

      // P1, P2, P3 데이터를 각각 분리
      const p1Measurements = measurementHistory
        .filter((m) => m.phase === "P1")
        .map((measurement) => ({
          timestamp: measurement.timestamp,
          time: new Date(measurement.timestamp).toLocaleTimeString("ko-KR"),
          value: measurement.value,
          barcode: measurement.barcode,
          result: measurement.result,
        }));

      const p2Measurements = measurementHistory
        .filter((m) => m.phase === "P2")
        .map((measurement) => ({
          timestamp: measurement.timestamp,
          time: new Date(measurement.timestamp).toLocaleTimeString("ko-KR"),
          value: measurement.value,
          barcode: measurement.barcode,
          result: measurement.result,
        }));

      const p3Measurements = measurementHistory
        .filter((m) => m.phase === "P3")
        .map((measurement) => ({
          timestamp: measurement.timestamp,
          time: new Date(measurement.timestamp).toLocaleTimeString("ko-KR"),
          value: measurement.value,
          barcode: measurement.barcode,
          result: measurement.result,
        }));

      setP1Data(p1Measurements);
      setP2Data(p2Measurements);
      setP3Data(p3Measurements);

      console.log("차트 데이터 업데이트 완료:", {
        P1: p1Measurements.length,
        P2: p2Measurements.length,
        P3: p3Measurements.length,
      });
    }
  }, [measurementHistory, isPaused]);

  // 실시간 측정값 수신 시 즉시 차트 업데이트
  useEffect(() => {
    if (currentMeasurement && !isPaused) {
      console.log("실시간 측정값 수신:", currentMeasurement);

      const newDataPoint = {
        timestamp: currentMeasurement.timestamp,
        time: new Date(currentMeasurement.timestamp).toLocaleTimeString(
          "ko-KR"
        ),
        value: currentMeasurement.value,
        barcode: currentMeasurement.barcode,
        result: currentMeasurement.result,
      };

      // 해당 단계 차트에 즉시 추가
      if (currentMeasurement.phase === "P1") {
        setP1Data((prev) => [...prev, newDataPoint].slice(-20));
      } else if (currentMeasurement.phase === "P2") {
        setP2Data((prev) => [...prev, newDataPoint].slice(-20));
      } else if (currentMeasurement.phase === "P3") {
        setP3Data((prev) => [...prev, newDataPoint].slice(-20));
      }

      console.log(
        `${currentMeasurement.phase} 단계 실시간 데이터 추가:`,
        newDataPoint
      );
    }
  }, [currentMeasurement, isPaused]);

  const loadInspectionModels = async () => {
    try {
      setIsLoadingModels(true);
      const response = (await apiClient.getInspectionModelsAll()) as
        | { models?: InspectionModel[] }
        | InspectionModel[];

      // API 응답에서 models 배열 추출
      const models = Array.isArray(response) ? response : response.models || [];
      setInspectionModels(models as InspectionModel[]);

      // 첫 번째 모델을 자동 선택
      if (models && models.length > 0 && models[0]) {
        setSelectedModelId(models[0].id);
      }
    } catch (err) {
      console.error("검사 모델 로드 오류:", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // 검사 타이머 설정 로드
  const loadTimerSettings = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/v1/devices/inspection-timer/settings"
      );

      if (!response.ok) {
        console.warn(
          `타이머 설정 API 오류 (기본값 사용): ${response.status} ${response.statusText}`
        );
        // API 오류 시 기본값 사용
        setTimerSettings({
          p1PrepareTime: 5,
          p1Duration: 10,
          p2PrepareTime: 5,
          p2Duration: 15,
          p3PrepareTime: 5,
          p3Duration: 12,
          autoProgress: true, // 기본적으로 자동 진행 활성화
        });
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn(
          "타이머 설정 응답이 JSON이 아닙니다 (기본값 사용):",
          contentType
        );
        // 기본값 사용
        setTimerSettings({
          p1PrepareTime: 5,
          p1Duration: 10,
          p2PrepareTime: 5,
          p2Duration: 15,
          p3PrepareTime: 5,
          p3Duration: 12,
          autoProgress: true,
        });
        return;
      }

      const data = await response.json();
      if (data) {
        setTimerSettings(data);
        console.log("타이머 설정 로드 완료:", data);
      }
    } catch (err) {
      console.warn("타이머 설정 로드 실패 (기본값 사용):", err);
      // 기본값 사용
      setTimerSettings({
        p1PrepareTime: 5,
        p1Duration: 10,
        p2PrepareTime: 5,
        p2Duration: 15,
        p3PrepareTime: 5,
        p3Duration: 12,
        autoProgress: true,
      });
    }
  };

  // 자동 검사 프로세스 시작 (단순화)
  const startAutoInspectionProcess = async (scanBarcode: string) => {
    console.log("자동 검사 프로세스 시작:", scanBarcode);

    if (selectedModelId) {
      await processBarcodeScan(scanBarcode, selectedModelId);
    }
  };

  // 검사 루틴 실행 (단순화)
  const executeInspectionRoutine = async (barcode: string) => {
    console.log(`검사 시작 - 바코드: ${barcode}`);

    try {
      // 전력측정설비가 연결된 경우에만 검사 실행
      if (
        deviceConnectionStatus === "connected" &&
        connectedDevices.length > 0
      ) {
        console.log("전력측정설비와 연결되어 검사 실행 가능");
        // 실제 검사 로직은 백엔드에서 처리
      } else {
        console.log("전력측정설비가 연결되지 않아 검사 실행 불가");
      }
    } catch (error) {
      console.error("검사 실행 오류:", error);
    }
  };

  // 차트 데이터 업데이트 (단순화)
  const updateChartData = (
    testType: string,
    result: string,
    barcode: string
  ) => {
    console.log(`차트 데이터 업데이트: ${testType} - ${result}`);
    // 실제 차트 업데이트는 WebSocket으로 받은 데이터로 처리
  };

  // 자동 검사 완료 (단순화)
  const completeAutoInspection = () => {
    console.log("자동 검사 프로세스 완료");
    setAutoInspection({
      isRunning: false,
      currentPhase: null,
      currentStep: null,
      remainingTime: 0,
      totalTime: 0,
    });
  };

  // SCPI 로그 추가 함수 (단순화)
  const addSCPILog = (command: string, result: string, success: boolean) => {
    console.log(`SCPI: ${command} -> ${result} (${success ? "성공" : "실패"})`);
  };

  // 자동 검사 중지 (단순화)
  const stopAutoInspection = () => {
    console.log("자동 검사 중지");
    setAutoInspection({
      isRunning: false,
      currentPhase: null,
      currentStep: null,
      remainingTime: 0,
      totalTime: 0,
    });
  };

  const handleStartListening = async () => {
    await startListening();
  };

  const handleStopInspection = async () => {
    await stopInspection();
    setBarcode("");
    stopAutoInspection();
  };

  // 단계별 타이머 표시 컴포넌트 (단순화)
  const PhaseTimer = ({ phase }: { phase: "P1" | "P2" | "P3" }) => {
    const isActive =
      autoInspection.isRunning && autoInspection.currentStep === phase;

    if (!autoInspection.isRunning || !isActive) return null;

    return (
      <div className="absolute top-2 right-2 bg-white rounded-lg p-2 shadow-md border">
        <div className="text-xs font-medium text-blue-600">
          {phase} 단계 진행 중
        </div>
      </div>
    );
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

    await processBarcodeScan(barcode.trim(), selectedModelId);
    setBarcode("");
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
              <div>
                {/* 전력측정설비 연결 상태 */}
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      전력측정설비
                    </span>
                    <Badge
                      variant={
                        deviceConnectionStatus === "connected"
                          ? "default"
                          : deviceConnectionStatus === "connecting"
                          ? "secondary"
                          : "destructive"
                      }
                      className={
                        deviceConnectionStatus === "connected"
                          ? "bg-green-500"
                          : deviceConnectionStatus === "connecting"
                          ? "bg-blue-500"
                          : "bg-red-500"
                      }
                    >
                      {deviceConnectionStatus === "connected" && (
                        <Power className="h-3 w-3 mr-1" />
                      )}
                      {deviceConnectionStatus === "connecting" && (
                        <Activity className="h-3 w-3 mr-1" />
                      )}
                      {deviceConnectionStatus === "error" && (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {deviceConnectionStatus === "disconnected" && (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {deviceConnectionStatus === "connected" && "연결됨"}
                      {deviceConnectionStatus === "connecting" && "연결 중"}
                      {deviceConnectionStatus === "error" && "연결 실패"}
                      {deviceConnectionStatus === "disconnected" && "미연결"}
                    </Badge>
                  </div>

                  {deviceConnectionStatus === "connected" &&
                  connectedDevices.length > 0 ? (
                    <div className="space-y-2">
                      {connectedDevices.map((device, index) => (
                        <div
                          key={index}
                          className="p-2 bg-green-50 border border-green-200 rounded text-xs"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-green-800">
                              {device.name}
                            </span>
                            <span className="text-green-600 font-mono">
                              {device.port}
                            </span>
                          </div>
                          <div className="text-green-600 mt-1">
                            {device.manufacturer} {device.model}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : deviceConnectionStatus === "connecting" ? (
                    <div className="text-xs text-blue-600 p-2 bg-blue-50 border border-blue-200 rounded flex items-center gap-2">
                      <Activity className="h-3 w-3 animate-spin" />
                      전력측정설비 연결 중...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {connectionError && (
                        <div className="text-xs text-red-600 p-2 bg-red-50 border border-red-200 rounded">
                          {connectionError}
                        </div>
                      )}
                      <Button
                        onClick={connectPowerMeter}
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        disabled={connectedDevices.length === 0}
                      >
                        <Activity className="h-3 w-3 mr-1" />
                        전력측정설비 연결
                      </Button>
                    </div>
                  )}

                  {/* 디버깅 정보 표시 */}
                  {connectionDebugInfo.lastAttempt && (
                    <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                      <div className="font-medium text-gray-700 mb-1">
                        연결 디버깅 정보:
                      </div>
                      <div className="space-y-1">
                        <div>
                          마지막 시도: {connectionDebugInfo.lastAttempt}
                        </div>
                        {connectionDebugInfo.apiResponse && (
                          <div>
                            API 응답:{" "}
                            {connectionDebugInfo.apiResponse.success
                              ? "성공"
                              : "실패"}
                            (상태: {connectionDebugInfo.apiResponse.status})
                          </div>
                        )}
                        {connectionDebugInfo.deviceInfo && (
                          <div>
                            대상 디바이스: {connectionDebugInfo.deviceInfo.name}{" "}
                            (ID: {connectionDebugInfo.deviceInfo.id})
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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

                {/* 자동 검사 진행 상태 */}
                {autoInspection.isRunning && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-blue-800">
                        자동 검사 진행 중
                      </span>
                      <Badge variant="default" className="bg-blue-500">
                        {autoInspection.currentStep}
                      </Badge>
                    </div>
                    <div className="text-xs text-blue-600">
                      {autoInspection.currentPhase === "prepare"
                        ? "준비 단계"
                        : "검사 단계"}
                      : {autoInspection.remainingTime}초 남음
                    </div>
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
                  <SelectContent className="bg-white border border-gray-200">
                    {inspectionModels.map((model) => (
                      <SelectItem
                        key={model.id}
                        value={model.id.toString()}
                        className="text-black hover:bg-gray-100 focus:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-medium text-black">
                            {model.model_name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 바코드 스캐너 상태 */}
              <div className="space-y-2">
                <Label>바코드 스캐너</Label>
                <div className="p-2 bg-gray-50 border rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scan className="h-4 w-4 text-gray-600" />
                      <span className="text-sm">
                        {barcodePort ? `포트: ${barcodePort}` : "설정되지 않음"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {barcodeListening ? (
                        <Badge variant="default" className="bg-green-500">
                          <Activity className="h-3 w-3 mr-1" />
                          수신중
                        </Badge>
                      ) : barcodePort ? (
                        <Badge
                          variant={
                            barcodeConnectionStatus === "connecting"
                              ? "secondary"
                              : barcodeConnectionStatus === "connected"
                              ? "default"
                              : barcodeConnectionStatus === "error"
                              ? "destructive"
                              : "secondary"
                          }
                          className={
                            barcodeConnectionStatus === "connecting"
                              ? "bg-blue-500"
                              : barcodeConnectionStatus === "connected"
                              ? "bg-green-500"
                              : barcodeConnectionStatus === "error"
                              ? "bg-red-500"
                              : "bg-gray-500"
                          }
                        >
                          {barcodeConnectionStatus === "connecting" && (
                            <Activity className="h-3 w-3 mr-1" />
                          )}
                          {barcodeConnectionStatus === "connected" && (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          {barcodeConnectionStatus === "error" && (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          {barcodeConnectionStatus === "connecting" && "연결중"}
                          {barcodeConnectionStatus === "connected" && "연결됨"}
                          {barcodeConnectionStatus === "error" && "오류"}
                          {barcodeConnectionStatus === "disconnected" &&
                            "시작중"}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          미설정
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!barcodePort && (
                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      💡 장비 관리 페이지에서 바코드 스캐너를 먼저 설정해주세요
                    </div>
                  )}
                  {barcodeConnectionStatus === "error" &&
                    barcodeConnectionError && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                        ❌ {barcodeConnectionError}
                      </div>
                    )}

                  {/* 바코드 스캐너 수동 연결 버튼 */}
                  {!barcodeListening && barcodePort && (
                    <div className="mt-2">
                      <Button
                        onClick={connectBarcodeScanner}
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        disabled={barcodeConnectionStatus === "connecting"}
                      >
                        <Activity className="h-3 w-3 mr-1" />
                        {barcodeConnectionStatus === "connecting"
                          ? "연결 중..."
                          : "바코드 스캐너 연결"}
                      </Button>
                    </div>
                  )}

                  {barcodeListening && lastScannedBarcode && (
                    <div className="mt-2 text-xs text-green-600">
                      ✓ 마지막 스캔: {lastScannedBarcode}
                      <span className="ml-2 px-1 py-0.5 bg-green-100 rounded text-green-700 font-medium">
                        총 {scanCount}회
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 바코드 입력 */}
              <form onSubmit={handleBarcodeSubmit} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="barcode">바코드</Label>
                  {barcodeListening && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      스캐너에서 자동 입력
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder={
                      barcodeListening
                        ? "바코드 스캐너에서 자동 입력됩니다..."
                        : "바코드를 입력하거나 스캐너를 설정하세요"
                    }
                    disabled={!status.is_listening || isLoading}
                    className={
                      barcodeListening ? "bg-green-50 border-green-200" : ""
                    }
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={
                      !status.is_listening || !barcode.trim() || isLoading
                    }
                    title="바코드 검사 시작"
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
        <div className="lg:col-span-4 space-y-6">
          {/* 자동 검사 상태 표시 */}
          {(timerSettings.autoProgress || autoInspection.isRunning) && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  자동 검사 진행 상태
                  {autoInspection.isRunning && (
                    <Badge variant="default" className="bg-blue-500">
                      진행 중
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {timerSettings.autoProgress
                    ? "바코드 스캔 후 자동으로 P1 → P2 → P3 단계가 진행됩니다"
                    : "자동 검사 기능이 비활성화되어 있습니다"}
                </CardDescription>
              </CardHeader>
              {autoInspection.isRunning && (
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="font-medium">현재 단계:</span>
                        <Badge variant="outline" className="ml-2">
                          {autoInspection.currentStep}{" "}
                          {autoInspection.currentPhase === "prepare"
                            ? "준비"
                            : "검사"}
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">남은 시간:</span>
                        <span className="ml-2 text-lg font-bold text-blue-600">
                          {autoInspection.remainingTime}s
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={stopAutoInspection}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Square className="h-4 w-4 mr-1" />
                      자동 검사 중지
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* 검사 결과 모니터링 */}
          {Object.keys(scpiExecution.commandResults).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  실시간 검사 결과
                </CardTitle>
                <CardDescription>
                  SCPI 자동 실행 결과 및 합불 판정
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(scpiExecution.commandResults).map(
                    ([barcode, data]: [string, any]) => (
                      <div
                        key={barcode}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{barcode}</Badge>
                            <span className="text-sm text-gray-500">
                              {new Date(data.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <Badge
                            variant={
                              data.overallResult === "PASS"
                                ? "default"
                                : "destructive"
                            }
                            className={
                              data.overallResult === "PASS"
                                ? "bg-green-500"
                                : "bg-red-500"
                            }
                          >
                            {data.overallResult === "PASS" && (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            {data.overallResult === "FAIL" && (
                              <AlertCircle className="h-3 w-3 mr-1" />
                            )}
                            {data.overallResult}
                          </Badge>
                        </div>

                        {/* 3대안전 시험 결과 */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {Object.entries(data.testResults || {}).map(
                            ([testType, result]: [string, any]) => (
                              <div
                                key={testType}
                                className={`p-2 rounded border ${
                                  result.success
                                    ? "bg-green-50 border-green-200"
                                    : "bg-red-50 border-red-200"
                                }`}
                              >
                                <div className="text-xs font-medium text-gray-700">
                                  {testType}
                                </div>
                                <div
                                  className={`text-xs ${
                                    result.success
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {result.result}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {result.data}
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        {/* 전력 측정 결과 */}
                        {data.powerData && (
                          <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                            <div className="text-xs font-medium text-blue-700">
                              전력량 적산
                            </div>
                            <div className="text-xs text-blue-600">
                              {data.powerData}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SCPI 실행 로그 (간단 버전) */}
          {scpiExecution.executionLog.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  SCPI 실행 로그
                  {scpiExecution.isRunning && (
                    <Badge variant="default" className="bg-blue-500">
                      실행 중
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  최근 SCPI 명령어 실행 내역 (최근 10개)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48 overflow-y-auto text-sm space-y-1">
                  {scpiExecution.executionLog.slice(0, 10).map((log, index) => (
                    <div
                      key={index}
                      className={`flex gap-2 text-xs ${
                        log.success ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      <span className="text-gray-400 min-w-16">
                        {log.timestamp}
                      </span>
                      <span className="font-mono text-gray-700 flex-1">
                        {log.command}
                      </span>
                      <span
                        className={
                          log.success ? "text-green-600" : "text-red-600"
                        }
                      >
                        {log.result}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 단계별 실시간 차트 */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="relative">
              <PhaseTimer phase="P1" />
              <PhaseChart
                data={p1Data}
                phase="P1"
                title="P1 단계 측정"
                limits={
                  selectedModelId && inspectionModels.length > 0
                    ? {
                        lower:
                          inspectionModels.find((m) => m.id === selectedModelId)
                            ?.p1_lower_limit || 0,
                        upper:
                          inspectionModels.find((m) => m.id === selectedModelId)
                            ?.p1_upper_limit || 100,
                      }
                    : undefined
                }
                maxDataPoints={20}
                isRealTime={status.is_listening}
                onTogglePause={() => setIsPaused(!isPaused)}
                onClear={() => setP1Data([])}
                isActive={
                  autoInspection.isRunning &&
                  autoInspection.currentStep === "P1"
                }
                isCompleted={
                  autoInspection.isRunning &&
                  (autoInspection.currentStep === "P2" ||
                    autoInspection.currentStep === "P3")
                }
                isPending={
                  autoInspection.isRunning &&
                  (autoInspection.currentStep === "P2" ||
                    autoInspection.currentStep === "P3")
                }
              />
            </div>

            <div className="relative">
              <PhaseTimer phase="P2" />
              <PhaseChart
                data={p2Data}
                phase="P2"
                title="P2 단계 측정"
                limits={
                  selectedModelId && inspectionModels.length > 0
                    ? {
                        lower:
                          inspectionModels.find((m) => m.id === selectedModelId)
                            ?.p2_lower_limit || 0,
                        upper:
                          inspectionModels.find((m) => m.id === selectedModelId)
                            ?.p2_upper_limit || 100,
                      }
                    : undefined
                }
                maxDataPoints={20}
                isRealTime={status.is_listening}
                onTogglePause={() => setIsPaused(!isPaused)}
                onClear={() => setP2Data([])}
                isActive={
                  autoInspection.isRunning &&
                  autoInspection.currentStep === "P2"
                }
                isCompleted={
                  autoInspection.isRunning &&
                  autoInspection.currentStep === "P3"
                }
                isPending={
                  autoInspection.isRunning &&
                  autoInspection.currentStep === "P1"
                }
              />
            </div>

            <div className="relative">
              <PhaseTimer phase="P3" />
              <PhaseChart
                data={p3Data}
                phase="P3"
                title="P3 단계 측정"
                limits={
                  selectedModelId && inspectionModels.length > 0
                    ? {
                        lower:
                          inspectionModels.find((m) => m.id === selectedModelId)
                            ?.p3_lower_limit || 0,
                        upper:
                          inspectionModels.find((m) => m.id === selectedModelId)
                            ?.p3_upper_limit || 100,
                      }
                    : undefined
                }
                maxDataPoints={20}
                isRealTime={status.is_listening}
                onTogglePause={() => setIsPaused(!isPaused)}
                onClear={() => setP3Data([])}
                isActive={
                  autoInspection.isRunning &&
                  autoInspection.currentStep === "P3"
                }
                isCompleted={false}
                isPending={
                  autoInspection.isRunning &&
                  (autoInspection.currentStep === "P1" ||
                    autoInspection.currentStep === "P2")
                }
              />
            </div>
          </div>

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
