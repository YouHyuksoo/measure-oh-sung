# rs232_power_emulator.py
# RS-232 ASCII 프로토콜: *IDN?, *RST, SYST:ERR?, STAT?, INIT, ABORT
# 측정 질의: MEAS:POW? / MEAS:VOLT? / MEAS:CURR? / MEAS:FREQ? / READ?
# 설정: CONF:RATE <ms>, CONF:PF <0..1>, CONF:V:BASE <V>, CONF:I:BASE <A>, CONF:FREQ:BASE <Hz>
#      CONF:V:RANGE <Vmax>, CONF:I:RANGE <Amax>, CONF:NOISE V,<%>; I,வைக்%; F,வைக்%, CONF:STREAM ON|OFF
# 라인 종료: LF("\n"), 인코딩: UTF-8
import sys, time, threading, random, re, math
try:
    import serial
except ImportError:
    print("pip install pyserial 를 먼저 설치하세요.")
    sys.exit(1)

LF = "\n"
OK = "OK"
BANNER = "YOKOGAWA,WT310E,12345678,1.00"

ERR_SYNTAX = 'ERR,-100,"Syntax error"'
ERR_RANGE  = 'ERR,-200,"Parameter out of range"'
ERR_EXEC   = 'ERR,-300,"Execution error"'
ERR_BUSY   = 'ERR,-350,"Operation in progress"'
ERR_DEV    = 'ERR,-500,"Device error"'

STATE_READY = "READY"
STATE_RUN   = "RUN"
STATE_HOLD  = "HOLD"
STATE_ERROR = "ERROR"

def clip(x, lo, hi):
    return max(lo, min(hi, x))

class VIFPowerModel:
    """전압/전류/주파수 샘플을 생성하고 P = V * I * PF 계산"""
    def __init__(self):
        # 기준값(사용자 설정으로 변경 가능)
        self.V0 = 220.0     # volts
        self.I0 = 0.600     # amps
        self.F0 = 60.00     # Hz
        self.PF = 1.000
        # 노이즈(% 표준편차) - 10W 정도의 차이를 위해 증가
        self.noise_v = 2.0    # % (전압 노이즈 증가)
        self.noise_i = 3.0    # % (전류 노이즈 증가)
        self.noise_f = 0.1    # % (주파수 노이즈 약간 증가)
        # 레인지(최대값)
        self.v_range = 600.0
        self.i_range = 10.0
        # 내부 상태
        self.ts = time.time()
        self.lastV = self.V0
        self.lastI = self.I0
        self.lastF = self.F0
        self.lastP = self.V0 * self.I0 * self.PF
        self.energy_Wh = 0.0

    def set_base(self, kind, val):
        if kind == "V":
            if not (0 <= val <= 1000): return False
            self.V0 = val
        elif kind == "I":
            if not (0 <= val <= 100): return False
            self.I0 = val
        elif kind == "F":
            if not (0 <= val <= 1000): return False
            self.F0 = val
        return True

    def set_range(self, kind, val):
        if kind == "V":
            if val not in (150, 300, 600, 1000): return False
            self.v_range = float(val)
        elif kind == "I":
            if val not in (1, 5, 10, 20, 100): return False
            self.i_range = float(val)
        return True

    def set_noise(self, v=None, i=None, f=None):
        if v is not None:
            if not (0 <= v <= 20): return False
            self.noise_v = float(v)
        if i is not None:
            if not (0 <= i <= 50): return False
            self.noise_i = float(i)
        if f is not None:
            if not (0 <= f <= 10): return False
            self.noise_f = float(f)
        return True

    def set_pf(self, pf):
        if not (0.0 <= pf <= 1.0): return False
        self.PF = float(pf)
        return True

    def zero_energy(self):
        self.energy_Wh = 0.0

    def next_sample(self, dt_s):
        # 가우시안 노이즈 적용 (표준편차 = 기준값 * %/100)
        V = clip(random.gauss(self.V0, self.V0 * self.noise_v / 100.0), 0.0, self.v_range)
        I = clip(random.gauss(self.I0, self.I0 * self.noise_i / 100.0), 0.0, self.i_range)
        F = clip(random.gauss(self.F0, self.F0 * self.noise_f / 100.0), 0.0, 1000.0)
        
        # 시간에 따른 주기적 변화 추가 (10W 정도의 변동)
        time_factor = math.sin(time.time() * 0.5) * 0.05  # ±5% 변동
        additional_noise = random.uniform(-0.02, 0.02)    # ±2% 추가 랜덤 변동
        
        # 전력 계산에 변동 적용
        P = max(0.0, V * I * self.PF * (1.0 + time_factor + additional_noise))
        
        self.lastV, self.lastI, self.lastF, self.lastP = V, I, F, P
        # 에너지 적산 (Wh)
        self.energy_Wh += (P * dt_s) / 3600.0
        self.ts = time.time()

    def snapshot(self):
        return dict(ts=self.ts, V=self.lastV, I=self.lastI, F=self.lastF, P=self.lastP, ENER=self.energy_Wh)

