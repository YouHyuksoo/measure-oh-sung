"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Cable,
  WifiOff,
  Activity,
  Settings,
  Zap,
  QrCode,
  Scan,
  Battery,
  Power,
  Terminal,
  Play,
  Plus,
  Edit,
  Trash2,
  Copy,
  Save,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api";

// 설비 유형 enum
enum DeviceType {
  POWER_METER = "POWER_METER",
  SAFETY_TESTER = "SAFETY_TESTER",
  BARCODE_SCANNER = "BARCODE_SCANNER",
}

// 설비 유형 표시명
const DEVICE_TYPE_LABELS = {
  [DeviceType.POWER_METER]: "전력측정설비",
  [DeviceType.SAFETY_TESTER]: "안전시험기",
  [DeviceType.BARCODE_SCANNER]: "바코드스캐너",
} as const;

interface SerialPort {
  name: string;
  vendor: string;
}

interface InterfaceConfig {
  type: "USB" | "RS232" | "GPIB";
  baud: number;
}

interface TestResponse {
  ok: boolean;
  message?: string;
  response?: string;
}

interface LogEntry {
  timestamp: string;
  type: "info" | "success" | "error";
  message: string;
}

interface Device {
  id: number;
  name: string;
  device_type: DeviceType;
  manufacturer: string;
  model: string;
  port: string;
  baud_rate: number;
  data_bits: number;
  stop_bits: number;
  parity: string;
  timeout: number;
  connection_status?: string;
}

