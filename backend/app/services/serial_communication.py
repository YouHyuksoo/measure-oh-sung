import serial
import time
import asyncio
import logging
from typing import Optional, Dict, Any, List
from concurrent.futures import ThreadPoolExecutor
import threading

from app.models.device import Device, ConnectionStatus

logger = logging.getLogger(__name__)

class SerialCommunicationService:
    """RS-232 시리얼 통신 서비스"""
    
    def __init__(self):
        self.connections: Dict[int, serial.Serial] = {}  # device_id -> Serial connection
        self.executor = ThreadPoolExecutor(max_workers=10)  # 비동기 시리얼 통신용
        self.lock = threading.Lock()
        
    def connect_device(self, device: Device) -> bool:
        """장비에 연결합니다."""
        try:
            with self.lock:
                # 이미 연결되어 있는 경우 연결 해제 후 재연결
                if device.id in self.connections:
                    self.disconnect_device(device.id)
                
                # 시리얼 연결 생성
                connection = serial.Serial(
                    port=device.port,
                    baudrate=device.baud_rate,
                    bytesize=device.data_bits,
                    parity=self._get_parity(device.parity),
                    stopbits=device.stop_bits,
                    timeout=device.timeout,
                    xonxoff=(device.flow_control.lower() == 'xon/xoff'),
                    rtscts=(device.flow_control.lower() == 'rts/cts'),
                    dsrdtr=(device.flow_control.lower() == 'dsr/dtr')
                )
                
                # 연결 테스트
                if connection.is_open:
                    self.connections[device.id] = connection
                    logger.info(f"Successfully connected to device {device.name} on {device.port}")
                    return True
                else:
                    logger.error(f"Failed to open connection to device {device.name} on {device.port}")
                    return False
                    
        except serial.SerialException as e:
            logger.error(f"Serial connection error for device {device.name}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error connecting to device {device.name}: {e}")
            return False
    
    def disconnect_device(self, device_id: int) -> bool:
        """장비 연결을 해제합니다."""
        try:
            with self.lock:
                if device_id in self.connections:
                    connection = self.connections[device_id]
                    if connection.is_open:
                        connection.close()
                    del self.connections[device_id]
                    logger.info(f"Disconnected device {device_id}")
                    return True
                return False
        except Exception as e:
            logger.error(f"Error disconnecting device {device_id}: {e}")
            return False
    
    def is_connected(self, device_id: int) -> bool:
        """장비 연결 상태를 확인합니다."""
        with self.lock:
            if device_id in self.connections:
                connection = self.connections[device_id]
                return connection.is_open
            return False
    
    def send_command(self, device_id: int, command: str, delay: float = None) -> Optional[str]:
        """SCPI 명령을 전송하고 응답을 받습니다."""
        try:
            with self.lock:
                if device_id not in self.connections:
                    logger.error(f"Device {device_id} not connected")
                    return None
                
                connection = self.connections[device_id]
                if not connection.is_open:
                    logger.error(f"Device {device_id} connection is not open")
                    return None
                
                # 명령 전송
                command_bytes = (command + '\n').encode('utf-8')
                connection.write(command_bytes)
                connection.flush()
                
                # 응답 대기 시간 (장비별 설정 또는 기본값)
                if delay:
                    time.sleep(delay)
                else:
                    time.sleep(0.1)  # 기본 100ms 대기
                
                # 응답 읽기
                if connection.in_waiting > 0:
                    response = connection.read(connection.in_waiting).decode('utf-8').strip()
                    logger.debug(f"Device {device_id} - Command: '{command}' Response: '{response}'")
                    return response
                else:
                    logger.warning(f"Device {device_id} - No response for command: '{command}'")
                    return None
                    
        except serial.SerialException as e:
            logger.error(f"Serial communication error for device {device_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error sending command to device {device_id}: {e}")
            return None
    
    async def send_command_async(self, device_id: int, command: str, delay: float = None) -> Optional[str]:
        """비동기로 SCPI 명령을 전송합니다."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor, 
            self.send_command, 
            device_id, 
            command, 
            delay
        )
    
    def query_device_info(self, device_id: int, idn_command: str = "*IDN?") -> Optional[Dict[str, str]]:
        """장비 정보를 조회합니다."""
        response = self.send_command(device_id, idn_command)
        if response:
            # 일반적인 IDN 응답 형식: Manufacturer,Model,SerialNumber,FirmwareVersion
            parts = response.split(',')
            if len(parts) >= 4:
                return {
                    "manufacturer": parts[0].strip(),
                    "model": parts[1].strip(),
                    "serial_number": parts[2].strip(),
                    "firmware_version": parts[3].strip()
                }
            else:
                return {"raw_response": response}
        return None
    
    async def query_device_info_async(self, device_id: int, idn_command: str = "*IDN?") -> Optional[Dict[str, str]]:
        """비동기로 장비 정보를 조회합니다."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor,
            self.query_device_info,
            device_id,
            idn_command
        )
    
    def read_measurement(self, device_id: int, measure_command: str = "MEAS:VOLT:DC?") -> Optional[float]:
        """측정값을 읽습니다."""
        response = self.send_command(device_id, measure_command)
        if response:
            try:
                # 숫자 값만 추출
                value = float(response)
                return value
            except ValueError:
                logger.error(f"Invalid measurement response from device {device_id}: {response}")
                return None
        return None
    
    async def read_measurement_async(self, device_id: int, measure_command: str = "MEAS:VOLT:DC?") -> Optional[float]:
        """비동기로 측정값을 읽습니다."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor,
            self.read_measurement,
            device_id,
            measure_command
        )
    
    def configure_measurement(self, device_id: int, config_commands: List[str]) -> bool:
        """측정 설정을 구성합니다."""
        try:
            for command in config_commands:
                response = self.send_command(device_id, command)
                # 설정 명령은 보통 응답이 없거나 "OK" 등의 확인 응답
                time.sleep(0.1)  # 명령 간 간격
            
            logger.info(f"Device {device_id} configured with {len(config_commands)} commands")
            return True
        except Exception as e:
            logger.error(f"Error configuring device {device_id}: {e}")
            return False
    
    def _get_parity(self, parity_str: str) -> str:
        """패리티 문자열을 pySerial 형식으로 변환합니다."""
        parity_map = {
            'none': serial.PARITY_NONE,
            'even': serial.PARITY_EVEN,
            'odd': serial.PARITY_ODD,
            'mark': serial.PARITY_MARK,
            'space': serial.PARITY_SPACE
        }
        return parity_map.get(parity_str.lower(), serial.PARITY_NONE)
    
    def get_available_ports(self) -> List[str]:
        """사용 가능한 시리얼 포트 목록을 반환합니다."""
        try:
            from serial.tools import list_ports
            ports = list_ports.comports()
            return [port.device for port in ports]
        except Exception as e:
            logger.error(f"Error listing serial ports: {e}")
            return []
    
    def test_connection(self, device: Device) -> Dict[str, Any]:
        """연결 테스트를 수행합니다."""
        result = {
            "success": False,
            "message": "",
            "device_info": None,
            "response_time": None
        }
        
        start_time = time.time()
        
        try:
            # 연결 시도
            if not self.connect_device(device):
                result["message"] = "Failed to establish serial connection"
                return result
            
            # IDN 명령으로 장비 응답 확인
            device_info = self.query_device_info(device.id, device.idn_command)
            
            end_time = time.time()
            result["response_time"] = round((end_time - start_time) * 1000, 2)  # ms
            
            if device_info:
                result["success"] = True
                result["message"] = "Connection successful"
                result["device_info"] = device_info
            else:
                result["message"] = "Connection established but no response to IDN command"
            
        except Exception as e:
            result["message"] = f"Connection test failed: {str(e)}"
        
        return result
    
    def cleanup(self):
        """모든 연결을 정리합니다."""
        with self.lock:
            for device_id, connection in list(self.connections.items()):
                try:
                    if connection.is_open:
                        connection.close()
                except:
                    pass
            self.connections.clear()
        
        self.executor.shutdown(wait=True)
        logger.info("Serial communication service cleaned up")

# 전역 시리얼 통신 서비스 인스턴스
serial_service = SerialCommunicationService()