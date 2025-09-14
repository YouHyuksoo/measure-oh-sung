import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface DeviceInfo {
  id: number;
  name: string;
  device_type: string;
  manufacturer: string;
  model: string;
  port: string;
  baud_rate: number;
  connected: boolean;
  connection_status?: string;
}

export interface DeviceState {
  // 전력측정설비 연결 상태
  deviceConnectionStatus: "connecting" | "connected" | "disconnected" | "error";
  connectionError: string;
  connectedDevices: DeviceInfo[];

  // 연결 디버깅 정보
  connectionDebugInfo: {
    lastAttempt: string;
    apiResponse: any;
    deviceInfo: any;
  };

  // 자동 재시도 설정
  autoRetryEnabled: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface DeviceActions {
  // 연결 상태 관리
  setDeviceConnectionStatus: (
    status: DeviceState["deviceConnectionStatus"]
  ) => void;
  setConnectionError: (error: string) => void;
  setConnectedDevices: (devices: DeviceInfo[]) => void;
  addConnectedDevice: (device: DeviceInfo) => void;
  removeConnectedDevice: (deviceId: number) => void;

  // 디버깅 정보 관리
  setConnectionDebugInfo: (
    info: Partial<DeviceState["connectionDebugInfo"]>
  ) => void;
  updateApiResponse: (response: any) => void;

  // 재시도 관리
  setAutoRetryEnabled: (enabled: boolean) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;

  // 전체 상태 리셋
  reset: () => void;
}

export type DeviceStore = DeviceState & DeviceActions;

const initialState: DeviceState = {
  deviceConnectionStatus: "disconnected",
  connectionError: "",
  connectedDevices: [],
  connectionDebugInfo: {
    lastAttempt: "",
    apiResponse: null,
    deviceInfo: null,
  },
  autoRetryEnabled: true,
  retryCount: 0,
  maxRetries: 3,
};

export const useDeviceStore = create<DeviceStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // 연결 상태 관리
    setDeviceConnectionStatus: (status) =>
      set({ deviceConnectionStatus: status }),

    setConnectionError: (error) => set({ connectionError: error }),

    setConnectedDevices: (devices) => set({ connectedDevices: devices }),

    addConnectedDevice: (device) =>
      set((state) => ({
        connectedDevices: [
          ...state.connectedDevices.filter((d) => d.id !== device.id),
          device,
        ],
      })),

    removeConnectedDevice: (deviceId) =>
      set((state) => ({
        connectedDevices: state.connectedDevices.filter(
          (d) => d.id !== deviceId
        ),
      })),

    // 디버깅 정보 관리
    setConnectionDebugInfo: (info) =>
      set((state) => ({
        connectionDebugInfo: { ...state.connectionDebugInfo, ...info },
      })),

    updateApiResponse: (response) =>
      set((state) => ({
        connectionDebugInfo: {
          ...state.connectionDebugInfo,
          apiResponse: response,
        },
      })),

    // 재시도 관리
    setAutoRetryEnabled: (enabled) => set({ autoRetryEnabled: enabled }),

    incrementRetryCount: () =>
      set((state) => ({ retryCount: state.retryCount + 1 })),

    resetRetryCount: () => set({ retryCount: 0 }),

    // 전체 상태 리셋
    reset: () => set(initialState),
  }))
);

// 선택자 함수들 (성능 최적화)
export const selectDeviceConnectionStatus = (state: DeviceStore) => ({
  status: state.deviceConnectionStatus,
  error: state.connectionError,
  devices: state.connectedDevices,
});

export const selectConnectionDebugInfo = (state: DeviceStore) =>
  state.connectionDebugInfo;

export const selectRetryInfo = (state: DeviceStore) => ({
  autoRetryEnabled: state.autoRetryEnabled,
  retryCount: state.retryCount,
  maxRetries: state.maxRetries,
});
