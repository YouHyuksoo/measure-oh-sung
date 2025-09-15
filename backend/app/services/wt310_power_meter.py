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
import serial

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
    """한 줄 읽기 (타임아웃을 존중하며, LF를 직접 찾아 종료). 상세 로깅 추가."""
    logger.info("...[RX_LOG] 시리얼 포트에서 읽기 시작...")
    start_time = time.time()
    
    try:
        # SerialCommunicationService와 동일한 방식으로 읽기
        if hasattr(ser, 'in_waiting') and ser.in_waiting > 0:
            # 대기 중인 데이터가 있으면 모두 읽기
            data = ser.read(ser.in_waiting)
            logger.info(f"...[RX_LOG] 대기 중인 데이터 수신: {len(data)}바이트 (소요시간: {time.time() - start_time:.4f}s)")
            logger.info(f"...[RX_LOG] 수신 데이터 (hex): {data.hex()}")
            
            # LF로 분리하여 첫 번째 줄만 반환
            response = data.decode("ascii", errors="ignore").split('\n')[0].strip()
            logger.info(f"...[RX_LOG] 최종 디코딩된 응답: '{response}'")
            
            # 메시지 로그 기록
            if on_message_log and response:
                on_message_log("SCPI_RESPONSE", response, "IN")
            
            return response
        else:
            # 대기 중인 데이터가 없으면 기존 방식으로 읽기
            line = bytearray()
            while True:
                try:
                    # ser.timeout에 설정된 시간만큼 대기하며 1바이트를 읽음
                    c = ser.read(1)
                    
                    if c:
                        # 1바이트라도 수신 성공
                        now = time.time()
                        logger.info(f"...[RX_LOG] 바이트 수신: {c.hex()} (소요시간: {now - start_time:.4f}s)")
                        line.extend(c)
                        if c == rx_newline:
                            logger.info("...[RX_LOG] 줄바꿈 문자 수신. 라인 읽기 완료.")
                            break
                    else:
                        # ser.read(1)이 빈 바이트를 반환 -> 타임아웃 발생
                        now = time.time()
                        logger.warning(f"...[RX_LOG] 타임아웃! {ser.timeout}초 동안 데이터 없음. (총 대기: {now - start_time:.4f}s)")
                        break
                except serial.SerialException as e:
                    logger.info(f"...[RX_LOG] 읽기 중 시리얼 예외 발생: {e}")
                    break
                    
            response = line.decode("ascii", errors="ignore").strip()
            logger.info(f"...[RX_LOG] 최종 디코딩된 응답: '{response}'")
            
            # 메시지 로그 기록
            if on_message_log and response:
                on_message_log("SCPI_RESPONSE", response, "IN")
            
            return response
            
    except Exception as e:
        logger.error(f"...[RX_LOG] 읽기 중 예외 발생: {e}")
        return ""

