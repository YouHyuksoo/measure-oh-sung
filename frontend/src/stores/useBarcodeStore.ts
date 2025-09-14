import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface BarcodeState {
  // 바코드 스캐너 상태
  isListening: boolean;
  port: string;
  lastScannedBarcode: string;
  scanCount: number;

  // 연결 상태 관리
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  connectionError: string;
  isInitialized: boolean;

  // 현재 입력된 바코드
  currentBarcode: string;

  // 검사 모델 정보
  selectedModelId: number | null;

  // 자동 검사 설정
  autoInspectionEnabled: boolean;

  // 스캔 이력
  scanHistory: Array<{
    barcode: string;
    timestamp: string;
    modelId?: number;
  }>;
}

export interface BarcodeActions {
  // 바코드 스캐너 상태 관리
  setListening: (listening: boolean) => void;
  setPort: (port: string) => void;
  setLastScannedBarcode: (barcode: string) => void;
  incrementScanCount: () => void;
  resetScanCount: () => void;

  // 연결 상태 관리
  setConnectionStatus: (status: BarcodeState["connectionStatus"]) => void;
  setConnectionError: (error: string) => void;
  setInitialized: (initialized: boolean) => void;

  // 현재 바코드 관리
  setCurrentBarcode: (barcode: string) => void;
  clearCurrentBarcode: () => void;

  // 검사 모델 관리
  setSelectedModelId: (modelId: number | null) => void;

  // 자동 검사 설정
  setAutoInspectionEnabled: (enabled: boolean) => void;

  // 스캔 이력 관리
  addScanHistory: (barcode: string, modelId?: number) => void;
  clearScanHistory: () => void;

  // 전체 상태 리셋
  reset: () => void;
}

export type BarcodeStore = BarcodeState & BarcodeActions;

const initialState: BarcodeState = {
  isListening: false,
  port: "",
  lastScannedBarcode: "",
  scanCount: 0,
  connectionStatus: "disconnected",
  connectionError: "",
  isInitialized: false,
  currentBarcode: "",
  selectedModelId: null,
  autoInspectionEnabled: false,
  scanHistory: [],
};

export const useBarcodeStore = create<BarcodeStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // 바코드 스캐너 상태 관리
    setListening: (listening) => set({ isListening: listening }),

    setPort: (port) => set({ port }),

    setLastScannedBarcode: (barcode) => {
      const timestamp = new Date().toISOString();
      const { selectedModelId, scanHistory } = get();

      set({
        lastScannedBarcode: barcode,
        scanCount: get().scanCount + 1,
        scanHistory: [
          { barcode, timestamp, modelId: selectedModelId || undefined },
          ...scanHistory.slice(0, 49), // 최근 50개만 유지
        ],
      });
    },

    incrementScanCount: () => set({ scanCount: get().scanCount + 1 }),

    resetScanCount: () => set({ scanCount: 0 }),

    // 연결 상태 관리
    setConnectionStatus: (status) => set({ connectionStatus: status }),

    setConnectionError: (error) => set({ connectionError: error }),

    setInitialized: (initialized) => set({ isInitialized: initialized }),

    // 현재 바코드 관리
    setCurrentBarcode: (barcode) => set({ currentBarcode: barcode }),

    clearCurrentBarcode: () => set({ currentBarcode: "" }),

    // 검사 모델 관리
    setSelectedModelId: (modelId) => set({ selectedModelId: modelId }),

    // 자동 검사 설정
    setAutoInspectionEnabled: (enabled) =>
      set({ autoInspectionEnabled: enabled }),

    // 스캔 이력 관리
    addScanHistory: (barcode, modelId) => {
      const timestamp = new Date().toISOString();
      const { scanHistory } = get();

      set({
        scanHistory: [
          { barcode, timestamp, modelId },
          ...scanHistory.slice(0, 49), // 최근 50개만 유지
        ],
      });
    },

    clearScanHistory: () => set({ scanHistory: [] }),

    // 전체 상태 리셋
    reset: () => set(initialState),
  }))
);

// 선택자 함수들 (성능 최적화)
export const selectBarcodeScanner = (state: BarcodeStore) => ({
  isListening: state.isListening,
  port: state.port,
  lastScannedBarcode: state.lastScannedBarcode,
  scanCount: state.scanCount,
  connectionStatus: state.connectionStatus,
  connectionError: state.connectionError,
  isInitialized: state.isInitialized,
});

export const selectCurrentBarcode = (state: BarcodeStore) =>
  state.currentBarcode;

export const selectSelectedModelId = (state: BarcodeStore) =>
  state.selectedModelId;

export const selectScanHistory = (state: BarcodeStore) => state.scanHistory;

export const selectAutoInspectionEnabled = (state: BarcodeStore) =>
  state.autoInspectionEnabled;

export const selectConnectionStatus = (state: BarcodeStore) => ({
  status: state.connectionStatus,
  error: state.connectionError,
  isInitialized: state.isInitialized,
});
