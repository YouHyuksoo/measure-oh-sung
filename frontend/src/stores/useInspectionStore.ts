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
  measurementHistory: Measurement[];
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
        console.error(`❌ 설비 ${connectedPowerMeter.name} 연결 해제 실패:`, error);
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
        measurementHistory: [],
        currentMeasurement: null,
        currentPhase: null,
        messageLogs: [], // 새 검사 시작 시 로그 초기화
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
      set({ error: `순차 검사 시작 실패: ${errorMessage}`, inspectionStatus: 'error' });
    }
  },

  stopInspection: async () => {
    try {
        await apiClient.stopInspection();
        set({ inspectionStatus: "idle", currentPhase: null });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: `검사 중지 실패: ${errorMessage}` });
    }
  },

  setSelectedModelId: (id) => set({ selectedModelId: id }),
  setBarcode: (barcode) => set({ currentBarcode: barcode }),

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
      set({
        sseStatus: "disconnected",
        sse: null,
        error: "실시간 이벤트 스트림 연결 오류 발생",
      });
      sse.close();
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
        const newMeasurement: Measurement = message.data;
        set((state) => ({
          currentMeasurement: newMeasurement,
          measurementHistory: [...state.measurementHistory, newMeasurement],
        }));
        break;
      case "message_log":
        const messageLog: MessageLog = message.data;
        set((state) => ({
          messageLogs: [...state.messageLogs, messageLog],
        }));
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