export default function SafetyTesterDevicePage() {
  // 공통 포트 목록 (모든 장비가 공유)
  const [commonPorts, setCommonPorts] = useState<SerialPort[]>([]);

  // 설비 등록 관련 상태
  const [registeredDevices, setRegisteredDevices] = useState<Device[]>([]);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [isEditDeviceOpen, setIsEditDeviceOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [newDevice, setNewDevice] = useState({
    name: "",
    device_type: DeviceType.SAFETY_TESTER,
    manufacturer: "",
    model: "",
    port: "",
    baud_rate: 9600,
    data_bits: 8,
    stop_bits: 1,
    parity: "None",
    timeout: 5,
  });

  // UI 상태
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // 유효한 보드레이트 값들
  const validBaudRates = [9600, 19200, 38400, 57600, 115200];

  const addLog = (type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 9)]); // 최근 10개만 유지
  };

  // 공통 포트 로드 함수 (모든 장비가 공유)
  const loadCommonPorts = useCallback(async () => {
    // 수동 포트 목록 (COM1~COM10) - 기본값으로 설정
    const manualPorts: SerialPort[] = [
      { name: "COM1", vendor: "수동 입력" },
      { name: "COM2", vendor: "수동 입력" },
      { name: "COM3", vendor: "수동 입력" },
      { name: "COM4", vendor: "수동 입력" },
      { name: "COM5", vendor: "수동 입력" },
      { name: "COM6", vendor: "수동 입력" },
      { name: "COM7", vendor: "수동 입력" },
      { name: "COM8", vendor: "수동 입력" },
      { name: "COM9", vendor: "수동 입력" },
      { name: "COM10", vendor: "수동 입력" },
    ];

    try {
      // 시스템에서 감지된 포트 조회 (안전시험기 API 사용)
      const detectedPorts =
        (await apiClient.getSafetyTesterPorts()) as SerialPort[];

      // 감지된 포트와 수동 포트 통합 (중복 제거)
      const allPorts: SerialPort[] = [...detectedPorts];
      manualPorts.forEach((manualPort) => {
        if (!detectedPorts.some((port) => port.name === manualPort.name)) {
          allPorts.push(manualPort);
        }
      });

      setCommonPorts(allPorts);
      addLog(
        "info",
        `포트 ${allPorts.length}개 로드됨 (감지: ${detectedPorts.length}개, 수동: ${manualPorts.length}개)`
      );
    } catch (err) {
      console.error("포트 조회 오류:", err);
      // 백엔드 연결 실패 시 수동 포트만 표시
      setCommonPorts(manualPorts);
      addLog("error", "포트 자동 감지 실패 - 수동 포트만 표시됩니다");
    }
  }, []);

  // 등록된 설비 목록 로드
  const loadRegisteredDevices = useCallback(async () => {
    try {
      const devices = (await apiClient.getDevices()) as Device[];
      setRegisteredDevices(devices);
      addLog("info", `등록된 설비 ${devices.length}개 로드됨`);
      setError(null); // 성공 시 에러 초기화
    } catch (err) {
      console.error("설비 목록 조회 실패:", err);
      const errorMsg = err instanceof Error ? err.message : "알 수 없는 오류";
      if (errorMsg.includes("Failed to fetch")) {
        setError(
          "백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요. (http://localhost:8000)"
        );
        addLog("error", "백엔드 서버 연결 실패 - 서버 상태를 확인해주세요");
      } else {
        setError(`설비 목록 조회 실패: ${errorMsg}`);
        addLog("error", "설비 목록 조회 실패");
      }
    }
  }, []);

  // 새 설비 등록
  const handleAddDevice = async () => {
    if (!newDevice.name || !newDevice.port) {
      setError("설비명과 포트는 필수 입력 항목입니다");
      return;
    }

    try {
      setIsLoading(true);
      await apiClient.createDevice(newDevice);

      // 성공 후 목록 새로고침
      await loadRegisteredDevices();

      // 폼 초기화
      setNewDevice({
        name: "",
        device_type: DeviceType.SAFETY_TESTER,
        manufacturer: "",
        model: "",
        port: "",
        baud_rate: 9600,
        data_bits: 8,
        stop_bits: 1,
        parity: "None",
        timeout: 5,
      });

      setIsAddDeviceOpen(false);
      setError(null);
      addLog("success", `새 설비 '${newDevice.name}' 등록됨`);
    } catch (err) {
      setError("설비 등록 중 오류가 발생했습니다");
      addLog("error", "설비 등록 실패");
      console.error("설비 등록 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 설비 삭제
  const handleDeleteDevice = async (deviceId: number, deviceName: string) => {
    if (!confirm(`정말로 '${deviceName}' 설비를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setIsLoading(true);
      await apiClient.deleteDevice(deviceId);
      await loadRegisteredDevices();
      addLog("success", `설비 '${deviceName}' 삭제됨`);
    } catch (err) {
      setError("설비 삭제 중 오류가 발생했습니다");
      addLog("error", "설비 삭제 실패");
      console.error("설비 삭제 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 설비 수정 시작
  const handleEditDevice = (device: Device) => {
    setEditingDevice({
      id: device.id,
      name: device.name,
      device_type: device.device_type,
      manufacturer: device.manufacturer || "",
      model: device.model || "",
      port: device.port,
      baud_rate: device.baud_rate,
      data_bits: device.data_bits,
      stop_bits: device.stop_bits,
      parity: device.parity,
      timeout: device.timeout,
    });
    setIsEditDeviceOpen(true);
  };

  // 설비 수정 저장
  const handleUpdateDevice = async () => {
    if (!editingDevice || !editingDevice.name || !editingDevice.port) {
      setError("설비명과 포트는 필수 입력 항목입니다");
      return;
    }

    try {
      setIsLoading(true);
      await apiClient.updateDevice(editingDevice.id, editingDevice);

      // 성공 후 목록 새로고침
      await loadRegisteredDevices();

      // 폼 초기화
      setEditingDevice(null);
      setIsEditDeviceOpen(false);
      setError(null);
      addLog("success", `설비 '${editingDevice.name}' 수정됨`);
    } catch (err) {
      setError("설비 수정 중 오류가 발생했습니다");
      addLog("error", "설비 수정 실패");
      console.error("설비 수정 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRegisteredDevices();
    loadCommonPorts();
  }, [loadRegisteredDevices, loadCommonPorts]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">장비 관리</h1>
          <p className="text-muted-foreground mt-2">
            측정 설비의 정보를 등록하고 통신 설정을 관리합니다
          </p>
        </div>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-2"
            >
              닫기
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 설비 등록 섹션 */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">설비 등록</CardTitle>
              <CardDescription className="text-base">
                새로운 측정 설비를 등록합니다
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsAddDeviceOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />새 설비 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 새 설비 등록 폼 */}
          {isAddDeviceOpen && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border-2 border-dashed border-blue-200 dark:border-gray-700 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100">
                    새 설비 등록
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                    설비 정보를 입력하여 새로운 장비를 등록하세요
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddDeviceOpen(false)}
                  className="hover:bg-blue-100 dark:hover:bg-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>설비명 *</Label>
                  <Input
                    value={newDevice.name}
                    onChange={(e) =>
                      setNewDevice((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="예: GPT-9000 안전시험기"
                  />
                </div>

                <div className="space-y-2">
                  <Label>설비 유형 *</Label>
                  <Select
                    value={newDevice.device_type}
                    onValueChange={(value) =>
                      setNewDevice((prev) => ({
                        ...prev,
                        device_type: value as DeviceType,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DeviceType.SAFETY_TESTER}>
                        {DEVICE_TYPE_LABELS[DeviceType.SAFETY_TESTER]}
                      </SelectItem>
                      <SelectItem value={DeviceType.POWER_METER}>
                        {DEVICE_TYPE_LABELS[DeviceType.POWER_METER]}
                      </SelectItem>
                      <SelectItem value={DeviceType.BARCODE_SCANNER}>
                        {DEVICE_TYPE_LABELS[DeviceType.BARCODE_SCANNER]}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>포트 *</Label>
                  <Select
                    value={newDevice.port}
                    onValueChange={(value) =>
                      setNewDevice((prev) => ({ ...prev, port: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="포트 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {commonPorts.map((port) => (
                        <SelectItem key={port.name} value={port.name}>
                          {port.name} ({port.vendor})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>제조사</Label>
                  <Input
                    value={newDevice.manufacturer}
                    onChange={(e) =>
                      setNewDevice((prev) => ({
                        ...prev,
                        manufacturer: e.target.value,
                      }))
                    }
                    placeholder="예: GPT"
                  />
                </div>

                <div className="space-y-2">
                  <Label>모델</Label>
                  <Input
                    value={newDevice.model}
                    onChange={(e) =>
                      setNewDevice((prev) => ({
                        ...prev,
                        model: e.target.value,
                      }))
                    }
                    placeholder="예: GPT-9000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>보드레이트</Label>
                  <Select
                    value={newDevice.baud_rate.toString()}
                    onValueChange={(value) =>
                      setNewDevice((prev) => ({
                        ...prev,
                        baud_rate: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {validBaudRates.map((rate) => (
                        <SelectItem key={rate} value={rate.toString()}>
                          {rate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDeviceOpen(false)}
                >
                  취소
                </Button>
                <Button onClick={handleAddDevice} disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? "저장 중..." : "등록"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 설비 수정 섹션 */}
      {isEditDeviceOpen && editingDevice && (
        <Card className="shadow-lg border-orange-200 dark:border-orange-800">
          <CardHeader className="bg-orange-50 dark:bg-orange-950">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Edit className="h-6 w-6 text-orange-600" />
              설비 수정
            </CardTitle>
            <CardDescription className="text-base">
              선택된 설비의 정보를 수정합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border-2 border-dashed border-orange-200 dark:border-gray-700 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-orange-900 dark:text-orange-100">
                    설비 정보 수정
                  </h3>
                  <p className="text-orange-700 dark:text-orange-300 text-sm mt-1">
                    수정할 정보를 입력하세요
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditDeviceOpen(false);
                    setEditingDevice(null);
                  }}
                  className="hover:bg-orange-100 dark:hover:bg-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>설비명 *</Label>
                  <Input
                    value={editingDevice?.name || ""}
                    onChange={(e) =>
                      setEditingDevice((prev) =>
                        prev
                          ? {
                              ...prev,
                              name: e.target.value,
                            }
                          : null
                      )
                    }
                    placeholder="예: GPT-9000 안전시험기"
                  />
                </div>

                <div className="space-y-2">
                  <Label>설비 유형 *</Label>
                  <Select
                    value={
                      editingDevice?.device_type || DeviceType.SAFETY_TESTER
                    }
                    onValueChange={(value) =>
                      setEditingDevice((prev) =>
                        prev
                          ? {
                              ...prev,
                              device_type: value as DeviceType,
                            }
                          : null
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DeviceType.SAFETY_TESTER}>
                        {DEVICE_TYPE_LABELS[DeviceType.SAFETY_TESTER]}
                      </SelectItem>
                      <SelectItem value={DeviceType.POWER_METER}>
                        {DEVICE_TYPE_LABELS[DeviceType.POWER_METER]}
                      </SelectItem>
                      <SelectItem value={DeviceType.BARCODE_SCANNER}>
                        {DEVICE_TYPE_LABELS[DeviceType.BARCODE_SCANNER]}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>포트 *</Label>
                  <Select
                    value={editingDevice?.port || ""}
                    onValueChange={(value) =>
                      setEditingDevice((prev) =>
                        prev ? { ...prev, port: value } : null
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="포트 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {commonPorts.map((port) => (
                        <SelectItem key={port.name} value={port.name}>
                          {port.name} ({port.vendor})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>제조사</Label>
                  <Input
                    value={editingDevice?.manufacturer || ""}
                    onChange={(e) =>
                      setEditingDevice((prev) =>
                        prev
                          ? {
                              ...prev,
                              manufacturer: e.target.value,
                            }
                          : null
                      )
                    }
                    placeholder="예: GPT"
                  />
                </div>

                <div className="space-y-2">
                  <Label>모델</Label>
                  <Input
                    value={editingDevice?.model || ""}
                    onChange={(e) =>
                      setEditingDevice((prev) =>
                        prev
                          ? {
                              ...prev,
                              model: e.target.value,
                            }
                          : null
                      )
                    }
                    placeholder="예: GPT-9000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>보드레이트</Label>
                  <Select
                    value={editingDevice?.baud_rate.toString() || "9600"}
                    onValueChange={(value) =>
                      setEditingDevice((prev) =>
                        prev
                          ? {
                              ...prev,
                              baud_rate: parseInt(value),
                            }
                          : null
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {validBaudRates.map((rate) => (
                        <SelectItem key={rate} value={rate.toString()}>
                          {rate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditDeviceOpen(false);
                    setEditingDevice(null);
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleUpdateDevice}
                  disabled={isLoading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? "저장 중..." : "수정 완료"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 등록된 설비 목록 섹션 */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Settings className="h-6 w-6 text-blue-600" />
            등록된 설비 ({registeredDevices.length}개)
          </CardTitle>
          <CardDescription className="text-base">
            현재 시스템에 등록된 측정 설비 목록을 확인하고 관리하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registeredDevices.length === 0 ? (
            <div className="text-center py-16">
              <Settings className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                등록된 설비가 없습니다
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                새로운 측정 설비를 추가하여 시작하세요
              </p>
              <Button
                onClick={() => setIsAddDeviceOpen(true)}
                variant="outline"
                className="border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />첫 설비 추가하기
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {registeredDevices.map((device) => (
                <div
                  key={device.id}
                  className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {device.device_type === "SAFETY_TESTER" ? (
                        <Zap className="h-4 w-4 text-orange-500" />
                      ) : device.device_type === "POWER_METER" ? (
                        <Power className="h-4 w-4 text-blue-500" />
                      ) : (
                        <QrCode className="h-4 w-4 text-green-500" />
                      )}
                      <span className="font-medium">{device.name}</span>
                      <Badge variant="outline">
                        {DEVICE_TYPE_LABELS[device.device_type as DeviceType] ||
                          device.device_type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {device.manufacturer && device.model
                          ? `${device.manufacturer} ${device.model}`
                          : device.manufacturer || device.model || ""}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {device.port} ({device.baud_rate})
                      </span>
                      <Badge
                        variant={
                          device.connection_status === "CONNECTED"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {device.connection_status === "CONNECTED"
                          ? "연결됨"
                          : "연결 안됨"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditDevice(device)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleDeleteDevice(device.id, device.name)
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 활동 로그 섹션 */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Activity className="h-6 w-6 text-green-600" />
            활동 로그
          </CardTitle>
          <CardDescription className="text-base">
            설비 관리와 관련된 최근 활동 내역을 확인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 h-40 overflow-y-auto border-2 border-dashed border-gray-200 dark:border-gray-700">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`flex gap-2 text-sm ${
                  log.type === "error"
                    ? "text-red-600"
                    : log.type === "success"
                    ? "text-green-600"
                    : "text-muted-foreground"
                }`}
              >
                <span className="text-xs text-muted-foreground min-w-[60px]">
                  {log.timestamp}
                </span>
                <span>{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-8">
                <Terminal className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                <p className="text-muted-foreground text-sm">
                  활동 로그가 없습니다
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
