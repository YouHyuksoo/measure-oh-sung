"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useWebSocket, WebSocketMessage } from "./useWebSocket";

interface InspectionStatus {
  is_listening: boolean;
  current_barcode?: string;
  inspection_model_id?: number;
  phase?: string;
  progress?: number;
}

interface MeasurementData {
  measurement_id: number;
  barcode: string;
  phase: "P1" | "P2" | "P3";
  device_id: number;
  value: number;
  unit: string;
  timestamp: string;
  result: "PASS" | "FAIL" | "PENDING";
}

export function useInspection() {
  const [status, setStatus] = useState<InspectionStatus>({
    is_listening: false,
  });
  const [currentMeasurement, setCurrentMeasurement] =
    useState<MeasurementData | null>(null);
  const [measurementHistory, setMeasurementHistory] = useState<
    MeasurementData[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 검사결과용 WebSocket
  const inspectionWsUrl =
    process.env.NEXT_PUBLIC_INSPECTION_WS_URL ||
    "ws://localhost:8000/ws/inspection";
  const {
    isConnected: inspectionWsConnected,
    lastMessage: inspectionMessage,
    sendMessage: sendInspectionMessage,
  } = useWebSocket(inspectionWsUrl);

  // 바코드 스캔용 WebSocket
  const barcodeWsUrl =
    process.env.NEXT_PUBLIC_BARCODE_WS_URL || "ws://localhost:8000/ws/barcode";
  const {
    isConnected: barcodeWsConnected,
    lastMessage: barcodeMessage,
    sendMessage: sendBarcodeMessage,
  } = useWebSocket(barcodeWsUrl);

  // 바코드 데이터 수신 콜백 상태
  const [onBarcodeReceived, setOnBarcodeReceived] = useState<
    ((barcode: string) => void) | null
  >(null);

  // 검사결과용 WebSocket 메시지 처리
  const handleInspectionMessage = useCallback((message: WebSocketMessage) => {
    console.log("검사결과 WebSocket 메시지 수신:", message);

    switch (message.type) {
      case "inspection_status":
        setStatus(message.data);
        break;

      case "measurement_data":
        const measurement: MeasurementData = message.data;
        setCurrentMeasurement(measurement);
        setMeasurementHistory((prev) => [...prev, measurement]);
        break;

      case "inspection_complete":
        setStatus((prev) => ({
          ...prev,
          is_listening: false,
          current_barcode: undefined,
          phase: undefined,
          progress: 100,
        }));
        break;

      case "error":
        setError(message.data.message || "알 수 없는 오류가 발생했습니다");
        break;

      default:
        console.log("알 수 없는 검사결과 메시지 유형:", message.type);
    }
  }, []);

  // 바코드 스캔용 WebSocket 메시지 처리
  const handleBarcodeMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("바코드 스캔 WebSocket 메시지 수신:", message);

      switch (message.type) {
        case "barcode_scanned":
        case "barcode_scan":
          // 바코드 스캐너에서 데이터 수신
          const barcodeData = message.data.barcode || message.data;
          if (barcodeData && onBarcodeReceived) {
            console.log("바코드 스캔 감지:", barcodeData);
            onBarcodeReceived(barcodeData);
          }
          break;

        case "barcode_error":
          setError(message.data.message || "바코드 스캔 오류가 발생했습니다");
          break;

        default:
          console.log("알 수 없는 바코드 메시지 유형:", message.type);
      }
    },
    [onBarcodeReceived]
  );

  // 검사결과 WebSocket 메시지 처리
  useEffect(() => {
    if (inspectionMessage) {
      handleInspectionMessage(inspectionMessage);
    }
  }, [inspectionMessage, handleInspectionMessage]);

  // 바코드 스캔 WebSocket 메시지 처리
  useEffect(() => {
    if (barcodeMessage) {
      handleBarcodeMessage(barcodeMessage);
    }
  }, [barcodeMessage, handleBarcodeMessage]);

  // 검사 상태 조회
  const refreshStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getInspectionStatus();
      setStatus(response as InspectionStatus);
      setError(null);
    } catch (err) {
      setError("검사 상태를 가져올 수 없습니다");
      console.error("검사 상태 조회 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 바코드 리스닝 시작
  const startListening = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. 바코드 스캐너 시작
      await apiClient.startBarcodeListening();

      // 2. 측정 장비 연결 상태 먼저 확인 후 검사 루틴 시작
      try {
        console.log("🔍 측정 장비 연결 상태 확인 중...");
        const devicesResponse = await fetch(
          "http://localhost:8000/api/v1/inspection/connected-devices"
        );
        const devicesData = await devicesResponse.json();

        if (devicesData.total > 0) {
          console.log(
            `✅ ${devicesData.total}개의 측정 장비가 연결되어 있습니다.`
          );
          console.log("🔄 검사 루틴 시작 중...");

          // 측정 장비가 있을 때만 검사 루틴 시작
          const response = await fetch(
            "http://localhost:8000/api/v1/inspection/start-listening",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (response.ok) {
            console.log("✅ 검사 루틴 시작됨 - 전체 검사 기능 활성화");
          } else {
            const errorText = await response.text();
            console.warn("검사 루틴 시작 실패:", response.status, errorText);
          }
        } else {
          console.log(
            "⚠️ 측정 장비가 연결되지 않았습니다. 바코드 수신만 가능합니다."
          );
          console.log(
            "💡 전체 검사 기능을 사용하려면 장비 관리에서 측정 장비를 연결해주세요."
          );
          console.log("📝 현재 상태: 바코드 스캐너만 활성화됨");
        }
      } catch (deviceCheckErr) {
        console.warn(
          "장비 연결 상태 확인 실패, 바코드 스캐너만 사용:",
          deviceCheckErr
        );
      }

      setError(null);
    } catch (err) {
      setError("바코드 리스닝을 시작할 수 없습니다");
      console.error("바코드 리스닝 시작 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 바코드 스캔 처리
  const processBarcodeScan = useCallback(
    async (barcode: string, inspectionModelId: number) => {
      try {
        setIsLoading(true);
        await apiClient.processBarcodeScan(barcode, inspectionModelId);
        setMeasurementHistory([]); // 새 검사 시작시 이력 초기화
        setError(null);
      } catch (err) {
        setError("바코드 처리 중 오류가 발생했습니다");
        console.error("바코드 처리 오류:", err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // 검사 중지
  const stopInspection = useCallback(async () => {
    try {
      setIsLoading(true);
      await apiClient.stopInspection();
      setCurrentMeasurement(null);
      setError(null);
    } catch (err) {
      setError("검사를 중지할 수 없습니다");
      console.error("검사 중지 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // 바코드 콜백 등록
  const setBarcodeCallback = useCallback(
    (callback: ((barcode: string) => void) | null) => {
      setOnBarcodeReceived(() => callback);
    },
    []
  );

  return {
    // 상태
    status,
    currentMeasurement,
    measurementHistory,
    isLoading,
    error,
    wsConnected: inspectionWsConnected && barcodeWsConnected, // 두 WebSocket 모두 연결되어야 함

    // WebSocket 연결 상태 (개별 확인용)
    inspectionWsConnected,
    barcodeWsConnected,

    // 액션
    startListening,
    processBarcodeScan,
    stopInspection,
    refreshStatus,
    setBarcodeCallback,

    // WebSocket 메시지 전송
    sendInspectionMessage,
    sendBarcodeMessage,

    // 유틸리티
    clearError: () => setError(null),
    clearHistory: () => setMeasurementHistory([]),
  };
}
