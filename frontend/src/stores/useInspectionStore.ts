import { create } from "zustand";
import { apiClient } from "@/lib/api";
import type { DeviceInfo } from "./useDeviceStore";

// --- State Interfaces ---

// 장비 연결 상태
type DeviceConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

// 검사 진행 상태
type InspectionProcessStatus = "idle" | "running" | "completed" | "error";

// 측정값 타입
export interface Measurement {
  measurement_id?: number;
  barcode: string;
  phase: "P1" | "P2" | "P3";
  value: number;
  unit: string;
  result: "PASS" | "FAIL" | "PENDING";
  timestamp: string;
}

// 메시지 로그 타입
export interface MessageLog {
  timestamp: string;
  type: string;
  content: string;
  direction: "IN" | "OUT";
}

// 검사 모델 타입
export interface InspectionModel {
  id: number;
  model_name: string;
  p1_lower_limit: number;
  p1_upper_limit: number;
  p2_lower_limit: number;
  p2_upper_limit: number;
  p3_lower_limit: number;
  p3_upper_limit: number;
}

// Store의 전체 상태 타입
export interface InspectionState {
  // --- Data & Status ---
  inspectionModels: InspectionModel[];
  isLoading: boolean;
  error: string | null;

  // --- Device Status ---
  powerMeterStatus: DeviceConnectionStatus;
  powerMeterError: string | null;
  connectedPowerMeter: DeviceInfo | null;

  barcodeScannerStatus: DeviceConnectionStatus;
  barcodeScannerError: string | null;
  isBarcodeScannerListening: boolean;
  connectedBarcodeScanner: DeviceInfo | null;

  // --- Inspection Process ---
  inspectionStatus: InspectionProcessStatus;
  currentBarcode: string | null;
  selectedModelId: number | null;
  currentPhase: "P1" | "P2" | "P3" | null;

  // 각 위상별로 분리된 측정 데이터
  p1MeasurementHistory: Measurement[];
  p2MeasurementHistory: Measurement[];
  p3MeasurementHistory: Measurement[];
  measurementHistory: Measurement[]; // 호환성을 위해 유지

  currentMeasurement: Measurement | null;

  // --- Message Logs ---
  messageLogs: MessageLog[];

  // --- SSE ---
  sse: EventSource | null;
  sseStatus: "connecting" | "connected" | "disconnected";
}

// --- Actions Interface ---
export interface InspectionActions {
  // --- Initialization ---
  initialize: () => Promise<void>;
  loadInspectionModels: () => Promise<void>;
  loadDevices: () => Promise<void>;

  // --- Device Control ---
  connectPowerMeter: () => Promise<void>;
  connectBarcodeScanner: () => Promise<void>;
  disconnectAll: () => void;

  // --- Inspection Control ---
  startSequentialInspection: (
    barcode: string,
    measurementDuration?: number,
    waitDuration?: number,
    intervalSec?: number
  ) => Promise<void>;
  stopInspection: () => Promise<void>;
  setSelectedModelId: (id: number | null) => void;
  setBarcode: (barcode: string) => void;

  // --- Measurement Data Management ---
  addP1Measurement: (measurement: Measurement) => void;
  addP2Measurement: (measurement: Measurement) => void;
  addP3Measurement: (measurement: Measurement) => void;
  clearAllMeasurements: () => void;

  // --- SSE Internal ---
  _connectSse: () => void;
  _handleSseMessage: (event: MessageEvent) => void;
}

export type InspectionStore = InspectionState & InspectionActions;

// --- Initial State ---
const initialState: InspectionState = {
  inspectionModels: [],
  isLoading: false,
  error: null,
  powerMeterStatus: "disconnected",
  powerMeterError: null,
  connectedPowerMeter: null,
  barcodeScannerStatus: "disconnected",
  barcodeScannerError: null,
  isBarcodeScannerListening: false,
  connectedBarcodeScanner: null,
  inspectionStatus: "idle",
  currentBarcode: null,
  selectedModelId: null,
  currentPhase: null,

  // 각 위상별로 분리된 측정 데이터 초기화
  p1MeasurementHistory: [],
  p2MeasurementHistory: [],
  p3MeasurementHistory: [],
  measurementHistory: [],

  currentMeasurement: null,
  messageLogs: [],
  sse: null,
  sseStatus: "disconnected",
};

