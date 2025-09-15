# -*- coding: utf-8 -*-
"""
WT310 (WT300 series) RS-232 함수형 API
- 이미 열린 serial.Serial 객체(또는 동일 인터페이스의 커스텀 트랜스포트)를 인자로 사용
- 활성 전력(P, W) 읽기용 편의 함수 제공
- ASCII 기본, FLOAT 바이너리 옵션 지원
"""

import time
from typing import Callable, Iterable, Optional, Tuple, Dict, Any
import logging

logger = logging.getLogger(__name__)

# -------------------------
# 저수준 I/O 유틸
# -------------------------
def _write_scpi(ser, cmd: str, tx_terminator: str = "\n", on_message_log: Optional[Callable[[str, str, str], None]] = None) -> None:
    """SCPI 한 줄 쓰기 (기본 LF 종단)."""
    if not cmd.endswith(("\n", "\r")):
        cmd = cmd + tx_terminator
    ser.write(cmd.encode("ascii"))
    
    # 메시지 로그 기록
    if on_message_log:
        on_message_log("SCPI_COMMAND", cmd.strip(), "OUT")

def _read_line(ser, rx_newline: bytes = b"\n", on_message_log: Optional[Callable[[str, str, str], None]] = None) -> str:
    """한 줄 읽기 (pyserial의 readline 사용 권장; 타임아웃 시 b'' 반환)."""
    line = ser.readline()
    response = line.decode("ascii", errors="ignore").strip()
    
    # 메시지 로그 기록
    if on_message_log and response:
        on_message_log("SCPI_RESPONSE", response, "IN")
    
    return response

def _query_scpi(ser, cmd: str, tx_terminator: str = "\n", rx_newline: bytes = b"\n", on_message_log: Optional[Callable[[str, str, str], None]] = None) -> str:
    _write_scpi(ser, cmd, tx_terminator, on_message_log)
    return _read_line(ser, rx_newline, on_message_log)

# -------------------------
# 초기 설정 (활성전력 전용)
# -------------------------
def wt310_init_active_power(
    ser,
    element: str = "1",          # "1" | "2" | "3" | "SIGMA"
    ascii_format: bool = True,   # True=ASCII, False=FLOAT
    tx_terminator: str = "\n",
    rx_newline: bytes = b"\n",
    on_message_log: Optional[Callable[[str, str, str], None]] = None,
) -> None:
    """
    WT310을 'P,<element>' 하나만 출력하도록 구성.
    - :NUMERIC:FORMAT ASCII|FLOAT
    - :NUMERIC:NORMAL:CLEAR ALL
    - :NUMERIC:NORMAL:ITEM1 P,<element>
    - (선택) :NUMERIC:NORMAL:NUMBER 1
    """
    try:
        # 원격 제어 진입 (이미 REMOTE면 무해)
        _write_scpi(ser, ":COMMUNICATE:REMOTE ON", tx_terminator, on_message_log)
        time.sleep(0.02)

        # 데이터 포맷
        _write_scpi(ser, f":NUMERIC:FORMAT {'ASCII' if ascii_format else 'FLOAT'}", tx_terminator, on_message_log)
        time.sleep(0.01)

        # 항목 초기화 및 P만 등록
        _write_scpi(ser, ":NUMERIC:NORMAL:CLEAR ALL", tx_terminator, on_message_log)
        _write_scpi(ser, f":NUMERIC:NORMAL:ITEM1 P,{element}", tx_terminator, on_message_log)
        _write_scpi(ser, ":NUMERIC:NORMAL:NUMBER 1", tx_terminator, on_message_log)
        
        logger.info(f"WT310 초기화 완료 - Element: {element}, Format: {'ASCII' if ascii_format else 'FLOAT'}")
    except Exception as e:
        logger.error(f"WT310 초기화 실패: {e}")
        raise

