"""
SCPI 명령어 관련 서비스
- SCPICommandsService: SCPI 명령어 관리 및 검증
"""
from typing import Dict, List, Any
from enum import Enum

class SCPICommandType(str, Enum):
    """SCPI 명령어 타입"""
    IDENTIFICATION = "identification"
    MEASUREMENT = "measurement"
    CONFIGURATION = "configuration"
    SYSTEM = "system"
    TRIGGER = "trigger"

class SCPICommandsService:
    """SCPI 명령어 관리 서비스"""
    
    def __init__(self):
        # 장비별 기본 SCPI 명령어 템플릿
        self.device_commands = {
            "KEYSIGHT_DMM": {
                "identification": {
                    "idn": "*IDN?",
                    "reset": "*RST",
                    "self_test": "*TST?"
                },
                "measurement": {
                    "voltage_dc": "MEAS:VOLT:DC?",
                    "voltage_ac": "MEAS:VOLT:AC?",
                    "current_dc": "MEAS:CURR:DC?",
                    "current_ac": "MEAS:CURR:AC?",
                    "resistance": "MEAS:RES?",
                    "continuity": "MEAS:CONT?"
                },
                "configuration": {
                    "set_voltage_range": "CONF:VOLT:DC {range}",
                    "set_current_range": "CONF:CURR:DC {range}",
                    "set_resolution": "CONF:VOLT:DC AUTO,{resolution}",
                    "set_sample_count": "SAMP:COUN {count}",
                    "set_trigger_source": "TRIG:SOUR {source}"
                },
                "system": {
                    "get_error": "SYST:ERR?",
                    "clear_error": "*CLS",
                    "get_status": "*STB?"
                }
            },
            "FLUKE_DMM": {
                "identification": {
                    "idn": "*IDN?",
                    "reset": "*RST"
                },
                "measurement": {
                    "voltage_dc": "MEAS:VOLT:DC?",
                    "voltage_ac": "MEAS:VOLT:AC?",
                    "current_dc": "MEAS:CURR:DC?",
                    "resistance": "MEAS:RES?"
                },
                "configuration": {
                    "set_voltage_range": "VOLT:DC:RANG {range}",
                    "set_auto_range": "VOLT:DC:RANG:AUTO ON"
                }
            },
            "RIGOL_OSCILLOSCOPE": {
                "identification": {
                    "idn": "*IDN?",
                    "reset": "*RST"
                },
                "measurement": {
                    "get_waveform": ":WAV:DATA?",
                    "measure_vpp": ":MEAS:VPP? CHAN1",
                    "measure_vrms": ":MEAS:VRMS? CHAN1",
                    "measure_frequency": ":MEAS:FREQ? CHAN1"
                },
                "configuration": {
                    "set_channel_scale": ":CHAN{channel}:SCAL {scale}",
                    "set_timebase": ":TIM:SCAL {scale}",
                    "set_trigger_level": ":TRIG:EDGE:LEV {level}",
                    "run": ":RUN",
                    "stop": ":STOP",
                    "single": ":SING"
                }
            },
            "GENERIC_POWER_SUPPLY": {
                "identification": {
                    "idn": "*IDN?",
                    "reset": "*RST"
                },
                "measurement": {
                    "measure_voltage": "MEAS:VOLT?",
                    "measure_current": "MEAS:CURR?"
                },
                "configuration": {
                    "set_voltage": "VOLT {voltage}",
                    "set_current": "CURR {current}",
                    "output_on": "OUTP ON",
                    "output_off": "OUTP OFF"
                }
            }
        }
    
    def get_device_commands(self, manufacturer: str, model: str) -> Dict[str, Any]:
        """제조사와 모델에 따른 명령어 세트를 반환합니다."""
        # 제조사별 매핑
        device_key = self._get_device_key(manufacturer, model)
        return self.device_commands.get(device_key, self.device_commands.get("GENERIC_DMM", {}))
    
    def _get_device_key(self, manufacturer: str, model: str) -> str:
        """제조사와 모델 정보로 장비 키를 생성합니다."""
        manufacturer = manufacturer.upper() if manufacturer else ""
        model = model.upper() if model else ""
        
        # 키사이트/애질런트 장비
        if "KEYSIGHT" in manufacturer or "AGILENT" in manufacturer:
            if any(dmm in model for dmm in ["34", "3458", "3457", "DMM"]):
                return "KEYSIGHT_DMM"
        
        # Fluke 장비
        elif "FLUKE" in manufacturer:
            if any(dmm in model for dmm in ["87", "175", "179", "DMM"]):
                return "FLUKE_DMM"
        
        # Rigol 장비
        elif "RIGOL" in manufacturer:
            if any(scope in model for scope in ["DS", "MSO", "SCOPE"]):
                return "RIGOL_OSCILLOSCOPE"
        
        # 전원공급장치
        elif any(psu in manufacturer for psu in ["POWER", "SUPPLY", "PSU"]):
            return "GENERIC_POWER_SUPPLY"
        
        # 기본값
        return "KEYSIGHT_DMM"
    
    def get_command(self, device_type: str, command_type: str, command_name: str, **kwargs) -> str:
        """특정 명령어를 가져와서 파라미터를 적용합니다."""
        commands = self.device_commands.get(device_type, {})
        command_group = commands.get(command_type, {})
        command_template = command_group.get(command_name, "")
        
        if command_template and kwargs:
            try:
                return command_template.format(**kwargs)
            except KeyError as e:
                raise ValueError(f"Missing parameter {e} for command {command_name}")
        
        return command_template
    
    def get_measurement_commands(self, device_type: str) -> List[str]:
        """측정 관련 명령어 목록을 반환합니다."""
        commands = self.device_commands.get(device_type, {})
        measurement_commands = commands.get("measurement", {})
        return list(measurement_commands.values())
    
    def get_configuration_commands(self, device_type: str, config: Dict[str, Any]) -> List[str]:
        """설정값에 따른 구성 명령어 목록을 생성합니다."""
        commands = self.device_commands.get(device_type, {})
        config_commands = commands.get("configuration", {})
        
        result = []
        for key, value in config.items():
            if key in config_commands:
                template = config_commands[key]
                try:
                    if isinstance(value, dict):
                        command = template.format(**value)
                    else:
                        command = template.format(value)
                    result.append(command)
                except (KeyError, ValueError) as e:
                    print(f"Error formatting command {key}: {e}")
        
        return result
    
    def validate_command(self, command: str) -> Dict[str, Any]:
        """SCPI 명령어의 유효성을 검사합니다."""
        result = {
            "valid": False,
            "type": None,
            "issues": []
        }
        
        command = command.strip()
        
        # 기본 검사
        if not command:
            result["issues"].append("Empty command")
            return result
        
        # SCPI 명령어 형식 검사
        if command.startswith("*"):
            result["type"] = "IEEE488.2"  # 표준 명령어
        elif ":" in command:
            result["type"] = "SCPI"  # SCPI 명령어
        else:
            result["issues"].append("Invalid SCPI format")
        
        # 쿼리 명령어 확인
        if command.endswith("?"):
            result["is_query"] = True
        else:
            result["is_query"] = False
        
        # 기본적인 구문 검사
        if not any(char.isalpha() for char in command):
            result["issues"].append("No alphabetic characters found")
        
        # 금지된 명령어 검사
        dangerous_commands = ["FORMAT:BORDER", "MMEM:DEL", "SYST:COMM:TCPIP:CONTROL?"]
        if any(dangerous in command.upper() for dangerous in dangerous_commands):
            result["issues"].append("Potentially dangerous command")
        
        result["valid"] = len(result["issues"]) == 0
        return result
    
    def get_command_help(self, command: str) -> Dict[str, Any]:
        """명령어에 대한 도움말을 제공합니다."""
        help_info = {
            "*IDN?": "장비 식별 정보 조회 (제조사, 모델, 시리얼번호, 펌웨어 버전)",
            "*RST": "장비를 기본 상태로 리셋",
            "*TST?": "셀프 테스트 실행",
            "MEAS:VOLT:DC?": "DC 전압 측정",
            "MEAS:VOLT:AC?": "AC 전압 측정",
            "MEAS:CURR:DC?": "DC 전류 측정",
            "MEAS:CURR:AC?": "AC 전류 측정",
            "CONF:VOLT:DC": "DC 전압 측정 설정",
            "SYST:ERR?": "시스템 오류 조회"
        }
        
        command_upper = command.upper().replace(" ", "")
        
        # 정확한 매치 찾기
        for help_cmd, description in help_info.items():
            if help_cmd.replace("?", "").replace(":", "") in command_upper:
                return {
                    "command": command,
                    "description": description,
                    "type": "SCPI" if ":" in help_cmd else "IEEE488.2",
                    "is_query": "?" in help_cmd
                }
        
        return {
            "command": command,
            "description": "명령어 정보를 찾을 수 없습니다.",
            "type": "Unknown"
        }

# 전역 SCPI 명령어 서비스 인스턴스
scpi_service = SCPICommandsService()
