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
  Shield,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  XCircle,
  Database,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
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

// 3대 안전검사 항목 인터페이스
interface SafetyInspectionItem {
  id: string;
  name: string;
  nameEn: string;
  unit: string;
  sourceVoltage: string;
  limitValue: number;
  limitDirection: "up" | "down";
  currentValue: number | null;
  result: "PASS" | "FAIL" | "PENDING";
  isCompleted: boolean;
}

// inspection 페이지와 동일한 모델 인터페이스 사용
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

// 검사 상태
type InspectionStatus = "idle" | "scanning" | "running" | "completed" | "error";

export default function SafetyInspectionPage() {
  // 상태 관리
  const [status, setStatus] = useState<InspectionStatus>("idle");
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  // WebSocket 연결 (선택적)
  const { isConnected: wsConnected, lastMessage } = useWebSocket(
    "ws://localhost:8000/ws"
  );

  // 가상 상태 객체 (inspection 페이지 호환성을 위해)
  const virtualStatus = {
    is_listening: status === "running" && wsConnected,
    connected_devices: wsConnected ? 1 : 0,
    total_devices: 1,
    current_barcode: barcode || null,
    phase: status === "running" ? currentStep : null,
    progress: null,
  };

  // 가상 타이머 설정 (inspection 페이지 호환성을 위해)
  const timerSettings = {
    autoProgress: true,
  };

  // 가상 자동검사 상태 (inspection 페이지 호환성을 위해)
  const autoInspection = {
    isRunning: false,
    currentStep: null,
    currentPhase: null,
    remainingTime: 0,
  };

  // 3대 안전검사 항목 상태
  const [safetyItems, setSafetyItems] = useState<SafetyInspectionItem[]>([
    {
      id: "dielectric",
      name: "내전압",
      nameEn: "Dielectric Strength",
      unit: "mA",
      sourceVoltage: "1.8kV",
      limitValue: 30.0,
      limitDirection: "down",
      currentValue: null,
      result: "PENDING",
      isCompleted: false,
    },
    {
      id: "insulation",
      name: "절연저항",
      nameEn: "Insulation Resistance",
      unit: "MΩ",
      sourceVoltage: "0.5kV",
      limitValue: 10.0,
      limitDirection: "up",
      currentValue: null,
      result: "PENDING",
      isCompleted: false,
    },
    {
      id: "ground",
      name: "접지연속",
      nameEn: "Ground Continuity",
      unit: "mΩ",
      sourceVoltage: "25A",
      limitValue: 100.0,
      limitDirection: "down",
      currentValue: null,
      result: "PENDING",
      isCompleted: false,
    },
  ]);

  // 계산된 값들
  const completedItems = safetyItems.filter((item) => item.isCompleted).length;
  const passedItems = safetyItems.filter(
    (item) => item.result === "PASS"
  ).length;
  const failedItems = safetyItems.filter(
    (item) => item.result === "FAIL"
  ).length;
  const overallResult =
    failedItems > 0
      ? "FAIL"
      : completedItems === safetyItems.length
      ? "PASS"
      : "PENDING";

  // 바코드 스캐너 실시간 감청 시작
  const startBarcodeListening = async () => {
    if (!barcodePort) {
      console.log("바코드 포트가 설정되지 않았습니다.");
      setBarcodeListening(false);
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:8000/api/v1/devices/barcode/start-listening",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            port: barcodePort,
            baudrate: 9600,
            data_bits: 8,
            stop_bits: 1,
            parity: "N",
            timeout: 1,
          }),
        }
      );

      if (!response.ok) {
        console.error(
          `바코드 감청 시작 API 오류: ${response.status} ${response.statusText}`
        );
        setBarcodeListening(false);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("바코드 감청 시작 응답이 JSON이 아닙니다:", contentType);
        setBarcodeListening(false);
        return;
      }

      const result = await response.json();
      if (result.success) {
        setBarcodeListening(true);
        console.log(`바코드 스캐너 자동 시작됨: ${barcodePort}`);
      } else {
        console.error(`바코드 감청 시작 실패: ${result.message}`);
        setBarcodeListening(false);
      }
    } catch (err) {
      console.error("바코드 감청 시작 오류:", err);
      setBarcodeListening(false);
    }
  };

  // 바코드 스캐너 실시간 감청 중지
  const stopBarcodeListening = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/v1/devices/barcode/stop-listening",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        console.error(
          `바코드 감청 중지 API 오류: ${response.status} ${response.statusText}`
        );
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("바코드 감청 중지 응답이 JSON이 아닙니다:", contentType);
        return;
      }

      const result = await response.json();
      if (result.success) {
        setBarcodeListening(false);
        console.log("바코드 스캐너 감청 중지됨");
      } else {
        console.error(`바코드 감청 중지 실패: ${result.message}`);
      }
    } catch (err) {
      console.error("바코드 감청 중지 오류:", err);
    }
  };

  // 검사 시뮬레이션 함수
  const simulateInspection = useCallback(
    async (itemId: string, limitValue: number): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          setSafetyItems((items) =>
            items.map((item) => {
              if (item.id === itemId) {
                // 랜덤한 측정값 생성 (70% 확률로 PASS)
                const randomValue =
                  item.limitDirection === "up"
                    ? limitValue +
                      (Math.random() > 0.3
                        ? Math.random() * 5
                        : -Math.random() * 2)
                    : limitValue -
                      (Math.random() > 0.3
                        ? Math.random() * 20
                        : -Math.random() * 10);

                const result =
                  item.limitDirection === "up"
                    ? randomValue >= limitValue
                      ? "PASS"
                      : "FAIL"
                    : randomValue <= limitValue
                    ? "PASS"
                    : "FAIL";

                return {
                  ...item,
                  currentValue: parseFloat(randomValue.toFixed(2)),
                  result,
                  isCompleted: true,
                };
              }
              return item;
            })
          );
          resolve();
        }, 2000); // 2초 딜레이
      });
    },
    [setSafetyItems]
  );

  // 순차적 검사 실행
  const runSequentialInspection = useCallback(async () => {
    const selectedModel = inspectionModels.find(
      (m) => m.id === selectedModelId
    );
    if (!selectedModel) return;

    try {
      // 1. 내전압 검사 (P1)
      setCurrentStep("내전압 검사 중...");
      await simulateInspection("dielectric", selectedModel.p1_lower_limit);

      // 2. 절연저항 검사 (P2)
      setCurrentStep("절연저항 검사 중...");
      await simulateInspection("insulation", selectedModel.p2_lower_limit);

      // 3. 접지연속 검사 (P3)
      setCurrentStep("접지연속 검사 중...");
      await simulateInspection("ground", selectedModel.p3_lower_limit);

      setCurrentStep("검사 완료");
      setStatus("completed");
    } catch (err) {
      setError("검사 중 오류가 발생했습니다");
      setStatus("error");
    }
  }, [inspectionModels, selectedModelId, simulateInspection]);

  // 바코드 제출 처리
  const handleBarcodeSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();

      if (!barcode.trim()) return;

      setStatus("running");
      setError(null);
      setCurrentStep("검사 시작");

      // 모든 항목 초기화
      setSafetyItems((items) =>
        items.map((item) => ({
          ...item,
          currentValue: null,
          result: "PENDING",
          isCompleted: false,
        }))
      );

      // 순차적으로 검사 실행
      await runSequentialInspection();
    },
    [barcode, runSequentialInspection]
  );

  /**
   * 바코드 데이터 수신 시 처리 함수
   * @param barcodeData 수신된 바코드 문자열
   */
  const handleBarcodeReceived = useCallback(
    (barcodeData: string): void => {
      const trimmedBarcode = barcodeData.trim();
      setBarcode(trimmedBarcode);
      setLastScannedBarcode(trimmedBarcode);

      // 자동으로 검사 시작
      if (trimmedBarcode) {
        handleBarcodeSubmit();
      }
    },
    [setBarcode, setLastScannedBarcode, handleBarcodeSubmit]
  );

  // 검사 페이지 초기화
  const initializeSafetyInspectionPage = useCallback(async () => {
    console.log("🚀 [FRONTEND] initializeSafetyInspectionPage 함수 시작");
    console.log("🔧 [FRONTEND] 안전검사 페이지 초기화 시작");

    try {
      // 1. 검사 모델 로드
      console.log("📋 [FRONTEND] 1단계: 검사 모델 로드 시작");
      await loadInspectionModels();
      console.log("✅ [FRONTEND] 1단계: 검사 모델 로드 완료");

      // 2. 설비 목록 조회 (SAFETY_TESTER만)
      console.log("🔌 [FRONTEND] 2단계: 안전시험기 목록 조회 시작");
      await loadSafetyTesterDevices();
      console.log("✅ [FRONTEND] 2단계: 안전시험기 목록 조회 완료");

      // 3. 바코드 스캐너 목록 조회 (BARCODE_SCANNER만)
      console.log("📱 [FRONTEND] 3단계: 바코드 스캐너 목록 조회 시작");
      await loadBarcodeScannerDevices();
      console.log("✅ [FRONTEND] 3단계: 바코드 스캐너 목록 조회 완료");

      console.log(
        "✅ [FRONTEND] 안전검사 페이지 초기화 완료 - 수동 연결 버튼을 사용하세요"
      );
    } catch (error) {
      console.error("❌ [FRONTEND] 안전검사 페이지 초기화 중 오류 발생!");
      console.error("📋 [FRONTEND] 초기화 에러 상세:", {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 페이지 진입 시 초기화
  useEffect(() => {
    initializeSafetyInspectionPage();
  }, [initializeSafetyInspectionPage]);

  // 안전시험기 목록 로드
  const loadSafetyTesterDevices = useCallback(async () => {
    console.log("🚀 [FRONTEND] loadSafetyTesterDevices 함수 시작");

    try {
      console.log("🔌 [FRONTEND] 안전시험기 목록 조회 중...");
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

      const safetyDevices = allDevices.filter(
        (device: any) => device.device_type === "SAFETY_TESTER"
      );
      console.log("🔌 [FRONTEND] 필터링된 안전시험기:", safetyDevices);

      if (safetyDevices.length === 0) {
        console.log("⚠️ [FRONTEND] 등록된 안전시험기가 없음");
        setDeviceConnectionStatus("disconnected");
        setConnectionError(
          "등록된 안전시험기가 없습니다. 장비 관리에서 설비를 등록해주세요."
        );
        return;
      }

      console.log(`✅ [FRONTEND] ${safetyDevices.length}개의 안전시험기 발견`);
      console.log("🔄 [FRONTEND] 디바이스 목록 상태 업데이트 중...");

      setConnectedDevices(safetyDevices);
      setDeviceConnectionStatus("disconnected");
      setConnectionError("");

      console.log("✅ [FRONTEND] 안전시험기 목록 로드 완료");
    } catch (error) {
      console.error("❌ [FRONTEND] 안전시험기 목록 조회 실패!");
      console.error("📋 [FRONTEND] 에러 상세:", {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      setDeviceConnectionStatus("error");
      setConnectionError(`안전시험기 목록 조회 실패: ${error}`);
    }
  }, [setConnectionError, setConnectedDevices, setDeviceConnectionStatus]);

  // 바코드 스캐너 목록 로드
  const loadBarcodeScannerDevices = useCallback(async () => {
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
  }, [setBarcodeConnectionError, setBarcodeConnectionStatus, setBarcodePort]);

  // WebSocket 메시지 처리
  useEffect(() => {
    if (lastMessage && lastMessage.type === "barcode_scanned") {
      const barcodeData = lastMessage.data?.barcode;
      if (barcodeData) {
        handleBarcodeReceived(barcodeData);
      }
    }
  }, [lastMessage, handleBarcodeReceived]);

  // inspection 페이지와 동일한 모델 로딩 로직
  const loadInspectionModels = useCallback(async () => {
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
      setError("검사 모델을 불러올 수 없습니다");
    } finally {
      setIsLoadingModels(false);
    }
  }, [setIsLoadingModels, setInspectionModels, setSelectedModelId]);

  // 안전시험기 수동 연결
  const connectSafetyTester = async () => {
    console.log("🚀 [FRONTEND] connectSafetyTester 함수 시작");
    console.log("📊 [FRONTEND] 현재 상태:", {
      connectedDevices: connectedDevices,
      deviceConnectionStatus: deviceConnectionStatus,
      connectionError: connectionError,
    });

    if (connectedDevices.length === 0) {
      console.log("❌ [FRONTEND] 연결할 안전시험기가 없음");
      setConnectionError("연결할 안전시험기가 없습니다.");
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
      console.error("❌ [FRONTEND] 안전시험기 연결 오류!");
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

  // inspection 페이지 호환 함수들
  const getStatusBadge = () => {
    if (!wsConnected) {
      return <Badge variant="destructive">연결 끊김</Badge>;
    }
    if (status === "running") {
      return <Badge variant="default">검사 중</Badge>;
    }
    if (status === "completed") {
      return <Badge variant="secondary">완료</Badge>;
    }
    if (status === "error") {
      return <Badge variant="destructive">오류</Badge>;
    }
    return <Badge variant="secondary">대기 중</Badge>;
  };

  const getProgressBar = () => {
    if (!virtualStatus.progress) return null;

    return (
      <div className="w-full bg-secondary rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${virtualStatus.progress}%` }}
        />
      </div>
    );
  };

  const handleStartListening = async () => {
    // 바코드 스캐너 연결 시작
    if (barcodePort && !barcodeListening) {
      await connectBarcodeScanner();
    }
    // safety-inspection에서는 바로 검사 시작
    setStatus("running");
  };

  const handleStopInspection = async () => {
    // 바코드 스캐너 연결 중지
    if (barcodeListening) {
      try {
        await apiClient.stopBarcodeListening();
        setBarcodeListening(false);
        setBarcodeConnectionStatus("disconnected");
        setBarcodeConnectionError("");
      } catch (error) {
        console.error("바코드 스캐너 중지 오류:", error);
      }
    }
    // safety-inspection에서는 바로 검사 중지
    setStatus("idle");
    setCurrentStep(null);
    setError(null);
  };

  const refreshStatus = () => {
    // 상태 새로고침 (빈 함수)
  };

  // 검사 중지
  const stopInspection = () => {
    setStatus("idle");
    setCurrentStep(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">3대 안전검사</h1>
        <p className="text-muted-foreground">
          내전압, 절연저항, 접지연속 검사를 순차적으로 수행합니다
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
              onClick={() => setError(null)}
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
              {/* 안전시험기 연결 상태 */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    안전시험기
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
                      <Shield className="h-3 w-3 mr-1" />
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
                    안전시험기 연결 중...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {connectionError && (
                      <div className="text-xs text-red-600 p-2 bg-red-50 border border-red-200 rounded">
                        {connectionError}
                      </div>
                    )}
                    <Button
                      onClick={connectSafetyTester}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      disabled={connectedDevices.length === 0}
                    >
                      <Activity className="h-3 w-3 mr-1" />
                      안전시험기 연결
                    </Button>
                  </div>
                )}
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

              {getProgressBar()}

              {/* 검사 모델 선택 */}
              <div className="space-y-2">
                <Label htmlFor="inspection-model">검사 모델</Label>
                <Select
                  value={selectedModelId?.toString() || ""}
                  onValueChange={(value: string) =>
                    setSelectedModelId(parseInt(value))
                  }
                  disabled={isLoadingModels || virtualStatus.is_listening}
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
                    disabled={!barcodeListening || isLoading}
                    className={
                      barcodeListening ? "bg-green-50 border-green-200" : ""
                    }
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!barcodeListening || !barcode.trim() || isLoading}
                    title="바코드 검사 시작"
                  >
                    <Scan className="h-4 w-4" />
                  </Button>
                </div>
              </form>

              {/* 제어 버튼 */}
              <div className="flex gap-2">
                {!barcodeListening ? (
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

        {/* 3대 안전검사 결과 */}
        <div className="lg:col-span-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {safetyItems.map((item, index) => (
              <Card
                key={item.id}
                className={`relative ${
                  item.result === "PASS"
                    ? "ring-2 ring-green-500"
                    : item.result === "FAIL"
                    ? "ring-2 ring-red-500"
                    : status === "running" && currentStep?.includes(item.name)
                    ? "ring-2 ring-blue-500"
                    : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {item.result === "PASS" && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      {item.result === "FAIL" && (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      {item.result === "PENDING" &&
                        status === "running" &&
                        currentStep?.includes(item.name) && (
                          <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
                        )}
                      {item.result === "PENDING" &&
                        !(
                          status === "running" &&
                          currentStep?.includes(item.name)
                        ) && <Clock className="h-5 w-5 text-slate-400" />}
                      {item.name}
                    </CardTitle>
                    <Badge
                      variant={
                        item.result === "PASS"
                          ? "default"
                          : item.result === "FAIL"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {item.result}
                    </Badge>
                  </div>
                  <CardDescription>{item.nameEn}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 검사 기준 */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">검사 기준</div>
                    <div className="bg-slate-50 p-3 rounded space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>출력:</span>
                        <span className="font-mono">{item.sourceVoltage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>기준:</span>
                        <span className="font-mono">
                          {item.limitDirection === "up" ? "≥" : "≤"}{" "}
                          {item.limitValue}
                          {item.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 측정 결과 */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">측정 결과</div>
                    <div
                      className={`p-4 rounded text-center ${
                        item.result === "PASS"
                          ? "bg-green-50 border border-green-200"
                          : item.result === "FAIL"
                          ? "bg-red-50 border border-red-200"
                          : "bg-slate-50 border border-slate-200"
                      }`}
                    >
                      {item.currentValue !== null ? (
                        <div
                          className={`text-xl font-bold font-mono ${
                            item.result === "PASS"
                              ? "text-green-600"
                              : item.result === "FAIL"
                              ? "text-red-600"
                              : "text-slate-600"
                          }`}
                        >
                          {item.currentValue}
                          {item.unit}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xl font-mono">
                          --.--{item.unit}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>

                {/* 자동 검사 진행 오버레이 */}
                {status === "running" && currentStep?.includes(item.name) && (
                  <div className="absolute top-2 right-2 bg-white rounded-lg p-2 shadow-md border">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full animate-pulse bg-blue-500"></div>
                      <span className="text-xs font-medium text-blue-600">
                        검사 중
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* 전체 결과 요약 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                검사 결과 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center p-3 bg-slate-100 rounded">
                  <div className="text-xl font-bold text-slate-800">
                    {safetyItems.length}
                  </div>
                  <div className="text-xs text-slate-600">총 항목</div>
                </div>
                <div className="text-center p-3 bg-blue-100 rounded">
                  <div className="text-xl font-bold text-blue-600">
                    {completedItems}
                  </div>
                  <div className="text-xs text-blue-600">완료</div>
                </div>
                <div className="text-center p-3 bg-green-100 rounded">
                  <div className="text-xl font-bold text-green-600">
                    {passedItems}
                  </div>
                  <div className="text-xs text-green-600">합격</div>
                </div>
                <div className="text-center p-3 bg-red-100 rounded">
                  <div className="text-xl font-bold text-red-600">
                    {failedItems}
                  </div>
                  <div className="text-xs text-red-600">불합격</div>
                </div>
                <div
                  className={`text-center p-3 rounded ${
                    overallResult === "PASS"
                      ? "bg-green-200"
                      : overallResult === "FAIL"
                      ? "bg-red-200"
                      : "bg-slate-200"
                  }`}
                >
                  <div
                    className={`text-xl font-bold ${
                      overallResult === "PASS"
                        ? "text-green-800"
                        : overallResult === "FAIL"
                        ? "text-red-800"
                        : "text-slate-800"
                    }`}
                  >
                    {overallResult}
                  </div>
                  <div
                    className={`text-xs ${
                      overallResult === "PASS"
                        ? "text-green-700"
                        : overallResult === "FAIL"
                        ? "text-red-700"
                        : "text-slate-700"
                    }`}
                  >
                    최종 판정
                  </div>
                </div>
              </div>
              {barcode && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="text-sm text-slate-600">검사 대상</div>
                  <div className="text-lg font-mono font-bold text-slate-800">
                    {barcode}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