def wt310_read_active_power_once(
    ser,
    ascii_format: bool = True,
    tx_terminator: str = "\n",
    rx_newline: bytes = b"\n",
    on_message_log: Optional[Callable[[str, str, str], None]] = None,
) -> Optional[float]:
    """
    현재 설정된 ITEM 목록 값을 질의 → 첫 값(float) 반환.
    ASCII 모드: 과학표기 문자열을 float 변환 (NAN/INF → None 처리 권장).
    FLOAT 모드: '#<n><len><payload>' 형식(4바이트 IEEE754) → 간단 파서 포함.
    """
    try:
        # 시뮬레이션 모드 체크
        if hasattr(ser, 'port') and ser.port == 'SIMULATION':
            import random
            # 시뮬레이션 전력값 생성 (100-200W 범위)
            simulated_power = random.uniform(100.0, 200.0)
            logger.info(f"🎭 [WT310_SIMULATION] 시뮬레이션 전력값: {simulated_power:.3f}W")
            return simulated_power
        
        resp = _query_scpi(ser, ":NUMERIC:NORMAL:VALUE?", tx_terminator, rx_newline, on_message_log)
        if not resp:
            return None

        if ascii_format:
            # 콤마 분리 → 첫 값
            first = resp.split(",")[0].strip()
            try:
                # NAN/INF는 float 변환 시 값이지만, 용도에 따라 None 처리 가능
                val = float(first)
                # WT 규격상 데이터 없음/오버/오버플로우 등은 ASCII로 NAN/INF 가능. 필요 시 필터링:
                if first.upper() in ("NAN", "+NAN", "-NAN", "INF", "+INF", "-INF"):
                    return None
                return val
            except ValueError:
                return None
        else:
            # FLOAT 바이너리 응답 파싱 (간단 구현)
            # 응답 예: "#4<LLLL><payload>" (공급자 표기에 따라 #A/#4 등 n=자릿수)
            # pyserial은 바이너리를 그대로 읽어오도록 해야 하지만,
            # 여기서는 readline() 기반이므로 컨트롤러/장치 종단설정에 따라 조정 필요.
            # 안전하게는 ser.read()로 헤더와 길이를 파싱하세요.
            data = resp  # 실제 현장에선 바이트스트림으로 받아야 정확
            try:
                if not data or data[0] != "#":
                    return None
                n = int(data[1])
                length = int(data[2:2 + n])
                # 이후 payload가 4바이트(단정도) * 항목수
                # 첫 항목의 4바이트만 해석
                # 주의: 여기서는 문자열 경로로 왔으니 실제 현장에서는 raw bytes 필요
                return None  # 현장에선 바이트 모드 구현 권장
            except Exception:
                return None
    except Exception as e:
        logger.error(f"WT310 전력 읽기 실패: {e}")
        return None

