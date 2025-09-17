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
  Power,
  Target,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  useInspectionStore,
  type SafetyInspectionItem,
} from "@/stores/useInspectionStore";
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

// 3대 안전검사 항목 인터페이스는 store에서 관리됨

// 실시간 로그 인터페이스 (inspection 페이지와 동일)
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
      case "storeError":
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

// 검사 상태는 store에서 관리됨

export default function SafetyInspectionPage() {
  // useInspectionStore 사용 (inspection 페이지와 동일)
  const store = useInspectionStore();
  const [isMounted, setIsMounted] = useState(false);

  // safety-inspection 전용 상태 (이제 store에서 관리)
  const [logs, setLogs] = useState<MessageLog[]>([]);

  // store에서 안전시험 상태 가져오기
  const {
    safetyInspectionStatus,
    safetyInspectionItems,
    currentSafetyStep,
    error: storeError,
    connectedPowerMeter,
    powerMeterStatus,
  } = store;

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

  // 가상 상태 객체 (inspection 페이지 호환성을 위해)
  const virtualStatus = {
    is_listening:
      safetyInspectionStatus === "running" && store.sseStatus === "connected",
    connected_devices: store.sseStatus === "connected" ? 1 : 0,
    total_devices: 1,
    current_barcode: barcode || null,
    phase: safetyInspectionStatus === "running" ? currentSafetyStep : null,
    progress: null,
  };

  // 가상 타이머 설정 (inspection 페이지 호환성을 위해)
  const timerSettings = {
    autoProgress: true,
  };

  // 가상 자동검사 상태 (inspection 페이지 호환성을 위해)
  const autoInspection = {
    isRunning: false,
    currentSafetyStep: null,
    currentPhase: null,
    remainingTime: 0,
  };

  // 3대 안전검사 항목은 store에서 관리

  // 실시간 로그 상태 (inspection 페이지와 동일)
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // 계산된 값들 (store에서 관리)
  const completedItems = safetyInspectionItems.filter(
    (item) => item.isCompleted
  ).length;
  const passedItems = safetyInspectionItems.filter(
    (item) => item.result === "PASS"
  ).length;
  const failedItems = safetyInspectionItems.filter(
    (item) => item.result === "FAIL"
  ).length;
  const overallResult =
    failedItems > 0
      ? "FAIL"
      : completedItems === safetyInspectionItems.length
      ? "PASS"
      : "PENDING";

  // 실시간 로그 추가 함수 (inspection 페이지와 동일)
  const addLog = useCallback((type: MessageLog["type"], message: string) => {
    const newLog: MessageLog = {
      timestamp: new Date().toLocaleTimeString("ko-KR"),
      type,
      message,
    };
    setLogs((prev) => [...prev.slice(-19), newLog]); // 최대 20개까지만 유지
  }, []);

  // 안전시험기 응답 파싱 함수 (애뮬레이터 응답 형식에 맞게 수정)
  const parseSafetyResponse = useCallback(
    (
      response: string,
      itemId: string
    ): { value: number; result: "PASS" | "FAIL" } => {
      try {
        console.log(`🔍 [SAFETY] 파싱할 응답: "${response}" (항목: ${itemId})`);

        // 애뮬레이터 응답 형식: "ACW,1000.0V,0.374mA,0.5mA,PASS"
        const parts = response.split(",");
        console.log(`🔍 [SAFETY] 분할된 부분들:`, parts);

        if (parts.length >= 5 && parts[2] && parts[4]) {
          // parts[0]: 테스트 타입 (ACW, IR, GB)
          // parts[1]: 전압 (1000.0V)
          // parts[2]: 측정값 (0.374mA, 0.66MΩ, 0.045Ω)
          // parts[3]: 기준값 (0.5mA, 1.0MΩ, 0.100Ω)
          // parts[4]: 결과 (PASS, FAIL)

          const result = parts[4].trim() === "PASS" ? "PASS" : "FAIL";
          const valueStr = parts[2].trim();

          console.log(`🔍 [SAFETY] 측정값 문자열: "${valueStr}"`);

          // 값 추출 (단위 제거)
          let value = 0;
          if (itemId === "dielectric") {
            // mA 단위: "0.374mA" -> 0.374
            value = parseFloat(valueStr.replace(/mA/i, ""));
          } else if (itemId === "insulation") {
            // MΩ 단위: "0.66MΩ" -> 0.66
            value = parseFloat(valueStr.replace(/MΩ/i, ""));
          } else if (itemId === "ground") {
            // Ω 단위: "0.045Ω" -> 0.045
            value = parseFloat(valueStr.replace(/Ω/i, ""));
          }

          console.log(`🔍 [SAFETY] 파싱된 값: ${value}, 결과: ${result}`);
          return { value: isNaN(value) ? 0 : value, result };
        }
      } catch (storeError) {
        console.error("응답 파싱 오류:", storeError);
      }

      console.log(`❌ [SAFETY] 파싱 실패, 기본값 반환`);
      return { value: 0, result: "FAIL" };
    },
    []
  );

  // 안전시험기 명령 실행 함수
  const executeSafetyCommand = useCallback(
    async (
      deviceId: number,
      command: string,
      itemId: string
    ): Promise<{
      success: boolean;
      response?: string;
      storeError?: string;
    }> => {
      try {
        setIsExecutingCommand(true);

        // 명령 전송 로그
        console.log(
          `🚀 [SAFETY] 명령 전송 시작: ${command} (디바이스 ID: ${deviceId})`
        );
        addLog("INFO", `[안전시험기] 명령 전송: ${command}`);

        const response = await apiClient.sendCommand(deviceId, command, 2.0); // 2초 대기
        console.log(`📡 [SAFETY] API 응답 받음:`, response);

        if (
          response &&
          typeof response === "object" &&
          "success" in response &&
          response.success &&
          "response" in response &&
          response.response
        ) {
          // 응답 수신 로그
          console.log(
            `✅ [SAFETY] 응답 수신 성공: ${String(response.response)}`
          );
          addLog(
            "SUCCESS",
            `[안전시험기] 원데이터: ${String(response.response)}`
          );

          // 응답 파싱하여 결과 추출
          const result = parseSafetyResponse(String(response.response), itemId);

          return {
            success: true,
            response: String(response.response),
          };
        } else {
          const storeErrorMsg = "명령 실행 실패: 응답 없음";
          console.log(`❌ [SAFETY] 응답 없음:`, response);
          addLog("ERROR", `[안전시험기] ${storeErrorMsg}`);
          return {
            success: false,
            storeError: storeErrorMsg,
          };
        }
      } catch (storeError) {
        const storeErrorMsg = `명령 실행 오류: ${storeError}`;
        console.log(`💥 [SAFETY] 명령 실행 오류:`, storeError);
        addLog("ERROR", `[안전시험기] ${storeErrorMsg}`);
        return {
          success: false,
          storeError: storeErrorMsg,
        };
      } finally {
        setIsExecutingCommand(false);
      }
    },
    [addLog, parseSafetyResponse]
  );

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
        // 오빠룰: 'console.storeError'는 존재하지 않으므로 console.error로 변경
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

  // 실제 안전시험기 검사 함수
  const executeSafetyInspection = useCallback(
    async (itemId: string, limitValue: number): Promise<void> => {
      // store에서 직접 안전시험기 찾기 (inspection 페이지와 동일한 방식)
      const devices = (await apiClient.getDevices()) as DeviceInfo[];
      console.log("🔍 [SAFETY] 전체 디바이스 목록:", devices);

      // 안전시험기만 먼저 필터링
      const allSafetyDevices = devices.filter(
        (device: any) => device.device_type === "SAFETY_TESTER"
      );
      console.log(
        "🔍 [SAFETY] 모든 안전시험기 (연결 상태 무관):",
        allSafetyDevices
      );

      // 각 안전시험기의 연결 상태 확인
      allSafetyDevices.forEach((device, index) => {
        console.log(`🔍 [SAFETY] 안전시험기 ${index + 1}:`, {
          name: device.name,
          device_type: device.device_type,
          connected: device.connected,
          connection_status: device.connection_status,
          id: device.id,
        });
      });

      const safetyDevices = allSafetyDevices.filter(
        (device: any) =>
          device.connected || device.connection_status === "CONNECTED"
      );

      console.log(
        "🔍 [SAFETY] 필터링된 안전시험기 (connected=true):",
        safetyDevices
      );
      console.log("🔍 [SAFETY] 안전시험기 개수:", safetyDevices.length);

      if (safetyDevices.length === 0) {
        console.log("❌ [SAFETY] 연결된 안전시험기가 없음");
        addLog("ERROR", "[안전시험기] 연결된 안전시험기가 없습니다.");
        return;
      }

      const connectedDevice = safetyDevices[0];
      if (!connectedDevice) {
        console.log("❌ [SAFETY] 연결된 안전시험기 디바이스가 없음");
        addLog("ERROR", "[안전시험기] 연결된 안전시험기 디바이스가 없습니다.");
        return;
      }

      const item = safetyInspectionItems.find((item) => item.id === itemId);
      if (!item) {
        addLog("ERROR", `[안전시험기] 검사 항목을 찾을 수 없습니다: ${itemId}`);
        return;
      }

      try {
        // 안전시험기 명령 실행
        const result = await executeSafetyCommand(
          connectedDevice.id,
          item.command,
          itemId
        );

        if (result.success && result.response) {
          // 응답 파싱
          const parsedResult = parseSafetyResponse(result.response, itemId);

          // 결과 업데이트
          const updatedItems = safetyInspectionItems.map((safetyItem) => {
            if (safetyItem.id === itemId) {
              return {
                ...safetyItem,
                currentValue: parsedResult.value,
                result: parsedResult.result,
                isCompleted: true,
                response: result.response,
                error: undefined,
              };
            }
            return safetyItem;
          });
          store.setSafetyInspectionItems(updatedItems);
        } else {
          // 오류 처리
          const updatedItems = safetyInspectionItems.map((safetyItem) => {
            if (safetyItem.id === itemId) {
              return {
                ...safetyItem,
                result: "FAIL" as const,
                isCompleted: true,
                error: result.storeError,
              };
            }
            return safetyItem;
          });
          store.setSafetyInspectionItems(updatedItems);
        }
      } catch (storeError) {
        addLog("ERROR", `[안전시험기] 검사 실행 오류: ${storeError}`);
        const updatedItems = safetyInspectionItems.map((safetyItem) => {
          if (safetyItem.id === itemId) {
            return {
              ...safetyItem,
              result: "FAIL" as const,
              isCompleted: true,
              error: String(storeError),
            };
          }
          return safetyItem;
        });
        store.setSafetyInspectionItems(updatedItems);
      }
    },
    [
      connectedDevices,
      safetyInspectionItems,
      store,
      executeSafetyCommand,
      parseSafetyResponse,
      addLog,
    ]
  );

  // 순차적 검사 실행은 store에서 관리됨

  // inspection 페이지와 동일한 검사 시작 함수
  const handleStartInspection = useCallback(() => {
    const barcode = store.currentBarcode || `TEST_${Date.now()}`;
    store.startSafetyInspection(barcode);
    addLog("INFO", `안전시험 시작: ${barcode}`);
  }, [store, addLog]);

  // 바코드 제출 처리 (inspection 페이지와 동일)
  const handleBarcodeSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      handleStartInspection();
    },
    [handleStartInspection]
  );

  /**
   * 바코드 데이터 수신 시 처리 함수 (inspection 페이지와 동일한 방식)
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
    } catch (storeError) {
      console.error("❌ [FRONTEND] 안전검사 페이지 초기화 중 오류 발생!");
      console.error("📋 [FRONTEND] 초기화 에러 상세:", {
        storeError: storeError,
        message:
          storeError instanceof Error ? storeError.message : String(storeError),
        stack: storeError instanceof Error ? storeError.stack : undefined,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE는 useInspectionStore에서 관리됨

  // inspection 페이지와 동일한 초기화 로직
  useEffect(() => {
    setIsMounted(true);
    store.initialize();

    const handleBeforeUnload = () => {
      store.disconnectAll();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // safety-inspection 전용 초기화
  useEffect(() => {
    if (isMounted) {
      initializeSafetyInspectionPage();
    }
  }, [isMounted, initializeSafetyInspectionPage]);

  // 바코드 수신 처리 (inspection 페이지와 동일한 방식)
  useEffect(() => {
    if (!isMounted || !store.currentBarcode) return;

    if (store.currentBarcode !== barcode) {
      console.log("📱 [SAFETY] 바코드 수신됨:", store.currentBarcode);
      handleBarcodeReceived(store.currentBarcode);
    }
  }, [isMounted, store.currentBarcode, barcode, handleBarcodeReceived]);

  // 안전시험 항목 변화 감지하여 로그 추가
  useEffect(() => {
    if (!isMounted) return;

    safetyInspectionItems.forEach((item) => {
      if (item.isCompleted && item.currentValue !== null) {
        const resultText = item.result === "PASS" ? "합격" : "불합격";
        addLog(
          item.result === "PASS" ? "SUCCESS" : "ERROR",
          `[${item.name}] ${item.currentValue}${item.unit} - ${resultText}`
        );
      }
    });
  }, [isMounted, safetyInspectionItems, addLog]);

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
    } catch (storeError) {
      console.error("❌ [FRONTEND] 안전시험기 목록 조회 실패!");
      console.error("📋 [FRONTEND] 에러 상세:", {
        storeError: storeError,
        message:
          storeError instanceof Error ? storeError.message : String(storeError),
        stack: storeError instanceof Error ? storeError.stack : undefined,
      });

      setDeviceConnectionStatus("error");
      setConnectionError(`안전시험기 목록 조회 실패: ${storeError}`);
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
    } catch (storeError) {
      console.error("❌ [FRONTEND] 바코드 스캐너 목록 조회 실패!");
      console.error("📋 [FRONTEND] 에러 상세:", {
        storeError: storeError,
        message:
          storeError instanceof Error ? storeError.message : String(storeError),
        stack: storeError instanceof Error ? storeError.stack : undefined,
      });

      setBarcodeConnectionStatus("error");
      setBarcodeConnectionError(`바코드 스캐너 목록 조회 실패: ${storeError}`);
    }
  }, [setBarcodeConnectionError, setBarcodeConnectionStatus, setBarcodePort]);

  // SSE 메시지 처리는 connectSse 함수에서 처리됨

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
      store.setError("검사 모델을 불러올 수 없습니다");
    } finally {
      setIsLoadingModels(false);
    }
  }, [setIsLoadingModels, setInspectionModels, setSelectedModelId, store]);

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
        const storeErrorText = await response.text();
        console.error(`❌ [FRONTEND] ${targetDevice.name} 연결 실패!`);
        console.error("📋 [FRONTEND] 에러 응답:", {
          status: response.status,
          statusText: response.statusText,
          storeErrorText: storeErrorText,
        });

        setDeviceConnectionStatus("error");
        setConnectionError(`연결 실패: ${storeErrorText}`);
      }
    } catch (storeError) {
      console.error("❌ [FRONTEND] 안전시험기 연결 오류!");
      console.error("📋 [FRONTEND] 에러 상세:", {
        storeError: storeError,
        message:
          storeError instanceof Error ? storeError.message : String(storeError),
        stack: storeError instanceof Error ? storeError.stack : undefined,
      });

      setDeviceConnectionStatus("error");
      setConnectionError(`연결 오류: ${storeError}`);
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
        const storeErrorMessage =
          result && typeof result === "object" && "message" in result
            ? String((result as any).message)
            : "바코드 스캐너 연결 실패";
        console.error("❌ [FRONTEND] 바코드 스캐너 연결 실패!");
        console.error("📋 [FRONTEND] 에러 메시지:", storeErrorMessage);
        console.error("📋 [FRONTEND] 원본 응답:", result);

        setBarcodeConnectionStatus("error");
        setBarcodeConnectionError(storeErrorMessage);
      }
    } catch (storeError) {
      console.error("❌ [FRONTEND] 바코드 스캐너 연결 오류!");
      console.error("📋 [FRONTEND] 에러 상세:", {
        storeError: storeError,
        message:
          storeError instanceof Error ? storeError.message : String(storeError),
        stack: storeError instanceof Error ? storeError.stack : undefined,
      });

      setBarcodeConnectionStatus("error");
      setBarcodeConnectionError(`연결 오류: ${storeError}`);
    }
  };

  // 검사 중지 함수
  const handleStopInspection = async () => {
    try {
      // 바코드 스캐너 연결 중지
      if (barcodeListening) {
        try {
          await apiClient.stopBarcodeListening();
          setBarcodeListening(false);
          setBarcodeConnectionStatus("disconnected");
          setBarcodeConnectionError("");
        } catch (storeError) {
          console.warn(
            "바코드 스캐너 중지 API 호출 실패, 로컬에서만 중지:",
            storeError
          );
          // API 호출 실패해도 로컬 상태는 중지
          setBarcodeListening(false);
          setBarcodeConnectionStatus("disconnected");
          setBarcodeConnectionError("");
        }
      }

      // 검사 상태 중지
      store.setSafetyInspectionStatus("idle");
      store.setCurrentStep(null);

      // 진행 중인 안전 시험 항목들을 PENDING으로 리셋
      const resetItems = safetyInspectionItems.map((item) => ({
        ...item,
        result: "PENDING" as const,
        isCompleted: false,
        currentValue: null,
      }));
      store.setSafetyInspectionItems(resetItems);

      // 로그에 중지 메시지 추가
      addLog("INFO", "검사가 사용자에 의해 중지되었습니다.");
    } catch (storeError) {
      console.error("검사 중지 처리 중 오류:", storeError);
      // 오류가 발생해도 강제로 중지
      store.setSafetyInspectionStatus("idle");
      store.setCurrentStep(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">3대 안전검사</h1>
      </div>

      {storeError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {storeError}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => store.setError(null)}
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
              {/* 안전시험기 상태 */}
              <div>
                <Label>안전시험기</Label>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                  <div className="flex flex-col">
                    <StatusBadge status={deviceConnectionStatus} />
                    {connectedDevices.length > 0 && (
                      <div className="text-xs text-gray-600 mt-1">
                        {connectedDevices[0]?.port} /{" "}
                        {connectedDevices[0]?.baud_rate || "N/A"}
                      </div>
                    )}
                  </div>
                  {deviceConnectionStatus !== "connected" && (
                    <Button
                      onClick={connectSafetyTester}
                      size="sm"
                      variant="outline"
                      disabled={
                        deviceConnectionStatus === "connecting" ||
                        connectedDevices.length === 0
                      }
                    >
                      연결
                    </Button>
                  )}
                </div>
                {connectionError && (
                  <p className="text-xs text-red-500 mt-1">{connectionError}</p>
                )}
              </div>

              {/* 바코드 스캐너 상태 */}
              <div>
                <Label>바코드 스캐너</Label>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                  <div className="flex flex-col">
                    <StatusBadge
                      status={
                        barcodeListening ? "connected" : barcodeConnectionStatus
                      }
                    />
                    {barcodePort && (
                      <div className="text-xs text-gray-600 mt-1">
                        {barcodePort} / 9600
                      </div>
                    )}
                  </div>
                  {barcodeConnectionStatus !== "connected" &&
                    !barcodeListening && (
                      <Button
                        onClick={connectBarcodeScanner}
                        size="sm"
                        variant="outline"
                        disabled={
                          barcodeConnectionStatus === "connecting" ||
                          !barcodePort
                        }
                      >
                        연결
                      </Button>
                    )}
                </div>
                {barcodeConnectionError && (
                  <p className="text-xs text-red-500 mt-1">
                    {barcodeConnectionError}
                  </p>
                )}
              </div>

              {/* 실시간 연결 상태 */}
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

              {/* 검사 모델 선택 */}
              <div>
                <Label>검사 모델</Label>
                <Select
                  value={store.selectedModelId?.toString() || ""}
                  onValueChange={(value: string) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue)) {
                      store.setSelectedModelId(numValue);
                    }
                  }}
                  disabled={
                    store.isLoading || safetyInspectionStatus === "running"
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

              {/* 바코드 입력 */}
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
                        store.selectedModelId &&
                        deviceConnectionStatus === "connected"
                      ) {
                        handleBarcodeSubmit();
                      }
                    }}
                    placeholder={
                      store.isBarcodeScannerListening
                        ? "바코드 스캔 대기 중..."
                        : "바코드 스캔 또는 입력"
                    }
                    disabled={safetyInspectionStatus === "running"}
                    className={
                      store.isBarcodeScannerListening
                        ? "border-green-500 bg-green-50"
                        : ""
                    }
                  />
                  <Button
                    onClick={handleBarcodeSubmit}
                    size="icon"
                    disabled={safetyInspectionStatus === "running"}
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

              {/* 제어 버튼 */}
              <div className="flex gap-2">
                {safetyInspectionStatus !== "running" ? (
                  <Button
                    onClick={handleBarcodeSubmit}
                    disabled={
                      !store.selectedModelId ||
                      deviceConnectionStatus !== "connected"
                    }
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    검사 시작
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopInspection}
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

        {/* 3대 안전검사 결과 */}
        <div className="lg:col-span-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {safetyInspectionItems.map((item, index) => (
              <Card
                key={item.id}
                className={`relative ${
                  item.result === "PASS"
                    ? "ring-2 ring-green-500"
                    : item.result === "FAIL"
                    ? "ring-2 ring-red-500"
                    : safetyInspectionStatus === "running" &&
                      currentSafetyStep?.includes(item.name)
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
                        safetyInspectionStatus === "running" &&
                        currentSafetyStep?.includes(item.name) && (
                          <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
                        )}
                      {item.result === "PENDING" &&
                        !(
                          safetyInspectionStatus === "running" &&
                          currentSafetyStep?.includes(item.name)
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

                    {/* 응답 데이터 표시 */}
                    {item.response && (
                      <div className="text-xs bg-gray-100 p-2 rounded font-mono">
                        <div className="text-gray-600 mb-1">응답:</div>
                        <div className="text-gray-800 break-all">
                          {item.response}
                        </div>
                      </div>
                    )}

                    {/* 오류 메시지 표시 */}
                    {item.error && (
                      <div className="text-xs bg-red-100 p-2 rounded text-red-800">
                        <div className="font-medium mb-1">오류:</div>
                        <div className="break-all">{item.error}</div>
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* 자동 검사 진행 오버레이 */}
                {safetyInspectionStatus === "running" &&
                  currentSafetyStep?.includes(item.name) && (
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

          {/* 실시간 로그 (inspection 페이지와 동일) */}
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
