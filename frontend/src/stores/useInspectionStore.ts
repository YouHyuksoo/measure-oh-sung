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
  step_id: number;
  step_name: string;
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

// 검사단계 타입
export interface InspectionStep {
  id: number;
  step_name: string;
  step_order: number;
  lower_limit: number;
  upper_limit: number;
  inspection_model_id: number;
  created_at: string;
  updated_at: string;
}

// 검사 모델 타입
export interface InspectionModel {
  id: number;
  model_name: string;
  description?: string;
  is_active: boolean;
  inspection_steps: InspectionStep[];
  created_at: string;
  updated_at: string;
}

// 안전시험 항목 타입
export interface SafetyInspectionItem {
  id: string;
  name: string;
  nameEn?: string;
  command: string;
  currentValue: number | null;
  result: "PASS" | "FAIL" | "PENDING";
  isCompleted: boolean;
  error?: string;
  sourceVoltage?: string;
  limitDirection?: "up" | "down";
  limitValue?: number;
  unit?: string;
  response?: string;
}

// 바코드 스캐너 설정 타입
export interface BarcodeScannerSettings {
  id: number;
  port: string;
  baudrate: number;
  data_bits: number;
  stop_bits: number;
  parity: string;
  timeout: number;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

// 바코드 스캐너 상태 타입
export interface BarcodeScannerStatus {
  is_connected: boolean;
  is_listening: boolean;
  connected_port?: string;
  last_barcode?: string;
  scan_count: number;
  settings?: BarcodeScannerSettings;
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
  currentPhase: string | null;

  // --- Safety Inspection ---
  safetyInspectionStatus: InspectionProcessStatus;
  safetyInspectionItems: SafetyInspectionItem[];
  currentSafetyStep: string | null;

  // 검사단계별 측정 데이터
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
  setSelectedModelId: (id: number | null) => void;
  setBarcode: (barcode: string) => void;
  setError: (error: string | null) => void;
  setCurrentStep: (step: string | null) => void;
  setInspectionStatus: (status: InspectionProcessStatus) => void;
  setSafetyInspectionStatus: (status: InspectionProcessStatus) => void;

  // --- Safety Inspection Control ---
  startSafetyInspection: (barcode: string) => Promise<void>;
  stopSafetyInspection: () => Promise<void>;
  setSafetyInspectionItems: (items: SafetyInspectionItem[]) => void;
  executeSafetyInspection: (
    testType: string,
    limit: number,
    deviceId: number
  ) => Promise<void>;
  executeSafetyCommand: (
    deviceId: number,
    command: string,
    expectedResponse?: string
  ) => Promise<{ success: boolean; response?: string; error?: string }>;
  parseSafetyResponse: (response: string) => { value: number; result: string };

  // --- Measurement Data Management ---
  addMeasurement: (measurement: Measurement) => void;
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

  // 안전시험 초기 상태
  safetyInspectionStatus: "idle",
  safetyInspectionItems: [
    {
      id: "dielectric",
      name: "내전압 검사",
      nameEn: "Dielectric Withstand Test",
      command: "MANU:ACW:TEST",
      currentValue: null,
      result: "PENDING",
      isCompleted: false,
      sourceVoltage: "1.5kV",
      limitDirection: "down",
      limitValue: 0.5,
      unit: "mA",
    },
    {
      id: "insulation",
      name: "절연저항 검사",
      nameEn: "Insulation Resistance Test",
      command: "MANU:IR:TEST",
      currentValue: null,
      result: "PENDING",
      isCompleted: false,
      sourceVoltage: "500V",
      limitDirection: "up",
      limitValue: 1.0,
      unit: "MΩ",
    },
    {
      id: "ground",
      name: "접지연속 검사",
      nameEn: "Ground Bond Test",
      command: "MANU:GB:TEST",
      currentValue: null,
      result: "PENDING",
      isCompleted: false,
      sourceVoltage: "10A",
      limitDirection: "down",
      limitValue: 0.1,
      unit: "Ω",
    },
  ],
  currentSafetyStep: null,