# -------------------------
# 일정 시간 동안 반복 수집 (폴링)
# -------------------------
def wt310_collect_for(
    ser,
    duration_sec: float,
    interval_sec: float = 0.25,
    measurement_method: str = "polling",
    ascii_format: bool = True,
    tx_terminator: str = "\n",
    rx_newline: bytes = b"\n",
    on_value: Optional[Callable[[float, float], None]] = None,
    on_message_log: Optional[Callable[[str, str, str], None]] = None,
) -> Tuple[list, list]:
    """
    duration_sec 동안 interval_sec 간격으로 P[W]를 수집.
    - measurement_method: "polling" (폴링) 또는 "synchronized" (동기화)
    - 반환: (timestamps, values)
    - on_value 콜백: (elapsed_sec, value) 인자로 호출
    """
    t0 = time.time()
    ts, vs = [], []
    next_t = t0
    
    logger.info(f"WT310 데이터 수집 시작 - Duration: {duration_sec}s, Method: {measurement_method}, Interval: {interval_sec}s")
    
    if measurement_method == "synchronized":
        # 동기화 방식: 갱신 신호를 기다려 최신 데이터 수집
        while True:
            now = time.time()
            if now - t0 >= duration_sec:
                break
            v = wt310_read_active_power_once(ser, ascii_format, tx_terminator, rx_newline, on_message_log)
            elapsed = time.time() - t0
            ts.append(elapsed)
            
            # None 값을 0으로 대체하여 계산 에러 방지
            safe_value = v if v is not None else 0.0
            vs.append(safe_value)
            
            # 디버그 로그 추가
            if v is None:
                logger.warning(f"⚠️ [WT310] None 값 감지 (동기화) - elapsed: {elapsed:.3f}s, safe_value: {safe_value}")
            
            if (v is not None) and on_value:
                on_value(elapsed, v)
            # 동기화 방식에서는 간격 대신 짧은 대기
            time.sleep(0.01)
    else:
        # 폴링 방식: 일정 간격으로 데이터 수집
        while True:
            now = time.time()
            if now - t0 >= duration_sec:
                break
            if now < next_t:
                time.sleep(max(0.0, next_t - now))
            v = wt310_read_active_power_once(ser, ascii_format, tx_terminator, rx_newline, on_message_log)
            elapsed = time.time() - t0
            ts.append(elapsed)
            
            # None 값을 0으로 대체하여 계산 에러 방지
            safe_value = v if v is not None else 0.0
            vs.append(safe_value)
            
            # 디버그 로그 추가
            if v is None:
                logger.warning(f"⚠️ [WT310] None 값 감지 - elapsed: {elapsed:.3f}s, safe_value: {safe_value}")
            
            if (v is not None) and on_value:
                on_value(elapsed, v)
            next_t += interval_sec
    
    logger.info(f"WT310 데이터 수집 완료 - 수집된 데이터: {len(vs)}개")
    return ts, vs

# -------------------------
# "갱신 후 최신값만" 읽는 블로킹 루프 (COMM:WAIT 기반)
# -------------------------
def wt310_collect_latest_with_wait(
    ser,
    duration_sec: float,
    ascii_format: bool = True,
    tx_terminator: str = "\n",
    rx_newline: bytes = b"\n",
    on_value: Optional[Callable[[float, float], None]] = None,
    on_message_log: Optional[Callable[[str, str, str], None]] = None,
) -> Tuple[list, list]:
    """
    확장 이벤트(bit0=데이터 갱신완료)를 이용해 COMM:WAIT로 동기화 후 VALUE? 실행.
    - 권장 시퀀스(매뉴얼 예제):
      :STATUS:FILTER1 FALL; :STATUS:EESR?  (클리어)
      루프:
        COMMUNICATE:WAIT 1
        :NUMERIC:NORMAL:VALUE?
        :STATUS:EESR?
    """
    try:
        # 이벤트 필터/클리어
        _write_scpi(ser, ":STATUS:FILTER1 FALL", tx_terminator, on_message_log)
        _query_scpi(ser, ":STATUS:EESR?", tx_terminator, rx_newline, on_message_log)  # 읽으면서 클리어

        t0 = time.time()
        ts, vs = [], []
        
        logger.info(f"WT310 동기화 데이터 수집 시작 - Duration: {duration_sec}s")
        
        while (time.time() - t0) < duration_sec:
            # 갱신 이벤트 대기 (bit0=1)
            _write_scpi(ser, ":COMMUNICATE:WAIT 1", tx_terminator, on_message_log)
            # 이벤트가 잡힌 시점에 최신 데이터 질의
            resp = _query_scpi(ser, ":NUMERIC:NORMAL:VALUE?", tx_terminator, rx_newline, on_message_log)
            # 이벤트 레지스터 비움
            _query_scpi(ser, ":STATUS:EESR?", tx_terminator, rx_newline, on_message_log)

            # 파싱
            v = None
            if resp:
                if ascii_format:
                    first = resp.split(",")[0].strip()
                    try:
                        if first.upper() in ("NAN", "+NAN", "-NAN", "INF", "+INF", "-INF"):
                            v = None
                        else:
                            v = float(first)
                    except ValueError:
                        v = None
                else:
                    # FLOAT 모드 구현은 바이트스트림 기반으로 확장 필요
                    v = None

            elapsed = time.time() - t0
            ts.append(elapsed)
            vs.append(v)
            if (v is not None) and on_value:
                on_value(elapsed, v)

        logger.info(f"WT310 동기화 데이터 수집 완료 - 수집된 데이터: {len(vs)}개")
        return ts, vs
    except Exception as e:
        logger.error(f"WT310 동기화 데이터 수집 실패: {e}")
        return [], []

