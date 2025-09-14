# 🛡️ 타입 안전성 개발 룰 (Type Safety Rules)

## 📋 핵심 원칙

### 1. **절대 금지사항**

- ❌ `any` 타입 사용 금지 (TypeScript)
- ❌ `# type: ignore` 주석 사용 금지 (Python)
- ❌ 타입 단언(`as any`) 남용 금지
- ❌ 타입 힌트 없는 함수 작성 금지

### 2. **필수 준수사항**

- ✅ 모든 함수에 타입 힌트 작성
- ✅ API 응답 타입 정의 필수
- ✅ 상태 관리 시 정확한 타입 지정
- ✅ 에러 처리 시 타입 안전성 보장

## 🔧 TypeScript (Frontend) 룰

### API 응답 타입 정의

```typescript
// ❌ 잘못된 예시
const response = await api.getData(); // any 타입
const data = response.data; // any 타입

// ✅ 올바른 예시
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface DeviceData {
  id: number;
  name: string;
  status: "CONNECTED" | "DISCONNECTED";
}

const response: ApiResponse<DeviceData[]> = await api.getDevices();
const devices: DeviceData[] = response.data;
```

### 상태 관리 타입 안전성

```typescript
// ❌ 잘못된 예시
const [data, setData] = useState([]); // any[]
const [status, setStatus] = useState(); // any

// ✅ 올바른 예시
interface MeasurementData {
  id: number;
  value: number;
  timestamp: string;
  result: "PASS" | "FAIL";
}

const [data, setData] = useState<MeasurementData[]>([]);
const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
```

### WebSocket 메시지 타입 정의

```typescript
// ❌ 잘못된 예시
interface WebSocketMessage {
  type: string;
  data: any; // any 사용 금지
}

// ✅ 올바른 예시
interface WebSocketMessage<T = unknown> {
  type: string;
  data: T;
  timestamp?: string;
}

interface MeasurementMessage {
  type: "measurement_data";
  data: MeasurementData;
}

interface BarcodeMessage {
  type: "barcode_scanned";
  data: { barcode: string };
}
```

## 🐍 Python (Backend) 룰

### 타입 힌트 필수 작성

```python
# ❌ 잘못된 예시
def send_command(device_id, command, delay=None):
    pass

# ✅ 올바른 예시
from typing import Optional, Dict, Any, List
from app.models.device import Device

def send_command(
    device_id: int,
    command: str,
    delay: Optional[float] = None
) -> Optional[str]:
    pass
```

### 모델 타입 명시

```python
# ❌ 잘못된 예시
def execute_measurement_phase(device: Any, db: Session):
    pass

# ✅ 올바른 예시
def execute_measurement_phase(
    device: Device,
    db: Session
) -> Dict[str, Any]:
    pass
```

### Pydantic 스키마 활용

```python
# ❌ 잘못된 예시
def create_measurement(data: dict):
    pass

# ✅ 올바른 예시
from app.schemas.measurement import MeasurementCreate

def create_measurement(data: MeasurementCreate) -> Measurement:
    pass
```

## 🚀 자동 타입 체크 설정

### TypeScript 설정 강화

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Python 타입 체크 도구

```bash
# mypy 설치 및 설정
pip install mypy
mypy --strict backend/app/
```

## 📝 코드 작성 체크리스트

### 개발 전 체크리스트

- [ ] API 응답 타입 정의했는가?
- [ ] 상태 변수 타입 지정했는가?
- [ ] 함수 매개변수 타입 힌트 작성했는가?
- [ ] 반환값 타입 지정했는가?
- [ ] 에러 처리 시 타입 안전성 보장했는가?

### 개발 중 체크리스트

- [ ] `any` 타입 사용하지 않았는가?
- [ ] 타입 단언 최소화했는가?
- [ ] 타입 가드 사용했는가?
- [ ] null/undefined 체크 했는가?

### 개발 후 체크리스트

- [ ] 타입 체크 통과했는가?
- [ ] 런타임 에러 없이 동작하는가?
- [ ] 코드 리뷰에서 타입 안전성 확인했는가?

## 🎯 우선순위 적용 룰

### 1단계: 기존 코드 정리

- 모든 `any` 타입을 구체적 타입으로 변경
- 누락된 타입 힌트 추가
- 타입 단언 최소화

### 2단계: 새 코드 작성 시

- 위 룰 100% 준수
- 타입 체크 도구 활용
- 코드 리뷰 시 타입 안전성 검증

### 3단계: 지속적 개선

- 주기적 타입 체크 실행
- 타입 오류 즉시 수정
- 팀 내 타입 안전성 문화 정착

## ⚠️ 예외 상황 처리

### 불가피한 경우만 허용

```typescript
// 외부 라이브러리 타입이 없는 경우
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const externalLib: any = require("external-lib");

// 동적 데이터 처리 시 타입 가드 사용
function isApiResponse(obj: unknown): obj is ApiResponse<unknown> {
  return typeof obj === "object" && obj !== null && "success" in obj;
}
```

이 룰을 철저히 준수하면 타입 오류를 근본적으로 해결할 수 있습니다! 🎉