  // 검사단계별 측정 데이터 초기화
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
    try {
      // 전력 측정 설비 상태 확인
      const devices = (await apiClient.getDevices()) as DeviceInfo[];
      const powerMeter = devices.find((d) => d.device_type === "POWER_METER");

      if (powerMeter) {
        if (powerMeter.connection_status === "CONNECTED") {
          console.log("📟 전력 측정 설비 연결 상태 확인됨");
          set({
            powerMeterStatus: "connected",
            connectedPowerMeter: powerMeter,
            powerMeterError: null,
          });
        } else {
          console.log("📟 전력 측정 설비 연결 해제 상태");
          set({
            powerMeterStatus: "disconnected",
            connectedPowerMeter: null,
            powerMeterError: null,
          });
        }
      }

      // 바코드 스캐너 상태 확인
      try {
        const barcodeScannerStatus = await apiClient.getBarcodeStatus();
        if (barcodeScannerStatus?.is_listening) {
          console.log("📱 바코드 스캐너 리스닝 상태 확인됨");
          const barcodeScannerInfo = barcodeScannerStatus?.settings
            ? {
                id: 0,
                name: "바코드 스캐너",
                device_type: "BARCODE_SCANNER" as const,
                port: barcodeScannerStatus.settings.port,
                baud_rate: barcodeScannerStatus.settings.baudrate,
                manufacturer: "",
                model: "",
                connected: true,
              }
            : null;

          set({
            barcodeScannerStatus: "connected",
            isBarcodeScannerListening: true,
            connectedBarcodeScanner: barcodeScannerInfo,
            barcodeScannerError: null,
          });
        } else {
          console.log("📱 바코드 스캐너 리스닝 중지 상태");
          set({
            barcodeScannerStatus: "disconnected",
            isBarcodeScannerListening: false,
            connectedBarcodeScanner: null,
            barcodeScannerError: null,
          });
        }
      } catch (barcodeScannerError) {
        console.log("📱 바코드 스캐너 상태 확인 실패");
        set({
          barcodeScannerStatus: "disconnected",
          isBarcodeScannerListening: false,
          connectedBarcodeScanner: null,
          barcodeScannerError: null,
        });
      }
    } catch (error) {
      console.error("설비 상태 로드 실패:", error);
    }
  },

