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

  // --- Inspection Process ---
  inspectionStatus: InspectionProcessStatus;
  currentBarcode: string | null;
  selectedModelId: number | null;
  currentPhase: "P1" | "P2" | "P3" | null;
  measurementHistory: Measurement[];
  currentMeasurement: Measurement | null;

  // --- WebSocket ---
  ws: WebSocket | null;
  wsStatus: "connecting" | "connected" | "disconnected";
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
  startInspection: (barcode: string) => Promise<void>;
  stopInspection: () => void;
  setSelectedModelId: (id: number | null) => void;
  setBarcode: (barcode: string) => void;

  // --- WebSocket Internal ---
  _connectWs: () => void;
  _handleWsMessage: (event: MessageEvent) => void;
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
  inspectionStatus: "idle",
  currentBarcode: null,
  selectedModelId: null,
  currentPhase: null,
  measurementHistory: [],
  currentMeasurement: null,
  ws: null,
  wsStatus: "disconnected",
};

// --- Store Implementation ---
export const useInspectionStore = create<InspectionStore>((set, get) => ({
  ...initialState,

  // --- Initialization Actions ---
  initialize: async () => {
    get().loadInspectionModels();
    get().loadDevices();
    get()._connectWs();
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
      // Assuming the first device is the one to connect
      const devices = (await apiClient.getDevices()) as DeviceInfo[];
      const powerMeter = devices.find((d) => d.device_type === "POWER_METER");
      if (!powerMeter) throw new Error("전력 측정 설비가 등록되지 않았습니다.");

      // 이미 연결된 경우 상태만 업데이트
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
        set({
          barcodeScannerStatus: "connected",
          isBarcodeScannerListening: true,
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
    const { ws, connectedPowerMeter } = get();

    // WebSocket 연결 해제
    if (ws) {
      ws.close();
    }

    // 설비 연결 해제 (비동기 처리)
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

    // 바코드 스캐너 연결 해제
    try {
      await apiClient.stopBarcodeListening();
      console.log("✅ 바코드 스캐너 연결 해제 완료");
    } catch (error) {
      console.error("❌ 바코드 스캐너 연결 해제 실패:", error);
    }

    // 상태 리셋
    set(initialState);
  },

  // --- Inspection Control Actions ---
  startInspection: async (barcode) => {
    const { selectedModelId, ws, powerMeterStatus } = get();
    if (!selectedModelId) {
      set({ error: "검사 모델을 선택해주세요." });
      return;
    }
    if (powerMeterStatus !== "connected") {
      set({ error: "전력 측정 설비가 연결되지 않았습니다." });
      return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      set({
        inspectionStatus: "running",
        currentBarcode: barcode,
        measurementHistory: [],
        currentMeasurement: null,
        currentPhase: null,
        error: null,
      });
      ws.send(
        JSON.stringify({
          type: "start_inspection",
          data: { barcode, inspection_model_id: selectedModelId },
        })
      );
    } else {
      set({
        error: "웹소켓이 연결되지 않았습니다. 페이지를 새로고침 해주세요.",
      });
    }
  },

  stopInspection: () => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stop_inspection" }));
    }
    set({ inspectionStatus: "idle", currentPhase: null });
  },

  setSelectedModelId: (id) => set({ selectedModelId: id }),
  setBarcode: (barcode) => set({ currentBarcode: barcode }),

  // --- WebSocket Internal Actions ---
  _connectWs: () => {
    const wsUrl = "ws://localhost:8000/ws/inspection";
    const ws = new WebSocket(wsUrl);
    set({ ws, wsStatus: "connecting" });

    ws.onopen = () => {
      set({ wsStatus: "connected" });
    };

    ws.onmessage = (event) => get()._handleWsMessage(event);

    ws.onclose = () => {
      set({ wsStatus: "disconnected", ws: null });
    };

    ws.onerror = () => {
      set({
        wsStatus: "disconnected",
        ws: null,
        error: "웹소켓 연결 오류 발생",
      });
    };
  },

  _handleWsMessage: (event) => {
    const message = JSON.parse(event.data);
    switch (message.type) {
      case "barcode_scan":
        get().startInspection(message.data.barcode);
        break;
      case "phase_update":
        set({ currentPhase: message.data.phase });
        break;
      case "measurement_update":
        const newMeasurement: Measurement = message.data;
        set((state) => ({
          currentMeasurement: newMeasurement,
          measurementHistory: [...state.measurementHistory, newMeasurement],
        }));
        break;
      case "inspection_complete":
        set({ inspectionStatus: "completed", currentPhase: null });
        break;
      case "inspection_error":
        set({ inspectionStatus: "error", error: message.data.error });
        break;
    }
  },
}));