# -------------------------
# 순차 검사 함수 (P1 → P2 → P3)
# -------------------------
def wt310_sequential_inspection(
    ser,
    phases: list[str] = ["P1", "P2", "P3"],
    measurement_duration: float = 10.0,
    wait_duration: float = 2.0,
    interval_sec: float = 0.25,
    measurement_method: str = "polling",
    ascii_format: bool = True,
    on_phase_start: Optional[Callable[[str], None]] = None,
    on_phase_data: Optional[Callable[[str, float, float], None]] = None,
    on_phase_complete: Optional[Callable[[str, list, list], None]] = None,
    on_message_log: Optional[Callable[[str, str, str], None]] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    바코드 스캔 트리거로 P1 → P2 → P3 순차 검사 실행
    
    Args:
        ser: 연결된 시리얼 포트 객체
        phases: 검사할 위상 목록 (기본: ["P1", "P2", "P3"])
        measurement_duration: 각 위상별 측정 시간 (초)
        wait_duration: 위상 간 대기 시간 (초)
        interval_sec: 데이터 수집 간격 (초)
        ascii_format: 데이터 포맷 (True=ASCII, False=FLOAT)
        on_phase_start: 위상 시작 콜백 (phase)
        on_phase_data: 위상 데이터 콜백 (phase, elapsed, value)
        on_phase_complete: 위상 완료 콜백 (phase, timestamps, values)
    
    Returns:
        Dict[str, Dict[str, Any]]: 각 위상별 측정 결과
    """
    results = {}
    
    logger.info(f"WT310 순차 검사 시작 - 위상: {phases}, 측정시간: {measurement_duration}s")
    
    for i, phase in enumerate(phases):
        try:
            # 위상 시작 알림
            if on_phase_start:
                on_phase_start(phase)
            
            logger.info(f"위상 {phase} 측정 시작")
            
            # 해당 위상으로 설정
            element = str(i + 1)  # P1=1, P2=2, P3=3
            wt310_init_active_power(ser, element=element, ascii_format=ascii_format, on_message_log=on_message_log)
            
            # 데이터 수집
            def data_callback(elapsed: float, value: float):
                if on_phase_data:
                    on_phase_data(phase, elapsed, value)
            
            timestamps, values = wt310_collect_for(
                ser, 
                duration_sec=measurement_duration,
                interval_sec=interval_sec,
                measurement_method=measurement_method,
                ascii_format=ascii_format,
                on_value=data_callback,
                on_message_log=on_message_log
            )
            
            # 위상 완료 알림
            if on_phase_complete:
                on_phase_complete(phase, timestamps, values)
            
            # 결과 저장
            results[phase] = {
                "timestamps": timestamps,
                "values": values,
                "valid_values": [v for v in values if v is not None],
                "count": len([v for v in values if v is not None]),
                "avg": sum([v for v in values if v is not None]) / len([v for v in values if v is not None]) if any(v is not None for v in values) else 0,
                "min": min([v for v in values if v is not None]) if any(v is not None for v in values) else 0,
                "max": max([v for v in values if v is not None]) if any(v is not None for v in values) else 0,
            }
            
            logger.info(f"위상 {phase} 측정 완료 - 유효 데이터: {results[phase]['count']}개")
            
            # 마지막 위상이 아니면 대기
            if i < len(phases) - 1:
                logger.info(f"위상 간 대기: {wait_duration}s")
                time.sleep(wait_duration)
                
        except Exception as e:
            logger.error(f"위상 {phase} 측정 실패: {e}")
            results[phase] = {
                "timestamps": [],
                "values": [],
                "valid_values": [],
                "count": 0,
                "avg": 0,
                "min": 0,
                "max": 0,
                "error": str(e)
            }
    
    logger.info("WT310 순차 검사 완료")
    return results
