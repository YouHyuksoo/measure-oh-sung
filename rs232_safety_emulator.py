# rs232_safety_emulator.py
# RS-232 ASCII 프로토콜: *IDN?, *RST, SYST:ERR?, STAT?, INIT, ABORT
# 3대 안전 시험 명령어: MANU:ACW:TEST, MANU:IR:TEST, MANU:GB:TEST
# 라인 종료: LF("\n"), 인코딩: UTF-8
import sys, time, threading, random, re, math
try:
    import serial
except ImportError:
    print("pip install pyserial 를 먼저 설치하세요.")
    sys.exit(1)

LF = "\n"
OK = "OK"
BANNER = "SAFETY_TESTER,ST-3000,87654321,2.00"

ERR_SYNTAX = 'ERR,-100,"Syntax error"'
ERR_RANGE  = 'ERR,-200,"Parameter out of range"'
ERR_EXEC   = 'ERR,-300,"Execution error"'
ERR_BUSY   = 'ERR,-350,"Operation in progress"'
ERR_DEV    = 'ERR,-500,"Device error"'

STATE_READY = "READY"
STATE_RUN   = "RUN"
STATE_HOLD  = "HOLD"
STATE_ERROR = "ERROR"

# 3대 안전 시험 결과
TEST_PASS = "PASS"
TEST_FAIL = "FAIL"
TEST_ERROR = "ERROR"

def clip(x, lo, hi):
    return max(lo, min(hi, x))