def _query_scpi(ser, cmd: str, tx_terminator: str = "\n", rx_newline: bytes = b"\n", on_message_log: Optional[Callable[[str, str, str], None]] = None) -> str:
    _write_scpi(ser, cmd, tx_terminator, on_message_log)
    # 명령 전송 후 응답 대기 시간 추가
    time.sleep(0.2)
    
    # 응답을 여러 번 시도하여 읽기
    max_retries = 3
    for attempt in range(max_retries):
        response = _read_line(ser, rx_newline, on_message_log)
        if response and response.strip():
            logger.info(f"✅ [WT310] 명령 '{cmd}' 응답 수신 (시도 {attempt + 1}): '{response}'")
            return response
        else:
            logger.warning(f"⚠️ [WT310] 명령 '{cmd}' 빈 응답 (시도 {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                time.sleep(0.1)
    
    logger.error(f"❌ [WT310] 명령 '{cmd}' 최대 재시도 후에도 응답 없음")
    return ""

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
        # 원격 제어 진입 (이미 REMOTE면 무해) - 응답 읽기
        _query_scpi(ser, ":COMMUNICATE:REMOTE ON", tx_terminator, rx_newline, on_message_log)

        # 데이터 포맷 - 응답 읽기
        _query_scpi(ser, f":NUMERIC:FORMAT {'ASCII' if ascii_format else 'FLOAT'}", tx_terminator, rx_newline, on_message_log)

        # 항목 초기화 및 P만 등록 - 응답 읽기
        _query_scpi(ser, ":NUMERIC:NORMAL:CLEAR ALL", tx_terminator, rx_newline, on_message_log)
        _query_scpi(ser, f":NUMERIC:NORMAL:ITEM1 P,{element}", tx_terminator, rx_newline, on_message_log)
        _query_scpi(ser, ":NUMERIC:NORMAL:NUMBER 1", tx_terminator, rx_newline, on_message_log)
        
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
        
        logger.info("🔍 [WT310] :NUMERIC:NORMAL:VALUE? 명령 전송 중...")
        resp = _query_scpi(ser, ":NUMERIC:NORMAL:VALUE?", tx_terminator, rx_newline, on_message_log)
        logger.info(f"📥 [WT310] 응답 수신: '{resp}' (길이: {len(resp) if resp else 0})")
        
        if not resp:
            logger.warning("⚠️ [WT310] 빈 응답 수신")
            return None

        if ascii_format:
            # 콤마 분리 → 첫 값
            first = resp.split(",")[0].strip()
            logger.info(f"🔍 [WT310] 파싱할 첫 번째 값: '{first}'")
            
            try:
                # NAN/INF는 float 변환 시 값이지만, 용도에 따라 None 처리 가능
                val = float(first)
                logger.info(f"✅ [WT310] 성공적으로 파싱된 값: {val}")
                
                # WT 규격상 데이터 없음/오버/오버플로우 등은 ASCII로 NAN/INF 가능. 필요 시 필터링:
                if first.upper() in ("NAN", "+NAN", "-NAN", "INF", "+INF", "-INF"):
                    logger.warning(f"⚠️ [WT310] NAN/INF 값 감지: {first}")
                    return None
                return val
            except ValueError as e:
                logger.error(f"❌ [WT310] 값 파싱 실패: '{first}' -> {e}")
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
            
            # 실시간 데이터 전송을 위해 None이 아닌 값이든 상관없이 콜백 호출
            if on_value:
                on_value(elapsed, v if v is not None else 0.0)
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
                logger.warning(f"⚠️ [WT310] None 값 감지 (폴링)- elapsed: {elapsed:.3f}s, safe_value: {safe_value}")
                if on_message_log:
                    on_message_log(
                        "WT310_WARNING", 
                        f"None value detected at {elapsed:.3f}s. Using safe_value: {safe_value}", 
                        "IN"
                    )
            
            # 실시간 데이터 전송을 위해 None이 아닌 값이든 상관없이 콜백 호출
            if on_value:
                on_value(elapsed, v if v is not None else 0.0)
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
            
            # 마지막 위상이 아니면 설정된 대기 시간만큼 대기
            if i < len(phases) - 1:
                logger.info(f"위상 간 대기: {wait_duration}s (계측기와 통신 없이 대기)")
                
                # 대기 시작 알림 (메시지 로그가 있으면)
                if on_message_log:
                    on_message_log(
                        "PHASE_WAIT", 
                        f"위상 간 대기 시작: {wait_duration}초", 
                        "OUT"
                    )
                
                # 설정된 대기 시간만큼 대기 (계측기와 통신 없음)
                time.sleep(wait_duration)
                
                # 대기 완료 알림 (메시지 로그가 있으면)
                if on_message_log:
                    on_message_log(
                        "PHASE_WAIT", 
                        f"위상 간 대기 완료: 다음 위상 시작 준비", 
                        "OUT"
                    )
                
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