// --- Store Implementation ---
export const useInspectionStore = create<InspectionStore>((set, get) => ({
  ...initialState,

  // --- Initialization Actions ---
  initialize: async () => {
    get().loadInspectionModels();
    get().loadDevices();
    get()._connectSse();
  },

  loadInspectionModels: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.getInspectionModelsAll();
      const models = Array.isArray(response)
        ? response
        : (response as any)?.models || [];
      if (models.length > 0) {
        set({
          inspectionModels: models,
          selectedModelId: null, // 기본적으로 아무것도 선택되지 않음
          error: null,
        });
      } else {
        set({ inspectionModels: [], error: "검사 모델이 없습니다." });
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ error: `검사 모델 로드 실패: ${error}` });
    } finally {
      set({ isLoading: false });
    }
  },

  loadDevices: async () => {
    // This action can be expanded to load both device types
  },

  // --- Device Control Actions ---
  connectPowerMeter: async () => {
    set({ powerMeterStatus: "connecting", powerMeterError: null });
    try {
      const devices = (await apiClient.getDevices()) as DeviceInfo[];
      const powerMeter = devices.find((d) => d.device_type === "POWER_METER");
      if (!powerMeter) throw new Error("전력 측정 설비가 등록되지 않았습니다.");

      if (powerMeter.connection_status === "CONNECTED") {
        console.log("✅ 설비가 이미 연결되어 있습니다.");
        set({ powerMeterStatus: "connected", connectedPowerMeter: powerMeter });
        return;
      }

      await apiClient.connectDevice(powerMeter.id);
      set({ powerMeterStatus: "connected", connectedPowerMeter: powerMeter });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ powerMeterStatus: "error", powerMeterError: error });
    }
  },

  connectBarcodeScanner: async () => {
    set({ barcodeScannerStatus: "connecting", barcodeScannerError: null });
    try {
      const result = await apiClient.startBarcodeListening();
      if (result?.success) {
        const statusResult = (await apiClient.getBarcodeStatus()) as any;
        const barcodeScannerInfo = statusResult?.settings
          ? {
              id: 0,
              name: "바코드 스캐너",
              device_type: "BARCODE_SCANNER" as const,
              port: statusResult.settings.port,
              baud_rate: statusResult.settings.baud_rate,
              manufacturer: "",
              model: "",
              connected: true,
            }
          : null;

        set({
          barcodeScannerStatus: "connected",
          isBarcodeScannerListening: true,
          connectedBarcodeScanner: barcodeScannerInfo,
        });
      } else {
        throw new Error(result?.message || "바코드 스캐너 연결 실패");
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ barcodeScannerStatus: "error", barcodeScannerError: error });
    }
  },

  disconnectAll: async () => {
    const { sse, connectedPowerMeter } = get();

    if (sse) {
      sse.close();
      set({ sse: null, sseStatus: "disconnected" });
    }

    if (connectedPowerMeter) {
      try {
        await apiClient.disconnectDevice(connectedPowerMeter.id);
        console.log(`✅ 설비 ${connectedPowerMeter.name} 연결 해제 완료`);
      } catch (error) {
        console.error(
          `❌ 설비 ${connectedPowerMeter.name} 연결 해제 실패:`,
          error
        );
      }
    }

    try {
      await apiClient.stopBarcodeListening();
      console.log("✅ 바코드 스캐너 연결 해제 완료");
    } catch (error) {
      console.error("❌ 바코드 스캐너 연결 해제 실패:", error);
    }

    set(initialState);
  },

  // --- Inspection Control Actions ---
  startSequentialInspection: async (
    barcode: string,
    measurementDuration = 10.0,
    waitDuration = 2.0,
    intervalSec = 0.25
  ) => {
    const { selectedModelId, powerMeterStatus } = get();

    if (!selectedModelId) {
      set({ error: "검사 모델을 선택해주세요." });
      return;
    }
    if (powerMeterStatus !== "connected") {
      set({ error: "전력 측정 설비가 연결되지 않았습니다." });
      return;
    }

    try {
      set({
        error: null,
        inspectionStatus: "running",
        currentBarcode: barcode,
        // 모든 위상별 데이터 초기화
        p1MeasurementHistory: [],
        p2MeasurementHistory: [],
        p3MeasurementHistory: [],
        measurementHistory: [],
        currentMeasurement: null,
        currentPhase: null,
      });

      await apiClient.startSequentialInspection({
        barcode,
        inspection_model_id: selectedModelId,
        measurement_duration: measurementDuration,
        wait_duration: waitDuration,
        interval_sec: intervalSec,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      set({
        error: `순차 검사 시작 실패: ${errorMessage}`,
        inspectionStatus: "error",
      });
    }
  },

  stopInspection: async () => {
    try {
      await apiClient.stopInspection();
      set({ inspectionStatus: "idle", currentPhase: null });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      set({ error: `검사 중지 실패: ${errorMessage}` });
    }
  },

  setSelectedModelId: (id) => set({ selectedModelId: id }),
  setBarcode: (barcode) => set({ currentBarcode: barcode }),

  // --- Measurement Data Management Actions ---
  addP1Measurement: (measurement) => {
    set((state) => {
      const newP1History = [...state.p1MeasurementHistory, measurement].slice(-100); // 최대 100개
      const newMeasurementHistory = [...state.measurementHistory, measurement].slice(-300); // 호환성용
      return {
        p1MeasurementHistory: newP1History,
        measurementHistory: newMeasurementHistory,
        currentMeasurement: measurement,
      };
    });
  },

  addP2Measurement: (measurement) => {
    set((state) => {
      const newP2History = [...state.p2MeasurementHistory, measurement].slice(-100);
      const newMeasurementHistory = [...state.measurementHistory, measurement].slice(-300);
      return {
        p2MeasurementHistory: newP2History,
        measurementHistory: newMeasurementHistory,
        currentMeasurement: measurement,
      };
    });
  },

  addP3Measurement: (measurement) => {
    set((state) => {
      const newP3History = [...state.p3MeasurementHistory, measurement].slice(-100);
      const newMeasurementHistory = [...state.measurementHistory, measurement].slice(-300);
      return {
        p3MeasurementHistory: newP3History,
        measurementHistory: newMeasurementHistory,
        currentMeasurement: measurement,
      };
    });
  },

  clearAllMeasurements: () => {
    set({
      p1MeasurementHistory: [],
      p2MeasurementHistory: [],
      p3MeasurementHistory: [],
      measurementHistory: [],
      currentMeasurement: null,
    });
  },

  // --- SSE Internal Actions ---
  _connectSse: () => {
    const sseUrl = "http://localhost:8000/api/v1/inspection/stream";
    console.log("🔌 [STORE] SSE 연결 시도:", sseUrl);
    const sse = new EventSource(sseUrl);
    set({ sse, sseStatus: "connecting" });

    sse.onopen = () => {
      console.log("✅ [STORE] SSE 연결 성공");
      set({ sseStatus: "connected" });
    };

    sse.onmessage = (event) => {
      // console.log("📨 [STORE] SSE 메시지 수신됨");
      get()._handleSseMessage(event);
    };

    sse.onerror = (error) => {
      console.error("💥 [STORE] SSE 오류:", error);
      // 연결을 닫아 자동 재연결 방지
      sse.close();
      set({
        sseStatus: "disconnected",
        sse: null,
        error:
          "실시간 서버 연결이 끊어졌습니다. 백엔드 서버 상태를 확인 후, '재연결' 버튼을 눌러주세요.",
      });
    };
  },

  _handleSseMessage: (event) => {
    const message = JSON.parse(event.data);
    // console.log("🔍 [STORE] SSE 메시지 수신:", message);
    // console.log("🔍 [STORE] 메시지 타입:", message.type);

    switch (message.type) {
      case "barcode_scanned":
        console.log("📱 [STORE] 바코드 스캔 감지:", message.data.barcode);
        get().setBarcode(message.data.barcode);
        const { selectedModelId, powerMeterStatus } = get();
        if (selectedModelId && powerMeterStatus === "connected") {
          console.log("🚀 [STORE] 자동 순차 검사 시작");
          get().startSequentialInspection(message.data.barcode);
        }
        break;
      case "measurement_update":
        // 측정 데이터는 우선순위로 즉시 처리
        const newMeasurement: Measurement = message.data;
        console.log(`📊 [STORE] 측정 데이터 수신:`, {
          phase: newMeasurement.phase,
          value: newMeasurement.value,
          timestamp: newMeasurement.timestamp,
        });

        // 각 위상별로 분리해서 데이터 업데이트
        switch (newMeasurement.phase) {
          case "P1":
            get().addP1Measurement(newMeasurement);
            break;
          case "P2":
            get().addP2Measurement(newMeasurement);
            break;
          case "P3":
            get().addP3Measurement(newMeasurement);
            break;
        }
        break;
      case "message_log":
        // 로그 메시지는 별도로 처리 (측정 데이터와 분리)
        const messageLog: MessageLog = message.data;

        // 위상 간 대기 상태 로그만 콘솔에 출력
        if (messageLog.type === "PHASE_WAIT") {
          if (messageLog.content.includes("대기 시작")) {
            console.log("⏳ [STORE] 위상 간 대기 시작:", messageLog.content);
          } else if (messageLog.content.includes("대기 완료")) {
            console.log("✅ [STORE] 위상 간 대기 완료:", messageLog.content);
          }
        }

        // 로그 상태 업데이트 제거 (무한 루프 방지)
        // 로그는 콘솔에만 출력하고 상태는 업데이트하지 않음
        break;
      case "inspection_started":
        set({
          inspectionStatus: "running",
          currentBarcode: message.data.barcode,
          currentPhase: null,
        });
        break;
      case "phase_update":
        set({ currentPhase: message.data.phase });
        break;
      case "phase_complete":
        // 위상 완료 (단순히 무시, 백엔드가 모든 로직 처리)
        // console.log(`✅ [STORE] 위상 ${message.data.phase} 완료:`, message.data.results);
        break;
      case "inspection_complete":
        set({
          inspectionStatus: "completed",
          currentPhase: null,
        });
        console.log("🎉 [STORE] 검사 완료:", message.data.results);
        break;
      case "inspection_error":
        set({ inspectionStatus: "error", error: message.data.error });
        break;
    }
  },
}));
