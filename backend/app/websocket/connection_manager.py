from typing import List, Dict, Any
from fastapi import WebSocket
import json
import asyncio

class ConnectionManager:
    """WebSocket 연결을 관리하는 클래스"""
    
    def __init__(self):
        # 활성 연결들을 저장
        self.active_connections: List[WebSocket] = []
        # 세션별 연결 관리 (세션 ID -> WebSocket 리스트)
        self.session_connections: Dict[str, List[WebSocket]] = {}
        
    async def connect(self, websocket: WebSocket, session_id: str = None):
        """WebSocket 연결을 수락하고 관리 리스트에 추가"""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # 세션 ID가 있는 경우 세션별로도 관리
        if session_id:
            if session_id not in self.session_connections:
                self.session_connections[session_id] = []
            self.session_connections[session_id].append(websocket)
            
    def disconnect(self, websocket: WebSocket, session_id: str = None):
        """WebSocket 연결을 종료하고 관리 리스트에서 제거"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            
        # 세션별 연결에서도 제거
        if session_id and session_id in self.session_connections:
            if websocket in self.session_connections[session_id]:
                self.session_connections[session_id].remove(websocket)
            # 세션에 연결이 없으면 세션도 삭제
            if not self.session_connections[session_id]:
                del self.session_connections[session_id]
                
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """특정 WebSocket 연결에 메시지 전송"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            print(f"Error sending personal message: {e}")
            
    async def send_personal_json(self, data: Dict[str, Any], websocket: WebSocket):
        """특정 WebSocket 연결에 JSON 데이터 전송"""
        try:
            await websocket.send_text(json.dumps(data))
        except Exception as e:
            print(f"Error sending personal JSON: {e}")
            
    async def broadcast(self, message: str):
        """모든 연결된 클라이언트에 메시지 브로드캐스트"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error broadcasting message: {e}")
                disconnected.append(connection)
                
        # 연결이 끊어진 클라이언트 정리
        for connection in disconnected:
            if connection in self.active_connections:
                self.active_connections.remove(connection)
                
    async def broadcast_json(self, data: Dict[str, Any]):
        """모든 연결된 클라이언트에 JSON 데이터 브로드캐스트"""
        message = json.dumps(data)
        await self.broadcast(message)
        
    async def broadcast_to_session(self, message: str, session_id: str):
        """특정 세션의 모든 클라이언트에 메시지 전송"""
        if session_id not in self.session_connections:
            return
            
        disconnected = []
        for connection in self.session_connections[session_id]:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error broadcasting to session {session_id}: {e}")
                disconnected.append(connection)
                
        # 연결이 끊어진 클라이언트 정리
        for connection in disconnected:
            self.disconnect(connection, session_id)
            
    async def broadcast_json_to_session(self, data: Dict[str, Any], session_id: str):
        """특정 세션의 모든 클라이언트에 JSON 데이터 전송"""
        message = json.dumps(data)
        await self.broadcast_to_session(message, session_id)
        
    def get_session_count(self, session_id: str) -> int:
        """특정 세션의 연결 수 반환"""
        return len(self.session_connections.get(session_id, []))
        
    def get_total_connections(self) -> int:
        """전체 연결 수 반환"""
        return len(self.active_connections)

# 전역 연결 매니저 인스턴스
manager = ConnectionManager()