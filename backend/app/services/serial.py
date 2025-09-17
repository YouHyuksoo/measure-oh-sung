"""
시리얼 통신 관련 서비스
- SerialCommunicationService: RS-232 시리얼 통신 관리
"""
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
        self.simulation_mode = False  # 실제 COM 포트 사용
        
    def connect_device(self, device: Device) -> bool:
        """장비에 연결합니다."""
        print(f"🚀 [SERIAL_SERVICE] connect_device 함수 시작")
        print(f"📋 [SERIAL_SERVICE] 디바이스 정보:")
        print(f"   - ID: {device.id}")
        print(f"   - 이름: {device.name}")
        print(f"   - 포트: {device.port}")
        print(f"   - 보드레이트: {device.baud_rate}")
        print(f"   - 데이터 비트: {device.data_bits}")
        print(f"   - 스톱 비트: {device.stop_bits}")
        print(f"   - 패리티: {device.parity}")
        print(f"   - 타임아웃: {device.timeout}")
        
        try:
            with self.lock:
                # 이미 연결된 경우
                if device.id in self.connections:
                    print(f"⚠️ [SERIAL_SERVICE] 이미 연결된 장비입니다: {device.id}")
                    return True
                
                # 시뮬레이션 모드 체크
                if self.simulation_mode:
                    print(f"🎭 [SERIAL_SERVICE] 시뮬레이션 모드로 연결")
                    self.connections[device.id] = None  # 시뮬레이션용 None
                    return True
                
                # 실제 시리얼 연결
                print(f"🔌 [SERIAL_SERVICE] 실제 시리얼 포트 연결 시도: {device.port}")
                
                ser = serial.Serial(
                    port=device.port,
                    baudrate=device.baud_rate,
                    bytesize=device.data_bits,
                    parity=device.parity,
                    stopbits=device.stop_bits,
                    timeout=device.timeout
                )
                
                # 연결 확인
                if ser.is_open:
                    print(f"✅ [SERIAL_SERVICE] 시리얼 포트 연결 성공: {device.port}")
                    self.connections[device.id] = ser
                    return True
                else:
                    print(f"❌ [SERIAL_SERVICE] 시리얼 포트 연결 실패: {device.port}")
                    return False
                    
        except Exception as e:
            print(f"❌ [SERIAL_SERVICE] 연결 중 오류 발생: {e}")
            logger.error(f"❌ [SERIAL_SERVICE] 연결 중 오류 발생: {e}")
            return False
    
    def disconnect_device(self, device_id: int) -> bool:
        """장비 연결을 해제합니다."""
        print(f"🔌 [SERIAL_SERVICE] disconnect_device 함수 시작: {device_id}")
        
        try:
            with self.lock:
                if device_id in self.connections:
                    connection = self.connections[device_id]
                    if connection and connection.is_open:
                        connection.close()
                        print(f"✅ [SERIAL_SERVICE] 시리얼 포트 연결 해제: {device_id}")
                    del self.connections[device_id]
                    return True
                else:
                    print(f"⚠️ [SERIAL_SERVICE] 연결되지 않은 장비입니다: {device_id}")
                    return False
                    
        except Exception as e:
            print(f"❌ [SERIAL_SERVICE] 연결 해제 중 오류 발생: {e}")
            logger.error(f"❌ [SERIAL_SERVICE] 연결 해제 중 오류 발생: {e}")
            return False
    
    def is_connected(self, device_id: int) -> bool:
        """장비 연결 상태를 확인합니다."""
        with self.lock:
            if device_id in self.connections:
                connection = self.connections[device_id]
                if self.simulation_mode:
                    return True  # 시뮬레이션 모드에서는 항상 연결됨
                return connection and connection.is_open
            return False
    
    def get_connection_status(self, device_id: int) -> ConnectionStatus:
        """장비 연결 상태를 반환합니다."""
        if self.is_connected(device_id):
            return ConnectionStatus.CONNECTED
        else:
            return ConnectionStatus.DISCONNECTED
    
    async def send_command(self, device_id: int, command: str, delay: float = 0.1) -> bool:
        """장비에 명령을 전송합니다."""
        print(f"📤 [SERIAL_SERVICE] send_command 함수 시작: {device_id}, {command}")
        
        try:
            with self.lock:
                if device_id not in self.connections:
                    print(f"❌ [SERIAL_SERVICE] 연결되지 않은 장비입니다: {device_id}")
                    return False
                
                connection = self.connections[device_id]
                
                # 시뮬레이션 모드
                if self.simulation_mode:
                    print(f"🎭 [SERIAL_SERVICE] 시뮬레이션 모드로 명령 전송: {command}")
                    await asyncio.sleep(delay)  # 지연 시뮬레이션
                    return True
                
                # 실제 명령 전송
                if connection and connection.is_open:
                    command_bytes = (command + '\r\n').encode('utf-8')
                    connection.write(command_bytes)
                    print(f"✅ [SERIAL_SERVICE] 명령 전송 완료: {command}")
                    
                    if delay > 0:
                        await asyncio.sleep(delay)
                    
                    return True
                else:
                    print(f"❌ [SERIAL_SERVICE] 시리얼 포트가 열려있지 않습니다: {device_id}")
                    return False
                    
        except Exception as e:
            print(f"❌ [SERIAL_SERVICE] 명령 전송 중 오류 발생: {e}")
            logger.error(f"❌ [SERIAL_SERVICE] 명령 전송 중 오류 발생: {e}")
            return False
    
    async def read_data(self, device_id: int, timeout: float = 1.0) -> Optional[str]:
        """장비에서 데이터를 읽습니다."""
        print(f"📥 [SERIAL_SERVICE] read_data 함수 시작: {device_id}")
        
        try:
            with self.lock:
                if device_id not in self.connections:
                    print(f"❌ [SERIAL_SERVICE] 연결되지 않은 장비입니다: {device_id}")
                    return None
                
                connection = self.connections[device_id]
                
                # 시뮬레이션 모드
                if self.simulation_mode:
                    print(f"🎭 [SERIAL_SERVICE] 시뮬레이션 모드로 데이터 읽기")
                    await asyncio.sleep(0.1)  # 지연 시뮬레이션
                    return "1.234,2.345,3.456"  # 시뮬레이션 데이터
                
                # 실제 데이터 읽기
                if connection and connection.is_open:
                    # 비동기로 데이터 읽기
                    loop = asyncio.get_event_loop()
                    data = await loop.run_in_executor(
                        self.executor, 
                        self._read_serial_data, 
                        connection, 
                        timeout
                    )
                    
                    if data:
                        print(f"✅ [SERIAL_SERVICE] 데이터 읽기 완료: {data}")
                        return data
                    else:
                        print(f"⚠️ [SERIAL_SERVICE] 읽은 데이터가 없습니다")
                        return None
                else:
                    print(f"❌ [SERIAL_SERVICE] 시리얼 포트가 열려있지 않습니다: {device_id}")
                    return None
                    
        except Exception as e:
            print(f"❌ [SERIAL_SERVICE] 데이터 읽기 중 오류 발생: {e}")
            logger.error(f"❌ [SERIAL_SERVICE] 데이터 읽기 중 오류 발생: {e}")
            return None
    
    def _read_serial_data(self, connection: serial.Serial, timeout: float) -> Optional[str]:
        """시리얼 데이터를 동기적으로 읽습니다."""
        try:
            # 타임아웃 설정
            original_timeout = connection.timeout
            connection.timeout = timeout
            
            # 데이터 읽기
            data = connection.readline()
            
            # 원래 타임아웃 복원
            connection.timeout = original_timeout
            
            if data:
                return data.decode('utf-8').strip()
            return None
            
        except Exception as e:
            logger.error(f"❌ [SERIAL_SERVICE] 시리얼 데이터 읽기 실패: {e}")
            return None
    
    async def read_power_meter_data(self) -> Optional[str]:
        """전력계에서 데이터를 읽습니다."""
        # 전력계 장비 ID (예: 1)
        power_meter_id = 1
        
        if not self.is_connected(power_meter_id):
            print(f"⚠️ [SERIAL_SERVICE] 전력계가 연결되지 않았습니다: {power_meter_id}")
            return None
        
        # 전력계 명령 전송 (예: 측정 명령)
        command_sent = await self.send_command(power_meter_id, "MEAS:VOLT:CURR:POW?")
        if not command_sent:
            print(f"❌ [SERIAL_SERVICE] 전력계 명령 전송 실패")
            return None
        
        # 데이터 읽기
        data = await self.read_data(power_meter_id, timeout=2.0)
        return data
    
    def get_available_ports(self) -> List[str]:
        """사용 가능한 시리얼 포트 목록을 반환합니다."""
        try:
            import serial.tools.list_ports
            ports = serial.tools.list_ports.comports()
            return [port.device for port in ports]
        except Exception as e:
            logger.error(f"❌ [SERIAL_SERVICE] 포트 목록 조회 실패: {e}")
            return []
    
    def set_simulation_mode(self, enabled: bool):
        """시뮬레이션 모드를 설정합니다."""
        self.simulation_mode = enabled
        print(f"🎭 [SERIAL_SERVICE] 시뮬레이션 모드: {'활성화' if enabled else '비활성화'}")
    
    def get_connection_info(self) -> Dict[int, Dict[str, Any]]:
        """연결된 장비들의 정보를 반환합니다."""
        info = {}
        with self.lock:
            for device_id, connection in self.connections.items():
                info[device_id] = {
                    "connected": connection is not None and (self.simulation_mode or connection.is_open),
                    "port": connection.port if connection else None,
                    "simulation": self.simulation_mode
                }
        return info

# 전역 인스턴스
serial_service = SerialCommunicationService()
