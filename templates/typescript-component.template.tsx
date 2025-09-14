// 타입 안전한 React 컴포넌트 템플릿
import React, { useState, useEffect, useCallback } from "react";

// 1. Props 타입 정의
interface ComponentProps {
  // 필수 props
  title: string;
  data: DataType[];

  // 선택적 props
  onDataChange?: (data: DataType[]) => void;
  className?: string;

  // 이벤트 핸들러
  onSubmit?: (formData: FormData) => void;
  onError?: (error: Error) => void;
}

// 2. 상태 타입 정의
interface ComponentState {
  isLoading: boolean;
  error: string | null;
  selectedItems: number[];
  formData: FormData;
}

// 3. 데이터 타입 정의
interface DataType {
  id: number;
  name: string;
  status: "active" | "inactive" | "pending";
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  description: string;
  category: string;
}

// 4. API 응답 타입 정의
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

// 5. 컴포넌트 구현
const ComponentName: React.FC<ComponentProps> = ({
  title,
  data,
  onDataChange,
  className = "",
  onSubmit,
  onError,
}) => {
  // 6. 상태 초기화 (타입 명시)
  const [state, setState] = useState<ComponentState>({
    isLoading: false,
    error: null,
    selectedItems: [],
    formData: {
      name: "",
      description: "",
      category: "",
    },
  });

  // 7. 이벤트 핸들러 (타입 안전)
  const handleDataChange = useCallback(
    (newData: DataType[]) => {
      setState((prev) => ({ ...prev, data: newData }));
      onDataChange?.(newData);
    },
    [onDataChange]
  );

  const handleSubmit = useCallback(
    async (formData: FormData) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // API 호출 (타입 안전)
        const response = await fetch("/api/endpoint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const result: ApiResponse<DataType[]> = await response.json();

        if (result.success) {
          handleDataChange(result.data);
          onSubmit?.(formData);
        } else {
          throw new Error(result.message || "API 오류 발생");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "알 수 없는 오류";
        setState((prev) => ({ ...prev, error: errorMessage }));
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [handleDataChange, onSubmit, onError]
  );

  // 8. 타입 가드 함수
  const isValidData = (item: unknown): item is DataType => {
    return (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "name" in item &&
      "status" in item
    );
  };

  // 9. 렌더링
  return (
    <div className={`component-container ${className}`}>
      <h2>{title}</h2>

      {state.error && <div className="error-message">{state.error}</div>}

      {state.isLoading && <div className="loading">로딩 중...</div>}

      <div className="data-list">
        {data.filter(isValidData).map((item) => (
          <div key={item.id} className="data-item">
            <span>{item.name}</span>
            <span className={`status ${item.status}`}>{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComponentName;
