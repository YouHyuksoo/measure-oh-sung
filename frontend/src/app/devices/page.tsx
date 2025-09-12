"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Zap,
  Plus,
  Settings,
  Play,
  Square,
  Trash2,
  Edit,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Cable,
  WifiOff,
  Activity,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface Device {
  id: number;
  name: string;
  device_type: "MULTIMETER" | "OSCILLOSCOPE" | "POWER_SUPPLY" | "OTHER";
  port: string;
  baud_rate: number;
  connection_status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  description?: string;
  created_at: string;
  is_active: boolean;
}

interface DeviceStatus {
  device_id: number;
  is_connected: boolean;
  last_response?: string;
  error_message?: string;
}

interface SerialPort {
  port: string;
  description?: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<
    Record<number, DeviceStatus>
  >({});
  const [availablePorts, setAvailablePorts] = useState<SerialPort[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState({
    name: "",
    device_type: "MULTIMETER" as Device["device_type"],
    port: "",
    baud_rate: 9600,
    description: "",
  });

  // 데이터 로드
  useEffect(() => {
    loadDevices();
    loadAvailablePorts();
  }, []);

  const loadDevices = async () => {
    try {
      setIsLoading(true);
      const response = (await apiClient.getDevices()) as
        | Device[]
        | { devices?: Device[] };

      // API 응답에서 devices 배열 추출
      const devices = Array.isArray(response)
        ? response
        : response.devices || [];
      setDevices(devices);

      // 각 장비의 상태 확인
      for (const device of devices) {
        try {
          const status = await apiClient.getDeviceStatus(device.id);
          setDeviceStatuses((prev) => ({
            ...prev,
            [device.id]: status as DeviceStatus,
          }));
        } catch (err) {
          console.error(`장비 ${device.id} 상태 확인 실패:`, err);
        }
      }
    } catch (err) {
      setError("장비 목록을 불러올 수 없습니다");
      console.error("장비 로드 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailablePorts = async () => {
    try {
      const ports = await apiClient.getAvailablePorts();
      setAvailablePorts(ports as SerialPort[]);
    } catch (err) {
      console.error("포트 조회 오류:", err);
    }
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await apiClient.createDevice(formData);
      setShowAddForm(false);
      setFormData({
        name: "",
        device_type: "MULTIMETER",
        port: "",
        baud_rate: 9600,
        description: "",
      });
      await loadDevices();
      setError(null);
    } catch (err) {
      setError("장비를 추가할 수 없습니다");
      console.error("장비 생성 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;

    try {
      setIsLoading(true);
      await apiClient.updateDevice(editingDevice.id, formData);
      setEditingDevice(null);
      setFormData({
        name: "",
        device_type: "MULTIMETER",
        port: "",
        baud_rate: 9600,
        description: "",
      });
      await loadDevices();
      setError(null);
    } catch (err) {
      setError("장비를 수정할 수 없습니다");
      console.error("장비 수정 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: number) => {
    if (!confirm("이 장비를 삭제하시겠습니까?")) return;

    try {
      setIsLoading(true);
      await apiClient.deleteDevice(deviceId);
      await loadDevices();
      setError(null);
    } catch (err) {
      setError("장비를 삭제할 수 없습니다");
      console.error("장비 삭제 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectDevice = async (deviceId: number) => {
    try {
      setIsLoading(true);
      await apiClient.connectDevice(deviceId);

      // 상태 업데이트
      const status = await apiClient.getDeviceStatus(deviceId);
      setDeviceStatuses((prev) => ({
        ...prev,
        [deviceId]: status as DeviceStatus,
      }));
      setError(null);
    } catch (err) {
      setError("장비에 연결할 수 없습니다");
      console.error("장비 연결 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectDevice = async (deviceId: number) => {
    try {
      setIsLoading(true);
      await apiClient.disconnectDevice(deviceId);

      // 상태 업데이트
      const status = await apiClient.getDeviceStatus(deviceId);
      setDeviceStatuses((prev) => ({
        ...prev,
        [deviceId]: status as DeviceStatus,
      }));
      setError(null);
    } catch (err) {
      setError("장비 연결을 해제할 수 없습니다");
      console.error("장비 연결 해제 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestDevice = async (deviceId: number) => {
    try {
      setIsLoading(true);
      await apiClient.testDevice(deviceId);

      // 상태 업데이트
      const status = await apiClient.getDeviceStatus(deviceId);
      setDeviceStatuses((prev) => ({
        ...prev,
        [deviceId]: status as DeviceStatus,
      }));
      setError(null);
    } catch (err) {
      setError("장비 테스트에 실패했습니다");
      console.error("장비 테스트 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (device: Device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      device_type: device.device_type,
      port: device.port,
      baud_rate: device.baud_rate,
      description: device.description || "",
    });
    setShowAddForm(true);
  };

  const cancelEditing = () => {
    setEditingDevice(null);
    setShowAddForm(false);
    setFormData({
      name: "",
      device_type: "MULTIMETER",
      port: "",
      baud_rate: 9600,
      description: "",
    });
  };

  const getDeviceTypeLabel = (type: string) => {
    const labels = {
      MULTIMETER: "멀티미터",
      OSCILLOSCOPE: "오실로스코프",
      POWER_SUPPLY: "전원공급장치",
      OTHER: "기타",
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getConnectionBadge = (deviceId: number) => {
    const status = deviceStatuses[deviceId];
    if (!status) {
      return (
        <Badge variant="secondary">
          <Cable className="h-3 w-3 mr-1" />알 수 없음
        </Badge>
      );
    }

    if (status.is_connected) {
      return (
        <Badge variant="success">
          <CheckCircle className="h-3 w-3 mr-1" />
          연결됨
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <WifiOff className="h-3 w-3 mr-1" />
          연결 끊김
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">장비 관리</h1>
          <p className="text-muted-foreground">계측 장비 연결 및 설정 관리</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadAvailablePorts} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
            <Plus className="h-4 w-4 mr-2" />
            장비 추가
          </Button>
        </div>
      </div>

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

      {/* 장비 추가/수정 폼 */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingDevice ? "장비 수정" : "새 장비 추가"}
            </CardTitle>
            <CardDescription>
              계측 장비의 정보를 입력하고 시리얼 포트를 설정하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={editingDevice ? handleUpdateDevice : handleCreateDevice}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">장비명</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="장비명을 입력하세요"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="device_type">장비 유형</Label>
                  <Select
                    value={formData.device_type}
                    onValueChange={(value: string) =>
                      setFormData((prev) => ({
                        ...prev,
                        device_type: value as Device["device_type"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MULTIMETER">멀티미터</SelectItem>
                      <SelectItem value="OSCILLOSCOPE">오실로스코프</SelectItem>
                      <SelectItem value="POWER_SUPPLY">전원공급장치</SelectItem>
                      <SelectItem value="OTHER">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">시리얼 포트</Label>
                  <Select
                    value={formData.port}
                    onValueChange={(value: string) =>
                      setFormData((prev) => ({ ...prev, port: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="포트를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePorts.map((port) => (
                        <SelectItem key={port.port} value={port.port}>
                          {port.port}{" "}
                          {port.description && `- ${port.description}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baud_rate">통신속도</Label>
                  <Select
                    value={formData.baud_rate.toString()}
                    onValueChange={(value: string) =>
                      setFormData((prev) => ({
                        ...prev,
                        baud_rate: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9600">9600</SelectItem>
                      <SelectItem value="19200">19200</SelectItem>
                      <SelectItem value="38400">38400</SelectItem>
                      <SelectItem value="57600">57600</SelectItem>
                      <SelectItem value="115200">115200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="장비에 대한 설명 (선택사항)"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  {editingDevice ? "수정" : "추가"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEditing}>
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 장비 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading && devices.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              로딩 중...
            </CardContent>
          </Card>
        ) : devices.length > 0 ? (
          devices.map((device) => {
            const status = deviceStatuses[device.id];
            const isConnected = status?.is_connected || false;

            return (
              <Card key={device.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{device.name}</CardTitle>
                      <CardDescription>
                        {getDeviceTypeLabel(device.device_type)}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditing(device)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteDevice(device.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        연결 상태
                      </span>
                      {getConnectionBadge(device.id)}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        포트
                      </span>
                      <Badge variant="outline">{device.port}</Badge>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        통신속도
                      </span>
                      <span className="text-sm font-mono">
                        {device.baud_rate}
                      </span>
                    </div>

                    {device.description && (
                      <div className="text-sm text-muted-foreground">
                        {device.description}
                      </div>
                    )}

                    {status?.error_message && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                          {status.error_message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isConnected ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisconnectDevice(device.id)}
                        disabled={isLoading}
                        className="flex-1"
                      >
                        <Square className="h-3 w-3 mr-1" />
                        연결 해제
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleConnectDevice(device.id)}
                        disabled={isLoading}
                        className="flex-1"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        연결
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestDevice(device.id)}
                      disabled={isLoading || !isConnected}
                    >
                      <Activity className="h-3 w-3 mr-1" />
                      테스트
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Zap className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">등록된 장비가 없습니다</p>
              <Button
                onClick={() => setShowAddForm(true)}
                className="mt-4"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />첫 번째 장비 추가
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
