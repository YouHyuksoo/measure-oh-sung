"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: string;
}

interface UseWebSocketReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const reconnectDelay = 5000;

  const connect = useCallback(() => {
    try {
      console.log("WebSocket 연결 시도:", url);
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("✅ WebSocket 연결됨:", url);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error("WebSocket 메시지 파싱 오류:", error);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket 연결 종료:", event.code, event.reason);
        setIsConnected(false);
        setSocket(null);

        // 자동 재연결 시도 (정상 종료가 아닌 경우만)
        if (
          event.code !== 1000 &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current++;
          console.log(
            `WebSocket 재연결 시도 ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else if (event.code !== 1000) {
          console.error("WebSocket 최대 재연결 시도 횟수 초과");
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket 연결 오류:", {
          url,
          error: error,
          message:
            "백엔드 서버가 실행 중인지 확인하세요 (http://localhost:8000)",
        });
        setIsConnected(false);
      };

      setSocket(ws);
    } catch (error) {
      console.error("WebSocket 연결 실패:", error);
      setIsConnected(false);
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (socket) {
      socket.close();
    }

    setSocket(null);
    setIsConnected(false);
    reconnectAttemptsRef.current = maxReconnectAttempts;
  }, [socket]);

  const sendMessage = useCallback(
    (message: any) => {
      if (socket && isConnected) {
        try {
          socket.send(JSON.stringify(message));
        } catch (error) {
          console.error("WebSocket 메시지 전송 오류:", error);
        }
      } else {
        console.warn("WebSocket이 연결되지 않았습니다");
      }
    },
    [socket, isConnected]
  );

  useEffect(() => {
    // 컴포넌트 마운트 시에만 연결 시도
    if (!socket && !isConnected) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url]); // url이 변경될 때만 재연결

  return {
    socket,
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  };
}