class SafetyTestModel:
    """3대 안전 시험 결과를 생성하는 모델"""
    def __init__(self):
        # ACW (절연저항) 시험 기본값
        self.acw_voltage = 1000.0  # V
        self.acw_current_limit = 0.5  # mA
        self.acw_time = 1.0  # s
        
        # IR (절연저항) 시험 기본값
        self.ir_voltage = 500.0  # V
        self.ir_resistance_limit = 1.0  # MΩ
        
        # GB (접지연속성) 시험 기본값
        self.gb_current = 10.0  # A
        self.gb_resistance_limit = 0.1  # Ω
        
        # 내부 상태
        self.ts = time.time()
        self.last_acw_result = None
        self.last_ir_result = None
        self.last_gb_result = None
        self.test_in_progress = False
        self.current_test = None

    def set_acw_params(self, voltage=None, current_limit=None, time=None):
        if voltage is not None:
            if not (100 <= voltage <= 5000): return False
            self.acw_voltage = float(voltage)
        if current_limit is not None:
            if not (0.1 <= current_limit <= 10.0): return False
            self.acw_current_limit = float(current_limit)
        if time is not None:
            if not (0.1 <= time <= 60.0): return False
            self.acw_time = float(time)
        return True

    def set_ir_params(self, voltage=None, resistance_limit=None):
        if voltage is not None:
            if not (100 <= voltage <= 1000): return False
            self.ir_voltage = float(voltage)
        if resistance_limit is not None:
            if not (0.1 <= resistance_limit <= 100.0): return False
            self.ir_resistance_limit = float(resistance_limit)
        return True

    def set_gb_params(self, current=None, resistance_limit=None):
        if current is not None:
            if not (1.0 <= current <= 30.0): return False
            self.gb_current = float(current)
        if resistance_limit is not None:
            if not (0.01 <= resistance_limit <= 1.0): return False
            self.gb_resistance_limit = float(resistance_limit)
        return True

    def execute_acw_test(self):
        """ACW (절연저항) 시험 실행"""
        self.current_test = "ACW"
        self.test_in_progress = True
        
        # 시뮬레이션: 90% 확률로 PASS, 10% 확률로 FAIL
        is_pass = random.random() > 0.1
        
        if is_pass:
            # PASS: 전류가 제한값 이하
            measured_current = random.uniform(0.01, self.acw_current_limit * 0.8)
            result = {
                "test": "ACW",
                "voltage": self.acw_voltage,
                "current": measured_current,
                "current_limit": self.acw_current_limit,
                "result": TEST_PASS,
                "message": "ACW Test PASS"
            }
        else:
            # FAIL: 전류가 제한값 초과
            measured_current = random.uniform(self.acw_current_limit * 1.1, self.acw_current_limit * 2.0)
            result = {
                "test": "ACW",
                "voltage": self.acw_voltage,
                "current": measured_current,
                "current_limit": self.acw_current_limit,
                "result": TEST_FAIL,
                "message": "ACW Test FAIL - Current exceeded limit"
            }
        
        self.last_acw_result = result
        self.test_in_progress = False
        self.current_test = None
        return result

    def execute_ir_test(self):
        """IR (절연저항) 시험 실행"""
        self.current_test = "IR"
        self.test_in_progress = True
        
        # 시뮬레이션: 85% 확률로 PASS, 15% 확률로 FAIL
        is_pass = random.random() > 0.15
        
        if is_pass:
            # PASS: 저항이 제한값 이상
            measured_resistance = random.uniform(self.ir_resistance_limit * 1.2, self.ir_resistance_limit * 10.0)
            result = {
                "test": "IR",
                "voltage": self.ir_voltage,
                "resistance": measured_resistance,
                "resistance_limit": self.ir_resistance_limit,
                "result": TEST_PASS,
                "message": "IR Test PASS"
            }
        else:
            # FAIL: 저항이 제한값 미만
            measured_resistance = random.uniform(0.01, self.ir_resistance_limit * 0.8)
            result = {
                "test": "IR",
                "voltage": self.ir_voltage,
                "resistance": measured_resistance,
                "resistance_limit": self.ir_resistance_limit,
                "result": TEST_FAIL,
                "message": "IR Test FAIL - Resistance below limit"
            }
        
        self.last_ir_result = result
        self.test_in_progress = False
        self.current_test = None
        return result

    def execute_gb_test(self):
        """GB (접지연속성) 시험 실행"""
        self.current_test = "GB"
        self.test_in_progress = True
        
        # 시뮬레이션: 95% 확률로 PASS, 5% 확률로 FAIL
        is_pass = random.random() > 0.05
        
        if is_pass:
            # PASS: 저항이 제한값 이하
            measured_resistance = random.uniform(0.001, self.gb_resistance_limit * 0.8)
            result = {
                "test": "GB",
                "current": self.gb_current,
                "resistance": measured_resistance,
                "resistance_limit": self.gb_resistance_limit,
                "result": TEST_PASS,
                "message": "GB Test PASS"
            }
        else:
            # FAIL: 저항이 제한값 초과
            measured_resistance = random.uniform(self.gb_resistance_limit * 1.2, self.gb_resistance_limit * 5.0)
            result = {
                "test": "GB",
                "current": self.gb_current,
                "resistance": measured_resistance,
                "resistance_limit": self.gb_resistance_limit,
                "result": TEST_FAIL,
                "message": "GB Test FAIL - Resistance exceeded limit"
            }
        
        self.last_gb_result = result
        self.test_in_progress = False
        self.current_test = None
        return result

    def get_last_result(self, test_type):
        """마지막 시험 결과 반환"""
        if test_type == "ACW":
            return self.last_acw_result
        elif test_type == "IR":
            return self.last_ir_result
        elif test_type == "GB":
            return self.last_gb_result
        return None

