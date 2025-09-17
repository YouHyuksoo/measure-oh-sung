"""
전력계 관련 서비스 - WT310 전력계 전용
- WT310 (WT300 series) RS-232 함수형 API
- 전력측정 전용 기능만 포함
- 안전검사와 분리된 순수 전력측정 서비스
"""
import time
import asyncio
import logging
from typing import Callable, Iterable, Optional, Tuple, Dict, Any, List
import serial

logger = logging.getLogger(__name__)

class PowerMeterService:
    """WT310 전력계 전용 서비스"""
    
    def __init__(self):
        self.connection = None
        self.is_connected = False
    
    def connect(self, port: str, baudrate: int = 9600) -> bool:
        """전력계에 연결"""
        try:
            self.connection = serial.Serial(port, baudrate, timeout=1)
            self.is_connected = True
            logger.info(f"✅ [POWER_METER] 연결 성공: {port}")
            return True
        except Exception as e:
            logger.error(f"❌ [POWER_METER] 연결 실패: {e}")
            return False
    
    def disconnect(self):
        """전력계 연결 해제"""
        if self.connection and self.connection.is_open:
            self.connection.close()
        self.is_connected = False
        logger.info("🔌 [POWER_METER] 연결 해제")
    
    def _write_scpi(self, cmd: str, tx_terminator: str = "\n") -> None:
        """SCPI 명령 전송"""
        if not self.is_connected or not self.connection:
            raise Exception("전력계가 연결되지 않았습니다.")
        
        if not cmd.endswith(("\n", "\r")):
            cmd = cmd + tx_terminator
        self.connection.write(cmd.encode("ascii"))
    
    def _read_line(self, rx_newline: bytes = b"\n") -> str:
        """SCPI 응답 읽기"""
        if not self.is_connected or not self.connection:
            raise Exception("전력계가 연결되지 않았습니다.")
        
        buf = b""
        while True:
            b = self.connection.read(1)
            if not b:
                break
            buf += b
            if b == rx_newline:
                break
        
        return buf.decode("ascii", errors="replace").strip()
    
    def _query_scpi(self, cmd: str) -> str:
        """SCPI 쿼리 (명령 + 응답)"""
        self._write_scpi(cmd)
        return self._read_line()
    
    # ==================== 기본 명령어 ====================
    def get_idn(self) -> str:
        """기기 식별 정보 조회"""
        return self._query_scpi("*IDN?")
    
    def reset(self):
        """기기 리셋"""
        self._write_scpi("*RST")
    
    def clear(self):
        """상태 클리어"""
        self._write_scpi("*CLS")
    
    def self_test(self) -> str:
        """자체 테스트"""
        return self._query_scpi("*TST?")
    
    # ==================== 측정 함수들 ====================
    def measure_voltage(self) -> float:
        """전압 측정 (V)"""
        resp = self._query_scpi("MEAS:VOLT?")
        try:
            return float(resp)
        except ValueError:
            logger.error(f"❌ [POWER_METER] 전압 측정 응답 파싱 실패: {resp}")
            return 0.0
    
    def measure_current(self) -> float:
        """전류 측정 (A)"""
        resp = self._query_scpi("MEAS:CURR?")
        try:
            return float(resp)
        except ValueError:
            logger.error(f"❌ [POWER_METER] 전류 측정 응답 파싱 실패: {resp}")
            return 0.0
    
    def measure_power(self) -> float:
        """전력 측정 (W)"""
        resp = self._query_scpi("MEAS:POW?")
        try:
            return float(resp)
        except ValueError:
            logger.error(f"❌ [POWER_METER] 전력 측정 응답 파싱 실패: {resp}")
            return 0.0
    
    def measure_all(self) -> Tuple[float, float, float]:
        """전압, 전류, 전력을 한 번에 측정"""
        v = self.measure_voltage()
        i = self.measure_current()
        p = self.measure_power()
        return v, i, p
    
    # ==================== 설정 함수들 ====================
    def set_auto_range(self):
        """자동 범위 설정"""
        self._write_scpi("VOLT:RANG:AUTO ON")
        self._write_scpi("CURR:RANG:AUTO ON")
        self._write_scpi("POW:RANG:AUTO ON")
    
    def set_measurement_mode(self, mode: str = "VOLT:CURR:POW"):
        """측정 모드 설정"""
        self._write_scpi(f"FUNC {mode}")
    
    def initialize(self) -> bool:
        """전력계 초기화"""
        try:
            self.reset()
            time.sleep(1)
            self.clear()
            time.sleep(0.5)
            self.set_auto_range()
            time.sleep(0.5)
            self.set_measurement_mode()
            time.sleep(0.5)
            logger.info("✅ [POWER_METER] 초기화 완료")
            return True
        except Exception as e:
            logger.error(f"❌ [POWER_METER] 초기화 실패: {e}")
            return False
    
    # ==================== 연속 측정 ====================
    async def start_continuous_measurement(
        self, 
        duration: float = 30.0, 
        interval: float = 0.5
    ) -> List[Dict[str, Any]]:
        """연속 측정 시작"""
        if not self.is_connected:
            raise Exception("전력계가 연결되지 않았습니다.")
        
        logger.info(f"🚀 [POWER_METER] 연속 측정 시작: {duration}초, {interval}초 간격")
        
        measurements = []
        start_time = time.time()
        
        while time.time() - start_time < duration:
            try:
                v, i, p = self.measure_all()
                measurement = {
                    "timestamp": time.time(),
                    "voltage": v,
                    "current": i,
                    "power": p
                }
                measurements.append(measurement)
                await asyncio.sleep(interval)
            except Exception as e:
                logger.error(f"❌ [POWER_METER] 측정 중 오류: {e}")
                break
        
        logger.info(f"✅ [POWER_METER] 연속 측정 완료: {len(measurements)}개 측정값")
        return measurements
    
    def get_measurement_statistics(self, measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """측정 통계 계산"""
        if not measurements:
            return {"error": "측정 데이터가 없습니다."}
        
        voltages = [m["voltage"] for m in measurements]
        currents = [m["current"] for m in measurements]
        powers = [m["power"] for m in measurements]
        
        return {
            "count": len(measurements),
            "voltage": {
                "min": min(voltages),
                "max": max(voltages),
                "avg": sum(voltages) / len(voltages)
            },
            "current": {
                "min": min(currents),
                "max": max(currents),
                "avg": sum(currents) / len(currents)
            },
            "power": {
                "min": min(powers),
                "max": max(powers),
                "avg": sum(powers) / len(powers)
            }
        }
    
    def test_connection(self) -> bool:
        """연결 테스트"""
        try:
            idn = self.get_idn()
            logger.info(f"✅ [POWER_METER] 연결 테스트 성공: {idn}")
            return True
        except Exception as e:
            logger.error(f"❌ [POWER_METER] 연결 테스트 실패: {e}")
            return False

# 전역 인스턴스
power_meter_service = PowerMeterService()