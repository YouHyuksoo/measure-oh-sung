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
} from "lucide-react";
import { apiClient } from "@/lib/api";

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
  response?: string;
  code?: string;
  message: string;
}

interface LogEntry {
  timestamp: string;
  type: "info" | "success" | "error";
  message: string;
}

interface BarcodePort {
  port: string;
  description: string;
  hwid: string;
  type: "detected" | "manual";
}

interface BarcodeSettings {
  port: string;
  baudrate: number;
  data_bits: number;
  stop_bits: number;
  parity: "N" | "E" | "O";
  timeout: number;
}

interface BarcodeTestResult {
  success: boolean;
  message: string;
  data?: string;
  raw_data?: string;
}

interface DeviceCommand {
  id: number;
  name: string;
  category: string;
  command: string;
  description?: string;
  has_response: boolean;
  response_pattern?: string;
  timeout: number;
  retry_count: number;
  parameters?: Record<string, any>;
  parameter_description?: string;
  is_active: boolean;
  order_sequence: number;
  created_at: string;
  updated_at: string;
}

interface CommandExecutionResult {
  success: boolean;
  response_data?: string;
  error_message?: string;
  execution_time: number;
  timestamp: string;
}

export default function Gpt9000DevicePage() {
  // 공통 포트 목록 (모든 장비가 공유)
  const [commonPorts, setCommonPorts] = useState<SerialPort[]>([]);

  // 포트 및 연결 상태
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // 인터페이스 설정
  const [interfaceConfig, setInterfaceConfig] = useState<InterfaceConfig>({
    type: "RS232",
    baud: 115200,
  });

  // UI 상태
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastIdnResponse, setLastIdnResponse] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [rmtActive, setRmtActive] = useState(false);

  // 바코드 스캐너 관련 상태
  const [barcodePorts, setBarcodePorts] = useState<BarcodePort[]>([]);
  const [barcodeSettings, setBarcodeSettings] = useState<BarcodeSettings>({
    port: "",
    baudrate: 9600,
    data_bits: 8,
    stop_bits: 1,
    parity: "N",
    timeout: 1,
  });
  const [barcodeConnected, setBarcodeConnected] = useState(false);
  const [barcodeTestData, setBarcodeTestData] = useState<string>("");
  const [barcodeLogs, setBarcodeLogs] = useState<LogEntry[]>([]);

  // 전력 측정 설비 관련 상태
  const [selectedPowerMeterPort, setSelectedPowerMeterPort] =
    useState<string>("");
  const [powerMeterConnected, setPowerMeterConnected] =
    useState<boolean>(false);
  const [powerMeterInterface, setPowerMeterInterface] =
    useState<InterfaceConfig>({
      type: "RS232",
      baud: 9600,
    });
  const [lastPowerMeterResponse, setLastPowerMeterResponse] =
    useState<string>("");
  const [powerMeterLogs, setPowerMeterLogs] = useState<LogEntry[]>([]);

  // 명령어 관리 관련 상태
  const [showCommandManager, setShowCommandManager] = useState<boolean>(false);
  const [selectedDeviceForCommands, setSelectedDeviceForCommands] = useState<string>("");
  const [deviceCommands, setDeviceCommands] = useState<DeviceCommand[]>([]);
  const [commandExecutionResults, setCommandExecutionResults] = useState<Record<string, CommandExecutionResult>>({});
  const [commandLogs, setCommandLogs] = useState<LogEntry[]>([]);

  // 유효한 보드레이트 값들
  const validBaudRates = [9600, 19200, 38400, 57600, 115200];

  useEffect(() => {
    loadCommonPorts();
    loadInterfaceConfig();
    loadBarcodePorts();
    loadPowerMeterInterface();
  }, []);

  const addLog = (type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 9)]); // 최근 10개만 유지
  };

  const addBarcodeLog = (type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setBarcodeLogs((prev) => [newLog, ...prev.slice(0, 9)]); // 최근 10개만 유지
  };

  const addPowerMeterLog = (type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setPowerMeterLogs((prev) => [newLog, ...prev.slice(0, 9)]); // 최근 10개만 유지
  };

  const addCommandLog = (type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setCommandLogs((prev) => [newLog, ...prev.slice(0, 9)]); // 최근 10개만 유지
  };

  // 공통 포트 로드 함수 (모든 장비가 공유)
  const loadCommonPorts = async () => {
    try {
      // 시스템에서 감지된 포트 조회 (GPT-9000 API 사용)
      const detectedPorts = (await apiClient.getGpt9000Ports()) as SerialPort[];

      // 수동 포트 목록 (COM1~COM10)
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

      // 감지된 포트와 수동 포트 합치기 (중복 제거)
      const allPorts = [...manualPorts];
      detectedPorts.forEach((port: SerialPort) => {
        const exists = allPorts.some((p) => p.name === port.name);
        if (!exists) {
          allPorts.push(port);
        }
      });

      setCommonPorts(allPorts);
      addLog(
        "info",
        `공통 포트 ${allPorts.length}개 준비됨 (감지: ${detectedPorts.length}개)`
      );
    } catch (err) {
      console.error("포트 조회 실패:", err);
      // 에러 발생 시에도 수동 포트는 표시
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
      setCommonPorts(manualPorts);
      addLog("error", "포트 조회 실패 - 수동 포트만 표시");
    }
  };

  const loadInterfaceConfig = async () => {
    try {
      const config = (await apiClient.getGpt9000Interface()) as InterfaceConfig;
      setInterfaceConfig(config);
      addLog("info", `인터페이스 설정 로드됨: ${config.type}, ${config.baud}`);
    } catch (err) {
      console.error("인터페이스 설정 조회 실패:", err);
    }
  };

  // 전력 측정 설비 관련 함수들

  const loadPowerMeterInterface = async () => {
    try {
      const config =
        (await apiClient.getPowerMeterInterface()) as InterfaceConfig;
      setPowerMeterInterface(config);
      addPowerMeterLog(
        "info",
        `전력 측정 설비 인터페이스 설정 로드됨: ${config.type}, ${config.baud}`
      );
    } catch (err) {
      console.error("전력 측정 설비 인터페이스 설정 조회 실패:", err);
    }
  };

  const handleConnect = async () => {
    if (!selectedPort) {
      setError("포트를 선택해주세요");
      return;
    }

    try {
      setIsLoading(true);
      const result = (await apiClient.connectGpt9000Port(
        selectedPort,
        interfaceConfig.baud
      )) as TestResponse;

      if (result.ok) {
        setIsConnected(true);
        setError(null);
        addLog("success", `${selectedPort} 포트 연결 성공`);
      } else {
        setError(result.message || "연결 실패");
        addLog("error", result.message || "연결 실패");
      }
    } catch (err) {
      setError("연결 중 오류가 발생했습니다");
      addLog("error", "연결 오류");
      console.error("연결 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      const result = (await apiClient.disconnectGpt9000Port()) as TestResponse;

      if (result.ok) {
        setIsConnected(false);
        setError(null);
        setRmtActive(false);
        addLog("info", "연결 해제됨");
      } else {
        setError(result.message || "연결 해제 실패");
      }
    } catch (err) {
      setError("연결 해제 중 오류가 발생했습니다");
      console.error("연결 해제 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedPort) {
      setError("포트를 선택해주세요");
      return;
    }

    try {
      setIsLoading(true);
      const result = (await apiClient.testGpt9000Idn(
        selectedPort,
        interfaceConfig.baud
      )) as TestResponse;

      if (result.ok && result.response) {
        setLastIdnResponse(result.response);
        setError(null);
        // RMT 상태 감지 (예: 응답에서 원격 제어 상태 확인)
        setRmtActive(result.response.includes("RMT"));
        addLog("success", `연결 테스트 성공: ${result.response}`);
      } else {
        setError(result.message);
        setLastIdnResponse("");
        addLog("error", result.message);
      }
    } catch (err) {
      setError("테스트 중 오류가 발생했습니다");
      addLog("error", "테스트 실패");
      console.error("테스트 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyInterfaceSettings = async () => {
    try {
      setIsLoading(true);
      const result = (await apiClient.setGpt9000Interface(
        interfaceConfig.type,
        interfaceConfig.baud
      )) as TestResponse;

      if (result.ok) {
        setError(null);
        addLog(
          "success",
          `인터페이스 설정 적용됨: ${interfaceConfig.type}, ${interfaceConfig.baud}`
        );
      } else {
        setError(result.message || "설정 적용 실패");
        addLog("error", result.message || "설정 적용 실패");
      }
    } catch (err) {
      setError("설정 적용 중 오류가 발생했습니다");
      console.error("설정 적용 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 전력 측정 설비 핸들러 함수들
  const handlePowerMeterConnect = async () => {
    if (!selectedPowerMeterPort) {
      setError("전력 측정 설비 포트를 선택해주세요");
      return;
    }

    try {
      setIsLoading(true);
      const result = (await apiClient.connectPowerMeter(
        selectedPowerMeterPort,
        powerMeterInterface.baud
      )) as TestResponse;

      if (result.ok) {
        setPowerMeterConnected(true);
        setError(null);
        addPowerMeterLog("success", `${selectedPowerMeterPort} 포트 연결 성공`);
      } else {
        setError(result.message || "전력 측정 설비 연결 실패");
        addPowerMeterLog("error", result.message || "연결 실패");
      }
    } catch (err) {
      setError("전력 측정 설비 연결 중 오류가 발생했습니다");
      addPowerMeterLog("error", "연결 오류");
      console.error("전력 측정 설비 연결 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePowerMeterDisconnect = async () => {
    try {
      setIsLoading(true);
      const result = (await apiClient.disconnectPowerMeter()) as TestResponse;

      if (result.ok) {
        setPowerMeterConnected(false);
        setError(null);
        addPowerMeterLog("info", "전력 측정 설비 연결 해제됨");
      } else {
        setError(result.message || "전력 측정 설비 연결 해제 실패");
      }
    } catch (err) {
      setError("전력 측정 설비 연결 해제 중 오류가 발생했습니다");
      console.error("전력 측정 설비 연결 해제 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePowerMeterTest = async () => {
    if (!selectedPowerMeterPort) {
      setError("전력 측정 설비 포트를 선택해주세요");
      return;
    }

    try {
      setIsLoading(true);
      const result = (await apiClient.testPowerMeterIdn(
        selectedPowerMeterPort,
        powerMeterInterface.baud
      )) as TestResponse;

      if (result.ok && result.response) {
        setLastPowerMeterResponse(result.response);
        setError(null);
        addPowerMeterLog(
          "success",
          `전력 측정 설비 연결 테스트 성공: ${result.response}`
        );
      } else {
        setError(result.message);
        setLastPowerMeterResponse("");
        addPowerMeterLog("error", result.message);
      }
    } catch (err) {
      setError("전력 측정 설비 테스트 중 오류가 발생했습니다");
      addPowerMeterLog("error", "테스트 실패");
      console.error("전력 측정 설비 테스트 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPowerMeterSettings = async () => {
    try {
      setIsLoading(true);
      const result = (await apiClient.setPowerMeterInterface(
        powerMeterInterface.type,
        powerMeterInterface.baud
      )) as TestResponse;

      if (result.ok) {
        setError(null);
        addPowerMeterLog(
          "success",
          `전력 측정 설비 인터페이스 설정 적용됨: ${powerMeterInterface.type}, ${powerMeterInterface.baud}`
        );
      } else {
        setError(result.message || "전력 측정 설비 설정 적용 실패");
        addPowerMeterLog("error", result.message || "설정 적용 실패");
      }
    } catch (err) {
      setError("전력 측정 설비 설정 적용 중 오류가 발생했습니다");
      console.error("전력 측정 설비 설정 적용 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 명령어 관리 관련 함수들
  const loadDeviceCommands = async (deviceId: string) => {
    if (!deviceId) return;

    try {
      // Mock device ID - 실제로는 장비 선택에서 받아와야 함
      const mockDeviceId = deviceId === "GPT-9000" ? 1 : 2;

      addCommandLog("info", `장비 ID ${mockDeviceId}의 명령어 목록 로드 중...`);

      // 실제 API 호출 (현재는 mock 데이터)
      const mockCommands: DeviceCommand[] = deviceId === "GPT-9000" ? [
        // 3대안전설비 (GPT-9000) 명령어들
        {
          id: 1,
          name: "장비 식별",
          category: "IDENTIFICATION",
          command: "*IDN?",
          description: "장비 식별 정보 조회 (IEEE 488.2)",
          has_response: true,
          response_pattern: "GPT-9801,MODEL-PE200,FW1.1.0,SN000001,RMT",
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: "시스템 오류 조회",
          category: "STATUS",
          command: "SYSTem:ERRor?",
          description: "시스템 오류 상태 조회",
          has_response: true,
          response_pattern: "0,\"No error\"",
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 3,
          name: "측정값 조회",
          category: "MEASUREMENT",
          command: "MEASure?",
          description: "현재 측정값 조회",
          has_response: true,
          response_pattern: ">ACW, PASS, 1.500kV, 0.050mA, T=005.0S, R=001.0S",
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 4,
          name: "수동/자동 모드 전환",
          category: "CONTROL",
          command: "MAIN:FUNCtion MANU",
          description: "수동/자동 모드 전환",
          has_response: false,
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 4,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 5,
          name: "ACW 전압 설정",
          category: "CONFIGURATION",
          command: "MANU:ACW:VOLTage 1.5",
          description: "AC 내전압 테스트 전압 설정 (0.05-5kV)",
          has_response: false,
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 6,
          name: "ACW 상한 전류 설정",
          category: "CONFIGURATION",
          command: "MANU:ACW:CHISet 1.0",
          description: "AC 내전압 테스트 상한 전류 설정",
          has_response: false,
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 6,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 7,
          name: "DCW 전압 설정",
          category: "CONFIGURATION",
          command: "MANU:DCW:VOLTage 1.5",
          description: "DC 내전압 테스트 전압 설정 (0.05-6kV)",
          has_response: false,
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 7,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 8,
          name: "IR 전압 설정",
          category: "CONFIGURATION",
          command: "MANU:IR:VOLTage 0.5",
          description: "절연저항 테스트 전압 설정 (0.05-1kV)",
          has_response: false,
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 9,
          name: "GB 전류 설정",
          category: "CONFIGURATION",
          command: "MANU:GB:CURRent 10",
          description: "접지연속성 테스트 전류 설정",
          has_response: false,
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 9,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 10,
          name: "부저 통과음 설정",
          category: "CONFIGURATION",
          command: "SYSTem:BUZZer:PSOUND ON",
          description: "검사 통과 시 부저음 설정",
          has_response: false,
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ] : [
        // 전력측정설비 명령어들
        {
          id: 11,
          name: "장비 식별",
          category: "IDENTIFICATION",
          command: "*IDN?",
          description: "장비 식별 정보 조회",
          has_response: true,
          response_pattern: "PWR-EMU,MODEL-PE200,FW1.1.0,SN000001",
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 12,
          name: "전력 측정",
          category: "MEASUREMENT",
          command: "MEAS:POW?",
          description: "순간 전력값 조회",
          has_response: true,
          response_pattern: "123.456W",
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 13,
          name: "전압 측정",
          category: "MEASUREMENT",
          command: "MEAS:VOLT?",
          description: "RMS 전압값 조회",
          has_response: true,
          response_pattern: "220.03V",
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 14,
          name: "전류 측정",
          category: "MEASUREMENT",
          command: "MEAS:CURR?",
          description: "RMS 전류값 조회",
          has_response: true,
          response_pattern: "0.561A",
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 4,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 15,
          name: "스트리밍 시작",
          category: "STREAMING",
          command: "CONF:STREAM ON",
          description: "실시간 데이터 스트리밍 시작",
          has_response: true,
          response_pattern: "OK",
          timeout: 5,
          retry_count: 3,
          is_active: true,
          order_sequence: 5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const filteredCommands = mockCommands.filter(cmd => cmd.is_active);

      setDeviceCommands(filteredCommands);
      addCommandLog("success", `${filteredCommands.length}개 명령어 로드됨`);
    } catch (error) {
      addCommandLog("error", `명령어 로드 실패: ${error}`);
    }
  };

  const executeCommand = async (commandId: number) => {
    const command = deviceCommands.find(cmd => cmd.id === commandId);
    if (!command) return;

    addCommandLog("info", `명령어 실행 중: ${command.name}`);

    try {
      // 실제 API 호출 시뮬레이션
      const mockResult: CommandExecutionResult = {
        success: Math.random() > 0.3, // 70% 성공률
        response_data: command.has_response ?
          (command.response_pattern || "OK") + " (시뮬레이션)" : undefined,
        error_message: Math.random() > 0.7 ? "연결 오류 시뮬레이션" : undefined,
        execution_time: Math.random() * 2 + 0.5, // 0.5-2.5초
        timestamp: new Date().toISOString(),
      };

      // 결과 저장
      setCommandExecutionResults(prev => ({
        ...prev,
        [commandId]: mockResult
      }));

      if (mockResult.success) {
        addCommandLog("success",
          `${command.name} 실행 성공: ${mockResult.response_data || "OK"}`
        );
      } else {
        addCommandLog("error",
          `${command.name} 실행 실패: ${mockResult.error_message}`
        );
      }
    } catch (error) {
      addCommandLog("error", `명령어 실행 오류: ${error}`);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "IDENTIFICATION": return <QrCode className="h-4 w-4" />;
      case "STATUS": return <Activity className="h-4 w-4" />;
      case "CONTROL": return <Settings className="h-4 w-4" />;
      case "MEASUREMENT": return <Power className="h-4 w-4" />;
      case "CONFIGURATION": return <Settings className="h-4 w-4" />;
      case "STREAMING": return <Terminal className="h-4 w-4" />;
      default: return <Terminal className="h-4 w-4" />;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case "IDENTIFICATION": return "식별";
      case "STATUS": return "상태";
      case "CONTROL": return "제어";
      case "MEASUREMENT": return "측정";
      case "CONFIGURATION": return "설정";
      case "STREAMING": return "스트리밍";
      default: return category;
    }
  };

  // 바코드 스캐너 관련 함수들
  const loadBarcodePorts = async () => {
    try {
      const data = (await apiClient.getBarcodePorts()) as {
        ports: BarcodePort[];
      };
      setBarcodePorts(data.ports || []);
      const detected =
        data.ports?.filter((p: BarcodePort) => p.type === "detected").length ||
        0;
      const manual =
        data.ports?.filter((p: BarcodePort) => p.type === "manual").length || 0;
      addBarcodeLog(
        "info",
        `바코드 포트 ${
          data.ports?.length || 0
        }개 로드됨 (감지: ${detected}개, 수동: ${manual}개)`
      );
    } catch (err) {
      console.error("바코드 포트 조회 실패:", err);
      // 에러 발생 시에도 수동 포트는 표시
      const manualPorts: BarcodePort[] = [
        {
          port: "COM1",
          description: "수동 선택 포트",
          hwid: "",
          type: "manual",
        },
        {
          port: "COM2",
          description: "수동 선택 포트",
          hwid: "",
          type: "manual",
        },
        {
          port: "COM3",
          description: "수동 선택 포트",
          hwid: "",
          type: "manual",
        },
        {
          port: "COM4",
          description: "수동 선택 포트",
          hwid: "",
          type: "manual",
        },
        {
          port: "COM5",
          description: "수동 선택 포트",
          hwid: "",
          type: "manual",
        },
        {
          port: "COM6",
          description: "수동 선택 포트",
          hwid: "",
          type: "manual",
        },
        {
          port: "COM7",
          description: "수동 선택 포트",
          hwid: "",
          type: "manual",
        },
        {
          port: "COM8",
          description: "수동 선택 포트",
          hwid: "",
          type: "manual",
        },
        {
          port: "COM9",
          description: "수동 선택 포트",
          hwid: "",
          type: "manual",
        },
        {
          port: "COM10",
          description: "수동 선택 포트",
          hwid: "",
          type: "manual",
        },
      ];
      setBarcodePorts(manualPorts);
      addBarcodeLog("error", "포트 조회 실패 - 수동 포트만 표시");
    }
  };

  const handleBarcodeConnect = async () => {
    if (!barcodeSettings.port) {
      setError("바코드 스캐너 포트를 선택해주세요");
      return;
    }

    try {
      setIsLoading(true);
      const result = (await apiClient.connectBarcodeScanner(
        barcodeSettings
      )) as BarcodeTestResult;

      if (result.success) {
        setBarcodeConnected(true);
        setError(null);
        addBarcodeLog(
          "success",
          `바코드 스캐너 연결 성공: ${barcodeSettings.port}`
        );
      } else {
        setError(result.message || "바코드 스캐너 연결 실패");
        addBarcodeLog("error", result.message || "연결 실패");
      }
    } catch (err) {
      setError("바코드 스캐너 연결 중 오류가 발생했습니다");
      addBarcodeLog("error", "연결 오류");
      console.error("바코드 연결 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBarcodeDisconnect = () => {
    setBarcodeConnected(false);
    setBarcodeTestData("");
    addBarcodeLog("info", "바코드 스캐너 연결 해제됨");
  };

  const handleBarcodeTest = async () => {
    if (!barcodeSettings.port) {
      setError("바코드 스캐너 포트를 선택해주세요");
      return;
    }

    try {
      setIsLoading(true);
      const result = (await apiClient.testBarcodeRead(
        barcodeSettings
      )) as BarcodeTestResult;

      if (result.success) {
        setBarcodeTestData(result.data || "");
        setError(null);
        addBarcodeLog("success", `바코드 읽기 성공: ${result.data}`);
      } else {
        setBarcodeTestData("");
        setError(result.message);
        addBarcodeLog("error", result.message);
      }
    } catch (err) {
      setError("바코드 테스트 중 오류가 발생했습니다");
      addBarcodeLog("error", "테스트 실패");
      console.error("바코드 테스트 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getBarcodeConnectionBadge = () => {
    if (barcodeConnected) {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
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

  const getPowerMeterConnectionBadge = () => {
    if (powerMeterConnected) {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
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

  const getConnectionBadge = () => {
    if (isConnected) {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
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

  const getInterfaceDescription = (type: string) => {
    switch (type) {
      case "USB":
        return "USB는 가상 RS-232(CDC)로 동작. 장치관리자에서 COM 번호/보드레이트 확인 필요.";
      case "RS232":
        return "";
      case "GPIB":
        return "GPIB 인터페이스 (옵션)";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">장비 관리</h1>
          <p className="text-muted-foreground">
            3대안전설비(GPT-9000), 전력측정설비, 바코드스캐너 통신 설정 및 연결
            관리
          </p>
        </div>
        <div className="flex items-center gap-4">
          {rmtActive && (
            <Badge
              variant="outline"
              className="text-orange-600 border-orange-600"
            >
              <Activity className="h-3 w-3 mr-1" />
              RMT 원격제어 중
            </Badge>
          )}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* 3대안전설비 (GPT-9000 시리즈) 카드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              3대안전설비 (GPT-9000)
            </CardTitle>
            <CardDescription>
              GPT-9801/9802/9803/9804 통신 설정 및 연결 관리
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">연결 상태</span>
              {getConnectionBadge()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">COM 포트</Label>
              <div className="flex gap-2">
                <Select value={selectedPort} onValueChange={setSelectedPort}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="포트를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    {commonPorts.map((port) => (
                      <SelectItem
                        key={port.name}
                        value={port.name}
                        className="text-black hover:bg-gray-100 focus:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium text-black">
                            {port.name}
                          </span>
                          {port.vendor && (
                            <span className="text-xs text-gray-500">
                              - {port.vendor}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={loadCommonPorts}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>인터페이스 타입</Label>
              <Select
                value={interfaceConfig.type}
                onValueChange={(value: "USB" | "RS232" | "GPIB") =>
                  setInterfaceConfig((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USB">USB</SelectItem>
                  <SelectItem value="RS232">RS-232</SelectItem>
                  <SelectItem value="GPIB" disabled>
                    GPIB (옵션)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getInterfaceDescription(interfaceConfig.type)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>보드레이트</Label>
              <Select
                value={interfaceConfig.baud.toString()}
                onValueChange={(value) =>
                  setInterfaceConfig((prev) => ({
                    ...prev,
                    baud: parseInt(value),
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

            <div className="flex gap-2">
              {isConnected ? (
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  className="flex-1"
                >
                  연결 해제
                </Button>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={isLoading || !selectedPort}
                  className="flex-1"
                >
                  연결
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isLoading || !selectedPort}
                title="*IDN? 테스트"
              >
                <Activity className="h-4 w-4 mr-1" />
                테스트
              </Button>
            </div>

            <Button
              onClick={handleApplyInterfaceSettings}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              설정 적용
            </Button>

            {/* 테스트 결과 */}
            {lastIdnResponse && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm font-medium text-green-800">
                  3대안전설비 응답:
                </p>
                <p className="text-sm text-green-600 font-mono mt-1">
                  {lastIdnResponse}
                </p>
              </div>
            )}

            {/* 로그 뷰어 */}
            <div className="space-y-2">
              <Label className="text-sm">3대안전설비 로그</Label>
              <div className="h-24 p-2 bg-gray-50 border rounded-md overflow-y-auto text-sm">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`flex gap-2 text-xs ${
                      log.type === "error"
                        ? "text-red-600"
                        : log.type === "success"
                        ? "text-green-600"
                        : "text-gray-600"
                    }`}
                  >
                    <span className="text-gray-400">{log.timestamp}</span>
                    <span>{log.message}</span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-gray-400 text-xs">로그가 없습니다</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 전력 측정 설비 카드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power className="h-5 w-5" />
              전력 측정 설비
            </CardTitle>
            <CardDescription>
              전력 측정 설비 연결 설정 및 통신 관리
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">연결 상태</span>
              {getPowerMeterConnectionBadge()}
            </div>

            <div className="space-y-2">
              <Label>COM 포트</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedPowerMeterPort}
                  onValueChange={setSelectedPowerMeterPort}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="전력 측정 포트 선택" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    {commonPorts.map((port) => (
                      <SelectItem
                        key={port.name}
                        value={port.name}
                        className="text-black hover:bg-gray-100 focus:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          <Power className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-black">
                            {port.name}
                          </span>
                          {port.vendor && (
                            <span className="text-xs text-gray-500">
                              - {port.vendor}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={loadCommonPorts}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>인터페이스 타입</Label>
              <Select
                value={powerMeterInterface.type}
                onValueChange={(value: "USB" | "RS232" | "GPIB") =>
                  setPowerMeterInterface((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USB">USB</SelectItem>
                  <SelectItem value="RS232">RS-232</SelectItem>
                  <SelectItem value="GPIB" disabled>
                    GPIB (옵션)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>보드레이트</Label>
              <Select
                value={powerMeterInterface.baud.toString()}
                onValueChange={(value) =>
                  setPowerMeterInterface((prev) => ({
                    ...prev,
                    baud: parseInt(value),
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

            <div className="flex gap-2">
              {powerMeterConnected ? (
                <Button
                  variant="destructive"
                  onClick={handlePowerMeterDisconnect}
                  disabled={isLoading}
                  className="flex-1"
                >
                  연결 해제
                </Button>
              ) : (
                <Button
                  onClick={handlePowerMeterConnect}
                  disabled={isLoading || !selectedPowerMeterPort}
                  className="flex-1"
                >
                  연결
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handlePowerMeterTest}
                disabled={isLoading || !selectedPowerMeterPort}
                title="*IDN? 테스트"
              >
                <Activity className="h-4 w-4 mr-1" />
                테스트
              </Button>
            </div>

            <Button
              onClick={handleApplyPowerMeterSettings}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              설정 적용
            </Button>

            {/* 전력 측정 설비 테스트 결과 */}
            {lastPowerMeterResponse && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm font-medium text-green-800">
                  전력 측정 설비 응답:
                </p>
                <p className="text-sm text-green-600 font-mono mt-1">
                  {lastPowerMeterResponse}
                </p>
              </div>
            )}

            {/* 전력 측정 설비 로그 */}
            <div className="space-y-2">
              <Label className="text-sm">전력 측정 설비 로그</Label>
              <div className="h-24 p-2 bg-gray-50 border rounded-md overflow-y-auto text-sm">
                {powerMeterLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`flex gap-2 text-xs ${
                      log.type === "error"
                        ? "text-red-600"
                        : log.type === "success"
                        ? "text-green-600"
                        : "text-gray-600"
                    }`}
                  >
                    <span className="text-gray-400">{log.timestamp}</span>
                    <span>{log.message}</span>
                  </div>
                ))}
                {powerMeterLogs.length === 0 && (
                  <p className="text-gray-400 text-xs">로그가 없습니다</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 바코드 스캐너 설정 카드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              바코드 스캐너
            </CardTitle>
            <CardDescription>
              시리얼 통신 바코드 스캐너 연결 설정
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">연결 상태</span>
              {getBarcodeConnectionBadge()}
            </div>

            <div className="space-y-2">
              <Label>COM 포트</Label>
              <div className="flex gap-2">
                <Select
                  value={barcodeSettings.port}
                  onValueChange={(value) =>
                    setBarcodeSettings((prev) => ({ ...prev, port: value }))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="바코드 포트 선택" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    {barcodePorts.map((port) => (
                      <SelectItem
                        key={port.port}
                        value={port.port}
                        className="text-black hover:bg-gray-100 focus:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {port.type === "detected" ? (
                            <Scan className="h-4 w-4 text-green-600" />
                          ) : (
                            <Scan className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-sm font-medium text-black">
                            {port.port}
                          </span>
                          <span className="text-xs text-gray-500">
                            - {port.type === "detected" ? "감지됨" : "수동"}
                          </span>
                          {port.description && port.type === "detected" && (
                            <span className="text-xs text-gray-400">
                              ({port.description})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={loadBarcodePorts}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">보드레이트</Label>
                <Select
                  value={barcodeSettings.baudrate.toString()}
                  onValueChange={(value) =>
                    setBarcodeSettings((prev) => ({
                      ...prev,
                      baudrate: parseInt(value),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    {validBaudRates.map((rate) => (
                      <SelectItem
                        key={rate}
                        value={rate.toString()}
                        className="text-black hover:bg-gray-100 focus:bg-gray-100"
                      >
                        {rate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">패리티</Label>
                <Select
                  value={barcodeSettings.parity}
                  onValueChange={(value: "N" | "E" | "O") =>
                    setBarcodeSettings((prev) => ({ ...prev, parity: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    <SelectItem
                      value="N"
                      className="text-black hover:bg-gray-100 focus:bg-gray-100"
                    >
                      None
                    </SelectItem>
                    <SelectItem
                      value="E"
                      className="text-black hover:bg-gray-100 focus:bg-gray-100"
                    >
                      Even
                    </SelectItem>
                    <SelectItem
                      value="O"
                      className="text-black hover:bg-gray-100 focus:bg-gray-100"
                    >
                      Odd
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              {barcodeConnected ? (
                <Button
                  variant="destructive"
                  onClick={handleBarcodeDisconnect}
                  disabled={isLoading}
                  className="flex-1"
                >
                  연결 해제
                </Button>
              ) : (
                <Button
                  onClick={handleBarcodeConnect}
                  disabled={isLoading || !barcodeSettings.port}
                  className="flex-1"
                >
                  연결
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleBarcodeTest}
                disabled={isLoading || !barcodeSettings.port}
                title="바코드 읽기 테스트"
              >
                <Scan className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={() => {
                // 바코드 설정 적용 로직 (현재는 단순히 로그만 추가)
                addBarcodeLog("success", "바코드 스캐너 설정이 적용되었습니다");
              }}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              설정 적용
            </Button>

            {/* 바코드 테스트 결과 */}
            {barcodeTestData && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium text-blue-800">
                  바코드 데이터:
                </p>
                <p className="text-sm text-blue-600 font-mono mt-1 break-all">
                  {barcodeTestData}
                </p>
              </div>
            )}

            {/* 바코드 로그 */}
            <div className="space-y-2">
              <Label className="text-sm">바코드 로그</Label>
              <div className="h-24 p-2 bg-gray-50 border rounded-md overflow-y-auto text-sm">
                {barcodeLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`flex gap-2 text-xs ${
                      log.type === "error"
                        ? "text-red-600"
                        : log.type === "success"
                        ? "text-green-600"
                        : "text-gray-600"
                    }`}
                  >
                    <span className="text-gray-400">{log.timestamp}</span>
                    <span>{log.message}</span>
                  </div>
                ))}
                {barcodeLogs.length === 0 && (
                  <p className="text-gray-400 text-xs">로그가 없습니다</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 현재 상태 요약 */}
      <Card>
        <CardHeader>
          <CardTitle>현재 상태 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 3대안전설비 상태 */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                3대안전설비 (GPT-9000)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">인터페이스:</span>
                  <Badge variant="outline" className="ml-2">
                    {interfaceConfig.type}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">보드레이트:</span>
                  <span className="ml-2 font-mono">{interfaceConfig.baud}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">포트:</span>
                  <span className="ml-2 font-mono">
                    {selectedPort || "미선택"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">연결 상태:</span>
                  <span className="ml-2">{getConnectionBadge()}</span>
                </div>
              </div>
            </div>

            {/* 전력 측정 설비 상태 */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Power className="h-4 w-4" />
                전력 측정 설비
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">인터페이스:</span>
                  <Badge variant="outline" className="ml-2">
                    {powerMeterInterface.type}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">보드레이트:</span>
                  <span className="ml-2 font-mono">
                    {powerMeterInterface.baud}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">포트:</span>
                  <span className="ml-2 font-mono">
                    {selectedPowerMeterPort || "미선택"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">연결 상태:</span>
                  <span className="ml-2">{getPowerMeterConnectionBadge()}</span>
                </div>
              </div>
            </div>

            {/* 바코드 스캐너 상태 */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                바코드 스캐너
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">포트:</span>
                  <span className="ml-2 font-mono">
                    {barcodeSettings.port || "미선택"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">보드레이트:</span>
                  <span className="ml-2 font-mono">
                    {barcodeSettings.baudrate}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">설정:</span>
                  <span className="ml-2 font-mono">
                    {barcodeSettings.data_bits}-{barcodeSettings.parity}-
                    {barcodeSettings.stop_bits}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">연결 상태:</span>
                  <span className="ml-2">{getBarcodeConnectionBadge()}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SCPI 명령어 관리 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            SCPI 명령어 관리
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCommandManager(!showCommandManager)}
              className="ml-auto"
            >
              {showCommandManager ? "숨기기" : "보기"}
            </Button>
          </CardTitle>
          <CardDescription>
            장비별 SCPI(Standard Commands for Programmable Instruments) 명령어를 등록하고 실행할 수 있습니다
          </CardDescription>
        </CardHeader>
        {showCommandManager && (
          <CardContent className="space-y-4">
            {/* 장비 선택 */}
            <div className="space-y-2">
              <Label>장비 선택</Label>
              <Select
                value={selectedDeviceForCommands}
                onValueChange={(value) => {
                  setSelectedDeviceForCommands(value);
                  loadDeviceCommands(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="명령어를 관리할 장비를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GPT-9000">3대안전설비 (GPT-9000)</SelectItem>
                  <SelectItem value="전력측정설비">전력측정설비</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedDeviceForCommands && (
              <>
                {/* 명령어 목록 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">등록된 명령어</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadDeviceCommands(selectedDeviceForCommands)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        새로고침
                      </Button>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        명령어 추가
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {deviceCommands.map((command) => {
                      const result = commandExecutionResults[command.id];
                      return (
                        <div
                          key={command.id}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(command.category)}
                              <span className="font-medium">{command.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {getCategoryName(command.category)}
                              </Badge>
                              {!command.is_active && (
                                <Badge variant="secondary" className="text-xs">
                                  비활성
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => executeCommand(command.id)}
                                disabled={!command.is_active || isLoading}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                실행
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          <div className="text-sm text-gray-600">
                            <div className="flex items-center gap-4">
                              <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                {command.command}
                              </span>
                              {command.has_response && (
                                <span className="text-xs text-gray-500">
                                  응답: {command.response_pattern}
                                </span>
                              )}
                            </div>
                            {command.description && (
                              <p className="text-xs text-gray-500 mt-1">
                                {command.description}
                              </p>
                            )}
                          </div>

                          {/* 실행 결과 */}
                          {result && (
                            <div
                              className={`p-2 rounded text-sm ${
                                result.success
                                  ? "bg-green-50 border border-green-200"
                                  : "bg-red-50 border border-red-200"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`font-medium ${
                                    result.success ? "text-green-800" : "text-red-800"
                                  }`}
                                >
                                  {result.success ? "✓ 실행 성공" : "✗ 실행 실패"}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {result.execution_time.toFixed(2)}초
                                </span>
                              </div>
                              {result.response_data && (
                                <div
                                  className={`mt-1 font-mono text-xs ${
                                    result.success ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  응답: {result.response_data}
                                </div>
                              )}
                              {result.error_message && (
                                <div className="mt-1 text-xs text-red-600">
                                  오류: {result.error_message}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {deviceCommands.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>등록된 명령어가 없습니다</p>
                        <p className="text-sm">명령어를 추가해보세요</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 명령어 실행 로그 */}
                <div className="space-y-2">
                  <Label className="text-sm">명령어 실행 로그</Label>
                  <div className="h-32 p-2 bg-gray-50 border rounded-md overflow-y-auto text-sm">
                    {commandLogs.map((log, index) => (
                      <div
                        key={index}
                        className={`flex gap-2 text-xs ${
                          log.type === "error"
                            ? "text-red-600"
                            : log.type === "success"
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}
                      >
                        <span className="text-gray-400">{log.timestamp}</span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                    {commandLogs.length === 0 && (
                      <p className="text-gray-400 text-xs">로그가 없습니다</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
