"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { useInspection } from "@/hooks/useInspection";
import { apiClient } from "@/lib/api";
import { PhaseChart } from "@/components/charts/PhaseChart";

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
    startListening,
    processBarcodeScann,
    stopInspection,
    refreshStatus,
    clearError,
    setBarcodeCallback,
  } = useInspection();

  const [barcode, setBarcode] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
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

  // 바코드 스캐너 관련 상태
  const [barcodeListening, setBarcodeListening] = useState(false);
  const [barcodePort, setBarcodePort] = useState<string>("");
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>("");

  // cleanup에서 현재 상태를 참조하기 위한 ref
  const barcodeListeningRef = useRef(barcodeListening);

  // ref 동기화
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

  // 검사 모델 목록 로드 및 바코드 스캐너 자동 시작
  useEffect(() => {
    loadInspectionModels();
    loadBarcodeSettings();
    loadTimerSettings();
  }, []);

  // 바코드 설정 로드 후 자동으로 스캔 시작
  useEffect(() => {
    if (barcodePort && !barcodeListening) {
      // 바코드 포트가 설정되어 있으면 자동으로 감청 시작
      startBarcodeListening();
    }
  }, [barcodePort]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 바코드 콜백 등록 및 cleanup
  useEffect(() => {
    if (setBarcodeCallback) {
      setBarcodeCallback(handleBarcodeReceived);
    }

    // 컴포넌트 언마운트 시 콜백 해제 및 바코드 감청 중지
    return () => {
      if (setBarcodeCallback) {
        setBarcodeCallback(null);
      }
      // ref를 사용하여 현재 상태 확인
      if (barcodeListeningRef.current) {
        stopBarcodeListening();
      }
    };
  }, [setBarcodeCallback, selectedModelId]);

  // 페이지 가시성 변경 시 바코드 스캐너 관리
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 페이지가 숨겨질 때 바코드 스캐너 중지
        if (barcodeListeningRef.current) {
          stopBarcodeListening();
        }
      } else {
        // 페이지가 다시 보일 때 바코드 스캐너 재시작
        if (barcodePort && !barcodeListeningRef.current) {
          startBarcodeListening();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [barcodePort]);

  // 측정 데이터를 단계별로 분리하여 차트 데이터로 변환
  useEffect(() => {
    if (measurementHistory.length > 0 && !isPaused) {
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
    }
  }, [measurementHistory, isPaused]);

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
      if (models && models.length > 0) {
        setSelectedModelId(models[0].id);
      }
    } catch (err) {
      console.error("검사 모델 로드 오류:", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // 바코드 스캐너 설정 로드 (devices 페이지에서 설정된 정보)
  const loadBarcodeSettings = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/v1/devices/barcode/status"
      );

      // 응답 상태 확인
      if (!response.ok) {
        console.error(
          `API 응답 오류: ${response.status} ${response.statusText}`
        );
        // API 오류 시 상태 초기화
        setBarcodePort("");
        setBarcodeListening(false);
        setLastScannedBarcode("");
        return;
      }

      // Content-Type 확인
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("응답이 JSON이 아닙니다:", contentType);
        const text = await response.text();
        console.error("응답 내용:", text);
        // JSON이 아닌 경우 상태 초기화
        setBarcodePort("");
        setBarcodeListening(false);
        setLastScannedBarcode("");
        return;
      }

      const data = await response.json();

      // 실제 연결 상태만 반영
      if (data.connected_port) {
        setBarcodePort(data.connected_port);
      } else {
        setBarcodePort("");
      }

      // 실제 감청 상태만 반영 (포트가 연결되어 있을 때만)
      if (data.is_listening && data.connected_port) {
        setBarcodeListening(true);
      } else {
        setBarcodeListening(false);
      }

      if (data.last_barcode) {
        setLastScannedBarcode(data.last_barcode);
      } else {
        setLastScannedBarcode("");
      }
    } catch (err) {
      console.error("바코드 설정 로드 실패:", err);
      // 에러 시 상태 초기화
      setBarcodePort("");
      setBarcodeListening(false);
      setLastScannedBarcode("");
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

      // 응답 상태 확인
      if (!response.ok) {
        console.error(
          `바코드 감청 시작 API 오류: ${response.status} ${response.statusText}`
        );
        setBarcodeListening(false);
        return;
      }

      // Content-Type 확인
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("바코드 감청 시작 응답이 JSON이 아닙니다:", contentType);
        const text = await response.text();
        console.error("응답 내용:", text);
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

      // 응답 상태 확인
      if (!response.ok) {
        console.error(
          `바코드 감청 중지 API 오류: ${response.status} ${response.statusText}`
        );
        return;
      }

      // Content-Type 확인
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("바코드 감청 중지 응답이 JSON이 아닙니다:", contentType);
        const text = await response.text();
        console.error("응답 내용:", text);
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

  // 바코드 데이터 수신 처리 (WebSocket에서 호출될 예정)
  const handleBarcodeReceived = (barcodeData: string) => {
    setBarcode(barcodeData.trim());
    setLastScannedBarcode(barcodeData.trim());

    // 자동 검사 기능이 활성화된 경우 자동 검사 프로세스 시작
    if (selectedModelId && barcodeData.trim() && timerSettings.autoProgress) {
      startAutoInspectionProcess(barcodeData.trim());
    } else if (selectedModelId && barcodeData.trim()) {
      // 수동 모드: 기존 로직 유지
      processBarcodeScann(barcodeData.trim(), selectedModelId);
    }
  };

  // 자동 검사 프로세스 시작
  const startAutoInspectionProcess = async (scanBarcode: string) => {
    console.log("자동 검사 프로세스 시작:", scanBarcode);

    // 기본 검사 시작
    if (selectedModelId) {
      await processBarcodeScann(scanBarcode, selectedModelId);
    }

    // SCPI 시험 자동 실행
    await executeInspectionRoutine(scanBarcode);

    // P1 준비 단계 시작
    startPhase("P1", "prepare", timerSettings.p1PrepareTime);
  };

  // 검사 루틴 실행 (GPT-9800 + WT310)
  const executeInspectionRoutine = async (barcode: string) => {
    addSCPILog(
      `검사 시작 - 바코드: ${barcode}`,
      "3대안전 + 전력측정 시작",
      true
    );

    try {
      // 1. 3대안전 시험 순환 실행
      const testTypes: Array<"ACW" | "DCW" | "IR" | "GB"> = [
        "ACW",
        "DCW",
        "IR",
        "GB",
      ];
      const testResults: Record<string, any> = {};

      for (const testType of testTypes) {
        addSCPILog(
          `${testType} 시험 시작`,
          `${testType} 시험 실행 중...`,
          true
        );

        // 시험 실행 (INIT)
        await executeSCPICommand("INIT");
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 시험 실행 대기

        // 상태 확인
        const statusResult = await executeSCPICommand("STAT?");

        if (statusResult.includes("READY")) {
          // 결과 조회
          const measureResult = await executeSCPICommand("MEAS?");

          // 결과 파싱
          const resultParts = measureResult.split(",");
          if (resultParts.length >= 2) {
            const testResult = resultParts[1].trim();
            const success = testResult === "PASS";

            testResults[testType] = {
              result: testResult,
              data: measureResult,
              success: success,
            };

            // 실제 측정 데이터로 차트 업데이트
            updateChartData(testType, measureResult, barcode);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 2. WT310 전력 측정
      addSCPILog("WT310 전력 측정 시작", "실시간 전력 측정", true);

      // 적산 시작
      await executeSCPICommand(":INTegrate:STARt");

      // 실시간 측정값 조회 (3회)
      for (let i = 0; i < 3; i++) {
        const measureResult = await executeSCPICommand(
          ":NUMeric:NORMal:VALue?"
        );

        // 결과 파싱
        const values = measureResult.split(",");
        if (values.length >= 4) {
          const voltage = parseFloat(values[0]);
          const current = parseFloat(values[1]);
          const power = parseFloat(values[2]);
          const frequency = parseFloat(values[3]);

          addSCPILog(
            `전력측정 ${i + 1}`,
            `V=${voltage.toFixed(2)}V, I=${current.toFixed(
              3
            )}A, P=${power.toFixed(2)}W`,
            true
          );

          // 실제 측정 데이터로 차트 업데이트 (P2 단계에 전력값 적용)
          updateChartData("POWER", power.toString(), barcode);
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // 적산값 조회
      const integrationResult = await executeSCPICommand(":INTegrate:VALue?");
      addSCPILog("전력량 적산 결과", `적산값: ${integrationResult}`, true);

      // 전체 결과 요약
      setSCPIExecution((prev) => ({
        ...prev,
        commandResults: {
          ...prev.commandResults,
          [barcode]: {
            testResults,
            powerData: integrationResult,
            timestamp: new Date().toISOString(),
            overallResult: Object.values(testResults).every(
              (r: any) => r.success
            )
              ? "PASS"
              : "FAIL",
          },
        },
      }));

      addSCPILog(
        `검사 완료 - ${barcode}`,
        `전체 결과: ${
          Object.values(testResults).every((r: any) => r.success)
            ? "PASS"
            : "FAIL"
        }`,
        Object.values(testResults).every((r: any) => r.success)
      );
    } catch (error) {
      addSCPILog(
        `검사 오류 - ${barcode}`,
        error instanceof Error ? error.message : String(error),
        false
      );
    }
  };

  // 차트 데이터 업데이트
  const updateChartData = (
    testType: string,
    result: string,
    barcode: string
  ) => {
    const timestamp = new Date().toISOString();
    const time = new Date().toLocaleTimeString("ko-KR");

    let value = 0;
    let phase = "P1";

    if (testType === "ACW" || testType === "DCW") {
      // 전압값 추출 (예: "1.500kV" -> 1.500)
      const voltageMatch = result.match(/(\d+\.\d+)kV/);
      if (voltageMatch) {
        value = parseFloat(voltageMatch[1]);
        phase = "P1";
      }
    } else if (testType === "IR") {
      // 저항값 추출 (예: "999M ohm" -> 999)
      const resistanceMatch = result.match(/(\d+)M ohm/);
      if (resistanceMatch) {
        value = parseFloat(resistanceMatch[1]);
        phase = "P2";
      }
    } else if (testType === "GB") {
      // 저항값 추출 (예: "0.05 ohm" -> 0.05)
      const resistanceMatch = result.match(/(\d+\.\d+) ohm/);
      if (resistanceMatch) {
        value = parseFloat(resistanceMatch[1]);
        phase = "P3";
      }
    } else if (testType === "POWER") {
      // 전력값 직접 사용
      value = parseFloat(result);
      phase = "P2";
    }

    const newDataPoint = {
      timestamp,
      time,
      value,
      barcode,
      result: value > 0 ? "PASS" : "FAIL",
    };

    // 해당 단계 차트에 데이터 추가
    if (phase === "P1") {
      setP1Data((prev) => [...prev, newDataPoint].slice(-20));
    } else if (phase === "P2") {
      setP2Data((prev) => [...prev, newDataPoint].slice(-20));
    } else if (phase === "P3") {
      setP3Data((prev) => [...prev, newDataPoint].slice(-20));
    }
  };

  // 단계별 타이머 시작
  const startPhase = (
    step: "P1" | "P2" | "P3",
    phase: "prepare" | "inspect",
    duration: number
  ) => {
    // 이전 타이머 정리
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setAutoInspection({
      isRunning: true,
      currentStep: step,
      currentPhase: phase,
      remainingTime: duration,
      totalTime: duration,
    });

    console.log(`${step} ${phase} 단계 시작 - ${duration}초`);

    let timeLeft = duration;
    timerRef.current = setInterval(() => {
      timeLeft -= 1;

      setAutoInspection((prev) => ({
        ...prev,
        remainingTime: timeLeft,
      }));

      if (timeLeft <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }

        // 다음 단계로 진행
        handlePhaseComplete(step, phase);
      }
    }, 1000);
  };

  // 단계 완료 후 다음 단계 진행
  const handlePhaseComplete = (
    step: "P1" | "P2" | "P3",
    phase: "prepare" | "inspect"
  ) => {
    console.log(`${step} ${phase} 단계 완료`);

    if (step === "P1") {
      if (phase === "prepare") {
        // P1 준비 완료 → P1 검사 시작
        startPhase("P1", "inspect", timerSettings.p1Duration);
      } else {
        // P1 검사 완료 → P2 준비 시작
        startPhase("P2", "prepare", timerSettings.p2PrepareTime);
      }
    } else if (step === "P2") {
      if (phase === "prepare") {
        // P2 준비 완료 → P2 검사 시작
        startPhase("P2", "inspect", timerSettings.p2Duration);
      } else {
        // P2 검사 완료 → P3 준비 시작
        startPhase("P3", "prepare", timerSettings.p3PrepareTime);
      }
    } else if (step === "P3") {
      if (phase === "prepare") {
        // P3 준비 완료 → P3 검사 시작
        startPhase("P3", "inspect", timerSettings.p3Duration);
      } else {
        // P3 검사 완료 → 자동 검사 종료
        completeAutoInspection();
      }
    }
  };

  // 자동 검사 완료
  const completeAutoInspection = () => {
    console.log("자동 검사 프로세스 완료");

    setAutoInspection({
      isRunning: false,
      currentPhase: null,
      currentStep: null,
      remainingTime: 0,
      totalTime: 0,
    });

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // SCPI 로그 추가 함수
  const addSCPILog = (command: string, result: string, success: boolean) => {
    setSCPIExecution((prev) => ({
      ...prev,
      executionLog: [
        {
          timestamp: new Date().toLocaleTimeString(),
          command,
          result,
          success,
        },
        ...prev.executionLog.slice(0, 19),
      ], // 최근 20개만 유지
    }));
  };

  // GPT-9800 3대안전 시험 루틴 실행
  const executeGPT9800Routine = async (
    testType: "ACW" | "DCW" | "IR" | "GB"
  ) => {
    setSCPIExecution((prev) => ({
      ...prev,
      isRunning: true,
      deviceType: "GPT-9800",
      currentCommand: `${testType} 시험 시작`,
    }));

    addSCPILog(`${testType} 시험 루틴 시작`, "시작됨", true);

    try {
      // 1. 모드 전환 (수동 모드)
      await executeSCPICommand("MAIN:FUNC MANU");
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 2. 시험 조건 확인 (이미 설정되어 있다고 가정)
      addSCPILog(`${testType} 시험 조건 확인`, "설정 완료", true);

      // 3. 시험 실행 (INIT)
      await executeSCPICommand("INIT");
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 시험 실행 대기

      // 4. 시험 상태 확인
      const statusResult = await executeSCPICommand("STAT?");

      if (statusResult.includes("COMPLETE") || statusResult.includes("READY")) {
        // 5. 결과 조회 (MEAS?)
        const measureResult = await executeSCPICommand("MEAS?");

        // 결과 파싱 (예: ">ACW, PASS, 1.500kV, 0.050mA, T=005.0S")
        const resultParts = measureResult.split(",");
        if (resultParts.length >= 2) {
          const testResult = resultParts[1].trim();
          const success = testResult === "PASS";

          addSCPILog(`${testType} 시험 결과`, measureResult, success);

          setSCPIExecution((prev) => ({
            ...prev,
            commandResults: {
              ...prev.commandResults,
              [testType]: {
                result: testResult,
                data: measureResult,
                success: success,
              },
            },
          }));
        }
      }
    } catch (error) {
      addSCPILog(
        `${testType} 시험 오류`,
        error instanceof Error ? error.message : String(error),
        false
      );
    }

    setSCPIExecution((prev) => ({
      ...prev,
      isRunning: false,
      currentCommand: "",
    }));
  };

  // WT310 전력 측정 루틴 실행
  const executeWT310Routine = async () => {
    setSCPIExecution((prev) => ({
      ...prev,
      isRunning: true,
      deviceType: "WT310",
      currentCommand: "전력 측정 시작",
    }));

    addSCPILog("WT310 전력 측정 루틴 시작", "시작됨", true);

    try {
      // 1. 출력 항목 설정 확인
      addSCPILog(
        "출력 항목 설정 확인",
        "U,I,P,FREQ,Q,S,LAMBDA,WP 설정 완료",
        true
      );

      // 2. 측정 범위 자동 설정
      await executeSCPICommand(":INPut1:VOLTage:RANGe AUTO");
      await executeSCPICommand(":INPut1:CURRent:RANGe AUTO");

      // 3. 업데이트 주기 설정
      await executeSCPICommand(":RATE 200MS");

      // 4. 적산 시작
      await executeSCPICommand(":INTegrate:STARt");
      addSCPILog("전력량 적산 시작", "적산 모드 활성화", true);

      // 5. 실시간 측정값 조회 (5회 반복)
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const measureResult = await executeSCPICommand(
          ":NUMeric:NORMal:VALue?"
        );

        // 결과 파싱 (U,I,P,FREQ,Q,S,LAMBDA,WP)
        const values = measureResult.split(",");
        if (values.length >= 4) {
          const voltage = parseFloat(values[0]);
          const current = parseFloat(values[1]);
          const power = parseFloat(values[2]);
          const frequency = parseFloat(values[3]);

          addSCPILog(
            `측정값 ${i + 1}`,
            `V=${voltage.toFixed(2)}V, I=${current.toFixed(
              3
            )}A, P=${power.toFixed(2)}W, F=${frequency.toFixed(1)}Hz`,
            true
          );

          setSCPIExecution((prev) => ({
            ...prev,
            commandResults: {
              ...prev.commandResults,
              [`measurement_${i + 1}`]: {
                voltage,
                current,
                power,
                frequency,
                timestamp: new Date().toISOString(),
              },
            },
          }));
        }
      }

      // 6. 적산값 조회
      const integrationResult = await executeSCPICommand(":INTegrate:VALue?");
      const integrationTime = await executeSCPICommand(":INTegrate:TIMer?");

      addSCPILog(
        "전력량 적산 결과",
        `적산값: ${integrationResult}, 시간: ${integrationTime}초`,
        true
      );
    } catch (error) {
      addSCPILog(
        "WT310 측정 오류",
        error instanceof Error ? error.message : String(error),
        false
      );
    }

    setSCPIExecution((prev) => ({
      ...prev,
      isRunning: false,
      currentCommand: "",
    }));
  };

  // 실제 SCPI 명령어 실행 (시뮬레이션)
  const executeSCPICommand = async (command: string): Promise<string> => {
    console.log(`SCPI 명령어 실행: ${command}`);

    // 시뮬레이션 응답
    await new Promise((resolve) => setTimeout(resolve, 100));

    let response = "OK";
    if (command.includes("?")) {
      // 쿼리 명령어 응답 시뮬레이션
      if (command === "*IDN?") {
        response = "GPT-9801,MODEL-PE200,FW1.1.0,SN000001,RMT";
      } else if (command === "STAT?") {
        response = "READY";
      } else if (command === "MEAS?") {
        const testTypes = ["ACW", "DCW", "IR", "GB"];
        const results = ["PASS", "FAIL"];
        const randomTest =
          testTypes[Math.floor(Math.random() * testTypes.length)];
        const randomResult =
          results[Math.floor(Math.random() * results.length)];
        response = `>${randomTest}, ${randomResult}, 1.500kV, 0.050mA, T=005.0S`;
      } else if (command === ":NUMeric:NORMal:VALue?") {
        const voltage = (220 + Math.random() * 10).toFixed(2);
        const current = (0.5 + Math.random() * 0.1).toFixed(3);
        const power = (parseFloat(voltage) * parseFloat(current)).toFixed(2);
        const freq = (60 + Math.random() * 0.1).toFixed(1);
        response = `${voltage},${current},${power},${freq},15.3,101.2,0.98,1.25`;
      } else if (command === ":INTegrate:VALue?") {
        response = "1234.56,1256.78,345.21";
      } else if (command === ":INTegrate:TIMer?") {
        response = "3661";
      }
    }

    addSCPILog(command, response, true);
    return response;
  };

  // 자동 검사 중지
  const stopAutoInspection = () => {
    console.log("자동 검사 중지");

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

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

    // 검사 시작 시 자동으로 장비 연결 및 초기화 시도
    await initializeDevices();
  };

  // 장비 초기화 함수
  const initializeDevices = async () => {
    try {
      addSCPILog("장비 초기화 시작", "GPT-9800 및 WT310 연결 확인", true);

      // 1. GPT-9800 초기화
      await executeSCPICommand("*IDN?"); // 장비 식별
      await executeSCPICommand("MAIN:FUNC MANU"); // 수동 모드 전환

      // 2. WT310 초기화
      await executeSCPICommand(":INPut1:VOLTage:RANGe AUTO");
      await executeSCPICommand(":INPut1:CURRent:RANGe AUTO");
      await executeSCPICommand(":RATE 200MS");

      addSCPILog("장비 초기화 완료", "검사 준비 완료", true);
    } catch (error) {
      addSCPILog(
        "장비 초기화 오류",
        error instanceof Error ? error.message : String(error),
        false
      );
    }
  };

  const handleStopInspection = async () => {
    await stopInspection();
    setBarcode("");
    // 자동 검사도 중지
    stopAutoInspection();
  };

  // 단계별 타이머 표시 컴포넌트
  const PhaseTimer = ({ phase }: { phase: "P1" | "P2" | "P3" }) => {
    const isActive =
      autoInspection.isRunning && autoInspection.currentStep === phase;

    // 자동 검사가 실행 중이고 현재 활성 단계일 때만 표시
    if (!autoInspection.isRunning || !isActive) return null;

    const progress =
      autoInspection.totalTime > 0
        ? ((autoInspection.totalTime - autoInspection.remainingTime) /
            autoInspection.totalTime) *
          100
        : 0;

    const phaseText =
      autoInspection.currentPhase === "prepare" ? "준비 중" : "검사 중";
    const phaseColor =
      autoInspection.currentPhase === "prepare"
        ? "text-orange-600"
        : "text-blue-600";

    return (
      <div className="absolute top-2 right-2 bg-white rounded-lg p-2 shadow-md border">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`h-2 w-2 rounded-full animate-pulse ${
              autoInspection.currentPhase === "prepare"
                ? "bg-orange-500"
                : "bg-blue-500"
            }`}
          ></div>
          <span className={`text-xs font-medium ${phaseColor}`}>
            {phaseText}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-gray-800">
            {autoInspection.remainingTime}s
          </div>
          <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                autoInspection.currentPhase === "prepare"
                  ? "bg-orange-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
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

                {/* 자동 검사 모드 표시 */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">자동 검사</span>
                  {timerSettings.autoProgress ? (
                    <Badge variant="default" className="bg-green-500">
                      활성화
                    </Badge>
                  ) : (
                    <Badge variant="secondary">비활성화</Badge>
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
                          자동 감청 중
                        </Badge>
                      ) : barcodePort ? (
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          시작 중...
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
                  {barcodeListening && lastScannedBarcode && (
                    <div className="mt-2 text-xs text-green-600">
                      ✓ 마지막 스캔: {lastScannedBarcode}
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