  // --- Device Control Actions ---
  connectPowerMeter: async () => {
    set({ powerMeterStatus: "connecting", powerMeterError: null });
    try {
      const devices = (await apiClient.getDevices()) as DeviceInfo[];
      const powerMeter = devices.find((d) => d.device_type === "POWER_METER");
      if (!powerMeter) throw new Error("전력 측정 설비가 등록되지 않았습니다.");

      // 먼저 연결을 해제하고 다시 연결 (포트 점유 문제 해결)
      try {
        console.log("🔄 기존 연결 해제 시도...");
        await apiClient.disconnectDevice(powerMeter.id);
        // 잠시 대기
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (disconnectError) {
        console.log("ℹ️ 기존 연결 해제 실패 (이미 해제되었을 수 있음)");
      }

      console.log("🔌 전력 측정 설비 연결 시작...");
      await apiClient.connectDevice(powerMeter.id);

      // 연결 후 상태 재확인
      const updatedDevices = (await apiClient.getDevices()) as DeviceInfo[];
      const updatedPowerMeter = updatedDevices.find(
        (d) => d.device_type === "POWER_METER"
      );

      set({
        powerMeterStatus: "connected",
        connectedPowerMeter: updatedPowerMeter || powerMeter,
        powerMeterError: null,
      });
      console.log("✅ 전력 측정 설비 연결 완료");
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error("❌ 전력 측정 설비 연결 실패:", error);
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
  // 기존 순차 검사 함수들은 제거됨 (새로운 연속 검사 방식 사용)

  setSelectedModelId: (id) => set({ selectedModelId: id }),
  setBarcode: (barcode) => set({ currentBarcode: barcode }),
  setError: (error) => set({ error }),
  setCurrentStep: (step) => set({ currentSafetyStep: step }),
  setInspectionStatus: (status) => set({ inspectionStatus: status }),
  setSafetyInspectionStatus: (status) =>
    set({ safetyInspectionStatus: status }),

  // --- Measurement Data Management Actions ---
  addMeasurement: (measurement) => {
    set((state) => {
      const newMeasurementHistory = [
        ...state.measurementHistory,
        measurement,
      ].slice(-300); // 최대 300개
      return {
        measurementHistory: newMeasurementHistory,
        currentMeasurement: measurement,
      };
    });
  },

  clearAllMeasurements: () => {
    set({
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
        break;
      case "inspection_started":
        console.log("🚀 [STORE] 연속 검사 시작:", message.data);
        set({
          inspectionStatus: "running",
          currentBarcode: message.data.barcode,
          currentPhase: null,
        });
        break;
      case "step_start":
        console.log("📋 [STORE] 검사단계 시작:", message.data.step_name);
        set({ currentPhase: message.data.step_name });
        break;
      case "measurement_update":
        // 측정 데이터는 우선순위로 즉시 처리
        const newMeasurement: Measurement = message.data;
        console.log(`📊 [STORE] 측정 데이터 수신:`, {
          step_name: newMeasurement.step_name,
          value: newMeasurement.value,
          timestamp: newMeasurement.timestamp,
        });

        // 검사단계별 데이터 업데이트
        get().addMeasurement(newMeasurement);
        break;
      case "step_complete":
        console.log("✅ [STORE] 검사단계 완료:", message.data.step_name);
        break;
      case "inspection_complete":
        set({
          inspectionStatus: "completed",
          currentPhase: null,
        });
        console.log("🎉 [STORE] 검사 완료:", message.data.results);
        break;
      case "inspection_stopped":
        set({
          inspectionStatus: "idle",
          currentPhase: null,
        });
        console.log("🛑 [STORE] 검사 중지:", message.data);
        break;
      case "inspection_error":
        set({ inspectionStatus: "error", error: message.data.error });
        console.log("❌ [STORE] 검사 오류:", message.data.error);
        break;
    }
  },

  // --- Safety Inspection Functions ---
  startSafetyInspection: async (barcode: string) => {
    const { selectedModelId, safetyInspectionItems, safetyInspectionStatus } =
      get();

    // 중복 호출 방지
    if (safetyInspectionStatus === "running") {
      console.log("⚠️ [STORE] 안전시험이 이미 실행 중입니다. 중복 호출 무시");
      return;
    }

    if (!selectedModelId) {
      set({ error: "검사 모델을 선택해주세요." });
      return;
    }

    console.log("🚀 [STORE] startSafetyInspection 시작:", barcode);

    // 안전시험 상태 초기화
    set({
      safetyInspectionStatus: "running",
      currentBarcode: barcode,
      currentSafetyStep: "검사 시작",
      safetyInspectionItems: safetyInspectionItems.map((item) => ({
        ...item,
        currentValue: null,
        result: "PENDING",
        isCompleted: false,
      })),
    });

    try {
      // 백엔드 API 호출로 안전시험 시작 (DB 저장 포함)
      console.log("🚀 [STORE] 백엔드 API 호출로 안전시험 시작");
      await apiClient.startSafetyInspection({
        barcode,
        inspection_model_id: selectedModelId,
      });

      set({
        safetyInspectionStatus: "completed",
        currentSafetyStep: "검사 완료",
      });
      console.log("✅ [STORE] 안전시험 완료 및 DB 저장됨");
    } catch (error) {
      console.error("❌ [STORE] 안전시험 시작 실패:", error);
      set({
        safetyInspectionStatus: "error",
        error: `안전시험 시작 실패: ${error}`,
      });
    }
  },

  stopSafetyInspection: async () => {
    set({
      safetyInspectionStatus: "idle",
      currentSafetyStep: null,
      error: null,
    });
  },

  setSafetyInspectionItems: (items) => {
    set({ safetyInspectionItems: items });
  },

  executeSafetyInspection: async (
    testType: string,
    limit: number,
    deviceId: number
  ) => {
    console.log(
      `🔍 [STORE] executeSafetyInspection 시작: ${testType}, limit: ${limit}, deviceId: ${deviceId}`
    );

    const { safetyInspectionItems } = get();
    const item = safetyInspectionItems.find((item) => item.id === testType);
    console.log(`🔍 [STORE] 찾은 항목:`, item);

    if (!item) {
      console.log(`❌ [STORE] 항목을 찾을 수 없음: ${testType}`);
      return;
    }

    try {
      console.log(`🚀 [STORE] SCPI 명령어 실행 시작: ${item.command}`);
      // SCPI 명령어 실행
      const result = await get().executeSafetyCommand(deviceId, item.command);
      console.log(`📡 [STORE] executeSafetyCommand 결과:`, result);

      if (result.success && result.response) {
        console.log(`📋 [STORE] 원데이터: ${result.response}`);
        const parsed = get().parseSafetyResponse(result.response);

        // 안전시험 항목 업데이트
        const updatedItems: SafetyInspectionItem[] = safetyInspectionItems.map(
          (safetyItem) => {
            if (safetyItem.id === testType) {
              // limitDirection에 따라 판정 로직 결정
              let isPass = false;
              if (safetyItem.limitDirection === "up") {
                // 값이 높아야 PASS (절연저항)
                isPass = parsed.value >= limit;
              } else {
                // 값이 낮아야 PASS (내전압, 접지연속)
                isPass = parsed.value <= limit;
              }

              return {
                ...safetyItem,
                currentValue: parsed.value,
                result: isPass ? "PASS" : "FAIL",
                isCompleted: true,
              };
            }
            return safetyItem;
          }
        );

        set({ safetyInspectionItems: updatedItems });
      } else {
        // 오류 처리
        const updatedItems: SafetyInspectionItem[] = safetyInspectionItems.map(
          (safetyItem) =>
            safetyItem.id === testType
              ? {
                  ...safetyItem,
                  result: "FAIL" as const,
                  isCompleted: true,
                  error: result.error || "명령 실행 실패",
                }
              : safetyItem
        );

        set({ safetyInspectionItems: updatedItems });
      }
    } catch (error) {
      // 오류 처리
      const updatedItems: SafetyInspectionItem[] = safetyInspectionItems.map(
        (safetyItem) =>
          safetyItem.id === testType
            ? {
                ...safetyItem,
                result: "FAIL" as const,
                isCompleted: true,
                error: String(error),
              }
            : safetyItem
      );

      set({ safetyInspectionItems: updatedItems });
    }
  },

  executeSafetyCommand: async (
    deviceId: number,
    command: string,
    expectedResponse?: string
  ): Promise<{ success: boolean; response?: string; error?: string }> => {
    console.log(
      `🚀 [STORE] executeSafetyCommand 시작: deviceId=${deviceId}, command=${command}`
    );

    try {
      console.log(`📡 [STORE] API 호출 시작: sendCommand`);
      const response = await apiClient.sendCommand(deviceId, command);
      console.log(`📡 [STORE] API 응답 받음:`, response);

      if (
        response &&
        typeof response === "object" &&
        "success" in response &&
        response.success &&
        "response" in response &&
        response.response
      ) {
        return {
          success: true,
          response: String(response.response),
        };
      } else {
        return {
          success: false,
          error: "잘못된 응답 형식",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  parseSafetyResponse: (
    response: string
  ): { value: number; result: "PASS" | "FAIL" } => {
    console.log(`🔍 [STORE] parseSafetyResponse 시작: "${response}"`);

    try {
      // 애뮬레이터 응답 형식: "ACW,1000.0V,0.778mA,0.5mA,FAIL"
      const parts = response.split(",");
      console.log(`🔍 [STORE] 분할된 부분들:`, parts);

      if (parts.length >= 5 && parts[2] && parts[4]) {
        // parts[0]: 테스트 타입 (ACW, IR, GB)
        // parts[1]: 전압 (1000.0V)
        // parts[2]: 측정값 (0.778mA, 4.07MΩ, 0.035Ω)
        // parts[3]: 기준값 (0.5mA, 1.0MΩ, 0.100Ω)
        // parts[4]: 결과 (PASS, FAIL)

        const result = parts[4].trim() === "PASS" ? "PASS" : "FAIL";
        const valueStr = parts[2].trim();

        console.log(`🔍 [STORE] 측정값 문자열: "${valueStr}"`);

        // 값 추출 (단위 제거)
        let value = 0;
        if (valueStr.includes("mA")) {
          // mA 단위: "0.778mA" -> 0.778
          value = parseFloat(valueStr.replace(/mA/i, ""));
        } else if (valueStr.includes("MΩ")) {
          // MΩ 단위: "4.07MΩ" -> 4.07
          value = parseFloat(valueStr.replace(/MΩ/i, ""));
        } else if (valueStr.includes("Ω")) {
          // Ω 단위: "0.035Ω" -> 0.035
          value = parseFloat(valueStr.replace(/Ω/i, ""));
        }

        console.log(`🔍 [STORE] 파싱된 값: ${value}, 결과: ${result}`);
        return { value: isNaN(value) ? 0 : value, result };
      }
    } catch (error) {
      console.error("응답 파싱 오류:", error);
    }

    console.log(`❌ [STORE] 파싱 실패, 기본값 반환`);
    return { value: 0, result: "FAIL" };
  },
}));