class RS232SafetyEmu:
    def __init__(self, port, baud=9600):
        self.port_name = port
        self.baud = baud
        self.model = SafetyTestModel()
        self.state = STATE_READY
        self.running = True
        self.lock = threading.Lock()
        self.err_stack = []  # 간단한 에러 스택
        
        try:
            # 실제 시리얼 포트 시도
            self.ser = serial.Serial(
                port=port, baudrate=baud,
                bytesize=serial.EIGHTBITS, parity=serial.PARITY_NONE, stopbits=serial.STOPBITS_ONE,
                timeout=0.1, xonxoff=False, rtscts=False, dsrdtr=False
            )
            print(f"✅ SAFETY 애뮬레이터 시리얼 포트 연결 성공: {port}")
        except Exception as e:
            print(f"⚠️ SAFETY 애뮬레이터 시리얼 포트 연결 실패: {e}")
            print(f"📁 파일 기반 통신으로 전환: {port}_safety_input.txt <-> {port}_safety_output.txt")
            # 파일 초기화
            with open(f"{port}_safety_input.txt", 'w') as f:
                f.write("")
            with open(f"{port}_safety_output.txt", 'w') as f:
                f.write("")
            self.ser = None

    # ---- 직렬 헬퍼
    def _writeline(self, s):
        try:
            if self.ser and self.ser.is_open:
                self.ser.write((s + LF).encode("utf-8"))
                self.ser.flush()  # 버퍼를 즉시 전송
                print(f"[SAFETY] 응답 전송: '{s}'")
            else:
                # 파일 기반 통신
                with open(f"{self.port_name}_safety_output.txt", 'a') as f:
                    f.write(s + LF)
                print(f"[SAFETY] 파일 응답: '{s}'")
        except Exception as e:
            print(f"[SAFETY ERROR] 응답 전송 실패: {e}")
            pass

    def _push_err(self, code_msg):
        self.err_stack.append(code_msg)

    # ---- 명령 처리
    def handle_line(self, raw):
        s = raw.strip()
        if not s:
            return
        u = s.upper()
        
        # 디버그 로그 추가
        print(f"[SAFETY DEBUG] 수신된 명령어: '{s}' -> '{u}'")

        try:
            # 기본 식별/상태/에러 명령어
            if u == "*IDN?":
                self._writeline(BANNER)
            elif u == "*RST":
                with self.lock:
                    self.__init_state_reset()
                self._writeline(OK)
            elif u == "SYST:ERR?":
                if self.err_stack:
                    self._writeline(self.err_stack.pop(0))
                else:
                    self._writeline('0,"No error"')
            elif u == "STAT?":
                self._writeline(self.state)
            
            # 3대 안전 시험 명령어
            elif u == "MANU:ACW:TEST":
                with self.lock:
                    if self.model.test_in_progress:
                        self._writeline(ERR_BUSY)
                    else:
                        result = self.model.execute_acw_test()
                        # SCPI 형식으로 응답
                        if result["result"] == TEST_PASS:
                            self._writeline(f"ACW,{result['voltage']:.1f}V,{result['current']:.3f}mA,{result['current_limit']:.1f}mA,PASS")
                        else:
                            self._writeline(f"ACW,{result['voltage']:.1f}V,{result['current']:.3f}mA,{result['current_limit']:.1f}mA,FAIL")
            
            elif u == "MANU:IR:TEST":
                with self.lock:
                    if self.model.test_in_progress:
                        self._writeline(ERR_BUSY)
                    else:
                        result = self.model.execute_ir_test()
                        # SCPI 형식으로 응답
                        if result["result"] == TEST_PASS:
                            self._writeline(f"IR,{result['voltage']:.1f}V,{result['resistance']:.2f}MΩ,{result['resistance_limit']:.1f}MΩ,PASS")
                        else:
                            self._writeline(f"IR,{result['voltage']:.1f}V,{result['resistance']:.2f}MΩ,{result['resistance_limit']:.1f}MΩ,FAIL")
            
            elif u == "MANU:GB:TEST":
                with self.lock:
                    if self.model.test_in_progress:
                        self._writeline(ERR_BUSY)
                    else:
                        result = self.model.execute_gb_test()
                        # SCPI 형식으로 응답
                        if result["result"] == TEST_PASS:
                            self._writeline(f"GB,{result['current']:.1f}A,{result['resistance']:.3f}Ω,{result['resistance_limit']:.3f}Ω,PASS")
                        else:
                            self._writeline(f"GB,{result['current']:.1f}A,{result['resistance']:.3f}Ω,{result['resistance_limit']:.3f}Ω,FAIL")
            
            # 시험 결과 질의
            elif u == "RESULT:ACW?":
                with self.lock:
                    result = self.model.get_last_result("ACW")
                if result:
                    if result["result"] == TEST_PASS:
                        self._writeline(f"ACW,{result['voltage']:.1f}V,{result['current']:.3f}mA,{result['current_limit']:.1f}mA,PASS")
                    else:
                        self._writeline(f"ACW,{result['voltage']:.1f}V,{result['current']:.3f}mA,{result['current_limit']:.1f}mA,FAIL")
                else:
                    self._writeline("ACW,NO_DATA")
            
            elif u == "RESULT:IR?":
                with self.lock:
                    result = self.model.get_last_result("IR")
                if result:
                    if result["result"] == TEST_PASS:
                        self._writeline(f"IR,{result['voltage']:.1f}V,{result['resistance']:.2f}MΩ,{result['resistance_limit']:.1f}MΩ,PASS")
                    else:
                        self._writeline(f"IR,{result['voltage']:.1f}V,{result['resistance']:.2f}MΩ,{result['resistance_limit']:.1f}MΩ,FAIL")
                else:
                    self._writeline("IR,NO_DATA")
            
            elif u == "RESULT:GB?":
                with self.lock:
                    result = self.model.get_last_result("GB")
                if result:
                    if result["result"] == TEST_PASS:
                        self._writeline(f"GB,{result['current']:.1f}A,{result['resistance']:.3f}Ω,{result['resistance_limit']:.3f}Ω,PASS")
                    else:
                        self._writeline(f"GB,{result['current']:.1f}A,{result['resistance']:.3f}Ω,{result['resistance_limit']:.3f}Ω,FAIL")
                else:
                    self._writeline("GB,NO_DATA")
            
            # 제어 명령어
            elif u == "INIT":
                with self.lock:
                    self.state = STATE_RUN
                self._writeline(OK)
            elif u == "ABORT":
                with self.lock:
                    self.state = STATE_READY
                    self.model.test_in_progress = False
                    self.model.current_test = None
                self._writeline(OK)

            else:
                self._writeline(ERR_SYNTAX)

        except Exception:
            self._push_err(ERR_DEV)
            self._writeline(ERR_DEV)

    def __init_state_reset(self):
        # *RST 기본값 설정
        self.model = SafetyTestModel()
        self.state = STATE_READY
        self.err_stack.clear()

    def serve(self):
        try:
            while self.running:
                if self.ser and self.ser.is_open:
                    data = self.ser.read(1024)
                    if not data:
                        continue
                    buf = bytearray()
                    buf.extend(data)
                    while b"\n" in buf:
                        line, _, buf = buf.partition(b"\n")
                        try:
                            self.handle_line(line.decode("utf-8", "ignore"))
                        except Exception:
                            self._push_err(ERR_DEV)
                            self._writeline(ERR_DEV)
                else:
                    # 파일 기반 통신 모드
                    time.sleep(0.1)
                    try:
                        with open(f"{self.port_name}_safety_input.txt", 'r') as f:
                            content = f.read().strip()
                            if content:
                                # 파일 내용을 처리하고 비움
                                for line in content.split('\n'):
                                    if line.strip():
                                        self.handle_line(line)
                                with open(f"{self.port_name}_safety_input.txt", 'w') as f:
                                    f.write("")
                    except Exception as e:
                        pass
        finally:
            self.close()

    def close(self):
        self.running = False
        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
        except Exception:
            pass

