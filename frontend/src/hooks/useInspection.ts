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
  connected_devices: number;
  total_devices: number;
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
    connected_devices: 0,
    total_devices: 0,
  });
  const [currentMeasurement, setCurrentMeasurement] =
    useState<MeasurementData | null>(null);
  const [measurementHistory, setMeasurementHistory] = useState<
    MeasurementData[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/inspection";
  const {
    isConnected: wsConnected,
    lastMessage,
    sendMessage,
  } = useWebSocket(wsUrl);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    console.log("WebSocket 메시지 수신:", message);

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
        console.log("알 수 없는 메시지 유형:", message.type);
    }
  }, []);

  // WebSocket 메시지 처리
  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage, handleWebSocketMessage]);

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
      await apiClient.startBarcodeListening();
      setError(null);
    } catch (err) {
      setError("바코드 리스닝을 시작할 수 없습니다");
      console.error("바코드 리스닝 시작 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 바코드 스캔 처리
  const processBarcodeScann = useCallback(
    async (barcode: string, inspectionModelId: number) => {
      try {
        setIsLoading(true);
        await apiClient.processBarcodeSccan(barcode, inspectionModelId);
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

  // 연결된 장비 조회
  const refreshConnectedDevices = useCallback(async () => {
    try {
      const response = (await apiClient.getConnectedDevices()) as
        | { devices?: any[] }
        | any[];

      // API 응답에서 devices 배열 추출
      const devicesArray = Array.isArray(response)
        ? response
        : response.devices || [];

      setStatus((prev) => ({
        ...prev,
        connected_devices: devicesArray.filter(
          (d: any) => d.status === "CONNECTED"
        ).length,
        total_devices: devicesArray.length,
      }));
    } catch (err) {
      console.error("연결된 장비 조회 오류:", err);
    }
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    refreshStatus();
    refreshConnectedDevices();
  }, [refreshStatus, refreshConnectedDevices]);

  return {
    // 상태
    status,
    currentMeasurement,
    measurementHistory,
    isLoading,
    error,
    wsConnected,

    // 액션
    startListening,
    processBarcodeScann,
    stopInspection,
    refreshStatus,
    refreshConnectedDevices,

    // 유틸리티
    clearError: () => setError(null),
    clearHistory: () => setMeasurementHistory([]),
  };
}
