# 🚀 타입 안전한 개발 워크플로우

## 📋 개발 전 준비사항

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

### 1. 타입 체크 도구 설치

```bash
# Frontend 타입 체크 도구 (이미 설치됨)
cd frontend
npm install

# Backend 타입 체크 도구 설치
cd backend
pip install -r requirements.txt
```

### 2. 타입 안전성 룰 숙지

- `TYPE_SAFETY_RULES.md` 파일을 반드시 읽고 이해하기
- 템플릿 파일들을 참고하여 일관된 코드 작성

## 🔧 개발 워크플로우

### 1. 새 기능 개발 시작 전

```bash
# 전체 타입 체크 실행
npm run type-check:all

# 또는 개별 실행
npm run type-check          # Frontend만
npm run type-check:backend  # Backend만
```

### 2. 개발 중 실시간 타입 체크

```bash
# Frontend 실시간 타입 체크
cd frontend
npm run type-check:watch

# Backend 타입 체크 (수동)
cd backend
python -m mypy app/ --config-file mypy.ini
```

### 3. 타입 안전한 개발 서버 실행

```bash
# 타입 체크 후 개발 서버 시작
npm run dev:type-safe
```

## 📝 코드 작성 가이드라인

### 1. 새 컴포넌트 작성 시

```bash
# 템플릿 복사
cp templates/typescript-component.template.tsx src/components/NewComponent.tsx

# 템플릿을 기반으로 개발
# - Props 타입 정의
# - 상태 타입 정의
# - 이벤트 핸들러 타입 정의
```

### 2. 새 API 엔드포인트 작성 시

```bash
# 템플릿 복사
cp templates/api-endpoint.template.py backend/app/api/v1/endpoints/new_endpoint.py

# 템플릿을 기반으로 개발
# - 요청/응답 스키마 정의
# - 서비스 클래스 타입 안전하게 구현
# - 의존성 주입 타입 명시
```

### 3. 새 서비스 작성 시

```bash
# 템플릿 복사
cp templates/python-service.template.py backend/app/services/new_service.py

# 템플릿을 기반으로 개발
# - 제네릭 타입 활용
# - 타입 힌트 필수 작성
# - 에러 처리 타입 안전하게
```

## 🛡️ 타입 오류 해결 절차

### 1. 타입 오류 발생 시

```bash
# 1. 타입 오류 확인
npm run type-check:all

# 2. 오류 메시지 분석
# - 어떤 타입이 문제인지 파악
# - 어디서 타입 불일치가 발생했는지 확인

# 3. 해결 방법 적용
# - any 타입 사용 금지
# - 구체적인 타입 정의
# - 타입 가드 활용
# - 타입 단언 최소화
```

### 2. 일반적인 타입 오류 해결법

#### Frontend (TypeScript)

```typescript
// ❌ 문제가 있는 코드
const data: any = await api.getData();
const items = data.items; // any 타입

// ✅ 해결된 코드
interface ApiResponse {
  items: Item[];
  total: number;
}

const data: ApiResponse = await api.getData();
const items: Item[] = data.items; // 명확한 타입
```

#### Backend (Python)

```python
# ❌ 문제가 있는 코드
def process_data(data):
    return data.get('value', 0)

# ✅ 해결된 코드
from typing import Dict, Any, Union

def process_data(data: Dict[str, Any]) -> Union[int, float]:
    return data.get('value', 0)
```

## 🔍 코드 리뷰 체크리스트

### 필수 확인 사항

- [ ] `any` 타입 사용하지 않았는가?
- [ ] 모든 함수에 타입 힌트가 있는가?
- [ ] API 응답 타입이 정의되어 있는가?
- [ ] 에러 처리 시 타입 안전성을 보장했는가?
- [ ] 타입 체크가 통과하는가?

### 권장 확인 사항

- [ ] 타입 가드를 적절히 사용했는가?
- [ ] 제네릭 타입을 활용했는가?
- [ ] 타입 단언을 최소화했는가?
- [ ] 코드가 템플릿과 일관성이 있는가?

## 🚨 금지사항

### 절대 하지 말아야 할 것들

- ❌ `any` 타입 사용
- ❌ `# type: ignore` 주석 사용
- ❌ 타입 체크 없이 코드 작성
- ❌ 타입 정의 없이 API 호출
- ❌ 타입 힌트 없는 함수 작성

## 📊 성공 지표

### 타입 안전성 지표

- 타입 체크 통과율: 100%
- `any` 타입 사용률: 0%
- 타입 오류 발생률: 0%
- 런타임 타입 에러: 0%

### 개발 효율성 지표

- 타입 오류로 인한 개발 지연: 최소화
- 코드 리뷰 시간: 단축
- 버그 발생률: 감소
- 코드 유지보수성: 향상

## 🎯 목표

이 워크플로우를 통해:

1. **타입 오류 근본 해결**: 더 이상 타입 오류로 인한 개발 지연 없음
2. **코드 품질 향상**: 타입 안전성으로 인한 버그 감소
3. **개발 효율성 증대**: 명확한 타입으로 인한 개발 속도 향상
4. **유지보수성 개선**: 타입 정보로 인한 코드 이해도 향상

**오빠, 이제 타입 오류 걱정 없이 안전하게 개발할 수 있습니다!** 🎉