class RS232PowerEmu:
    def __init__(self, port, baud=115200):
        self.port_name = port
        self.baud = baud
        self.model = VIFPowerModel()
        self.rate_ms = 100
        self.state = STATE_READY
        self.stream_on = False
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
            print(f"✅ POWER 애뮬레이터 시리얼 포트 연결 성공: {port}")
        except Exception as e:
            print(f"⚠️ POWER 애뮬레이터 시리얼 포트 연결 실패: {e}")
            print(f"📁 파일 기반 통신으로 전환: {port}_power_input.txt <-> {port}_power_output.txt")
            # 파일 초기화
            with open(f"{port}_power_input.txt", 'w') as f:
                f.write("")
            with open(f"{port}_power_output.txt", 'w') as f:
                f.write("")
            self.ser = None

    # ---- 직렬 헬퍼
    def _writeline(self, s):
        try:
            if self.ser and self.ser.is_open:
                self.ser.write((s + LF).encode("utf-8"))
                self.ser.flush()  # 버퍼를 즉시 전송
                print(f"[POWER] 응답 전송: '{s}'")
            else:
                # 파일 기반 통신
                with open(f"{self.port_name}_power_output.txt", 'a') as f:
                    f.write(s + LF)
                print(f"[POWER] 파일 응답: '{s}'")
        except Exception as e:
            print(f"[POWER ERROR] 응답 전송 실패: {e}")
            pass

    def _push_err(self, code_msg):
        self.err_stack.append(code_msg)

    # ---- 샘플러/스트리머 스레드
    def sampler(self):
        last = time.time()
        while self.running:
            time.sleep(self.rate_ms / 1000.0)
            now = time.time()
            dt = max(0.0, now - last)
            last = now
            with self.lock:
                # 항상 샘플을 업데이트 (READY 상태에서도 측정 가능)
                self.model.next_sample(dt)
                
                if self.state == STATE_RUN and self.stream_on:
                    s = self.model.snapshot()
                    line = f"{s['ts']:.3f}, {s['P']:.3f}, {s['V']:.2f}, {s['I']:.3f}, {s['F']:.2f}, {self.state}"
                    self._writeline(line)

    # ---- 명령 처리
    def handle_line(self, raw):
        s = raw.strip()
        if not s:
            return
        u = s.upper()
        
        # 디버그 로그 추가
        print(f"[POWER DEBUG] 수신된 명령어: '{s}' -> '{u}'")

        try:
            # WT310 식별/상태/에러 명령어
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
            
            # WT310 통신 제어 명령어
            elif u == ":COMMUNICATE:REMOTE ON":
                self._writeline(OK)
            elif u == ":COMMUNICATE:REMOTE OFF":
                self._writeline(OK)
            elif u == ":COMMUNICATE:WAIT 1":
                # 갱신 이벤트 대기 (실제로는 즉시 응답)
                self._writeline(OK)
            
            # WT310 데이터 포맷 설정
            elif u.startswith(":NUMERIC:FORMAT"):
                if "ASCII" in u:
                    self._writeline(OK)
                elif "FLOAT" in u:
                    self._writeline(OK)
                else:
                    self._writeline(ERR_SYNTAX)
            
            # WT310 측정 항목 설정
            elif u == ":NUMERIC:NORMAL:CLEAR ALL":
                self._writeline(OK)
            elif u.startswith(":NUMERIC:NORMAL:ITEM1 P,"):
                self._writeline(OK)
            elif u == ":NUMERIC:NORMAL:NUMBER 1":
                self._writeline(OK)
            
            # WT310 측정값 질의
            elif u == ":NUMERIC:NORMAL:VALUE?":
                with self.lock:
                    p = self.model.lastP
                self._writeline(f"{p:.6E}")
            
            # WT310 상태 레지스터 질의
            elif u == ":STATUS:EESR?":
                self._writeline("0")

            # WT310 제어 명령어
            elif u == "INIT":
                with self.lock:
                    self.state = STATE_RUN
                self._writeline(OK)
            elif u == "ABORT":
                with self.lock:
                    self.state = STATE_READY
                self._writeline(OK)
            
            # WT310 측정 질의 (호환성을 위해 유지)
            elif u == "MEAS:POW?":
                with self.lock:
                    p = self.model.lastP
                self._writeline(f"{p:.3f}W")
            elif u == "MEAS:VOLT?":
                with self.lock:
                    v = self.model.lastV
                self._writeline(f"{v:.2f}V")
            elif u == "MEAS:CURR?":
                with self.lock:
                    i = self.model.lastI
                self._writeline(f"{i:.3f}A")
            elif u == "MEAS:FREQ?":
                with self.lock:
                    f = self.model.lastF
                self._writeline(f"{f:.2f}Hz")
            elif u == "MEAS:ENER?":
                with self.lock:
                    e = self.model.energy_Wh
                self._writeline(f"{e:.6f}Wh")
            elif u == "READ?":
                with self.lock:
                    snap = self.model.snapshot()
                    st = self.state
                self._writeline(
                    "RES,POW={:.3f}W,V={:.2f}V,I={:.3f}A,FREQ={:.2f}Hz,ENER={:.6f}Wh,STAT={}".format(
                        snap["P"], snap["V"], snap["I"], snap["F"], snap["ENER"], st
                    )
                )

            else:
                self._writeline(ERR_SYNTAX)

        except Exception:
            self._push_err(ERR_DEV)
            self._writeline(ERR_DEV)

    def __init_state_reset(self):
        # *RST 기본값 설정
        self.model = VIFPowerModel()
        self.rate_ms = 100
        self.state = STATE_READY
        self.stream_on = False
        self.err_stack.clear()

    def serve(self):
        sampler_thread = threading.Thread(target=self.sampler, daemon=True)
        sampler_thread.start()

        buf = bytearray()
        try:
            while self.running:
                if self.ser and self.ser.is_open:
                    data = self.ser.read(1024)
                    if not data:
                        continue
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
                        with open(f"{self.port_name}_power_input.txt", 'r') as f:
                            content = f.read().strip()
                            if content:
                                # 파일 내용을 처리하고 비움
                                for line in content.split('\n'):
                                    if line.strip():
                                        self.handle_line(line)
                                with open(f"{self.port_name}_power_input.txt", 'w') as f:
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
        print("사용법: python rs232_power_emulator.py <COM포트> [baud]")
        print("예시 : python rs232_power_emulator.py COM3 115200")
        print("기본값: COM3, 115200")
        port = "COM3"
        baud = 115200
    else:
        port = sys.argv[1]
        baud = int(sys.argv[2]) if len(sys.argv) >= 3 else 115200
    
    try:
        emu = RS232PowerEmu(port, baud)
        print(f"RS-232 POWER Emulator: {port} @ {baud} (LF 종료, 8-N-1, flowcontrol None)")
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