def main():
    if len(sys.argv) < 2:
        print("사용법: python rs232_safety_emulator.py <COM포트> [baud]")
        print("예시 : python rs232_safety_emulator.py COM5 115200")
        print("기본값: COM5, 115200")
        port = "COM5"
        baud = 115200
    else:
        port = sys.argv[1]
        baud = int(sys.argv[2]) if len(sys.argv) >= 3 else 115200
    
    try:
        emu = RS232SafetyEmu(port, baud)
        print(f"RS-232 SAFETY Emulator: {port} @ {baud} (LF 종료, 8-N-1, flowcontrol None)")
        print("지원 명령어:")
        print("  *IDN?, *RST, SYST:ERR?, STAT?, INIT, ABORT")
        print("  MANU:ACW:TEST, MANU:IR:TEST, MANU:GB:TEST")
        print("  RESULT:ACW?, RESULT:IR?, RESULT:GB?")
        emu.serve()
    except serial.SerialException as e:
        print(f"COM 포트 오류: {e}")
        print("가상 COM 포트를 생성하거나 다른 포트를 사용하세요.")
        print("또는 백엔드에서 시뮬레이션 모드를 사용하세요.")
    except KeyboardInterrupt:
        pass
    finally:
        if 'emu' in locals():
            emu.close()

if __name__ == "__main__":
    main()
