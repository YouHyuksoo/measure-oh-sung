from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import json
import asyncio
from datetime import datetime

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Remove disconnected connections
                try:
                    self.active_connections.remove(connection)
                except ValueError:
                    pass

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial status
        await websocket.send_text(json.dumps({
            "type": "connection_status",
            "data": {"status": "connected"},
            "timestamp": datetime.now().isoformat()
        }))
        
        while True:
            try:
                # Keep connection alive and wait for messages
                data = await websocket.receive_text()
                # Echo back the message
                await websocket.send_text(json.dumps({
                    "type": "echo",
                    "data": {"message": data},
                    "timestamp": datetime.now().isoformat()
                }))
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"WebSocket error: {e}")
                break
            
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)

@router.websocket("/ws/inspection")
async def inspection_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial inspection status
        await websocket.send_text(json.dumps({
            "type": "inspection_status",
            "data": {
                "is_listening": False,
                "connected_devices": 0,
                "total_devices": 0
            },
            "timestamp": datetime.now().isoformat()
        }))
        
        while True:
            try:
                # Wait for messages or send periodic heartbeat
                try:
                    # Try to receive a message with timeout
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                    # Process received message if any
                    print(f"Received inspection message: {data}")
                except asyncio.TimeoutError:
                    # Send periodic heartbeat
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat",
                        "data": {"status": "alive"},
                        "timestamp": datetime.now().isoformat()
                    }))
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"Inspection WebSocket error: {e}")
                break
            
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)

# Function to broadcast inspection updates
async def broadcast_inspection_update(data: dict):
    message = json.dumps({
        "type": "inspection_status",
        "data": data,
        "timestamp": datetime.now().isoformat()
    })
    await manager.broadcast(message)

@router.websocket("/ws/barcode")
async def barcode_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial barcode status
        await websocket.send_text(json.dumps({
            "type": "barcode_status",
            "data": {
                "is_listening": False,
                "connected_port": None,
                "last_barcode": None
            },
            "timestamp": datetime.now().isoformat()
        }))
        
        while True:
            try:
                # Wait for messages or send periodic heartbeat
                try:
                    # Try to receive a message with timeout
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                    # Process received message if any
                    print(f"Received barcode message: {data}")
                except asyncio.TimeoutError:
                    # Send periodic heartbeat
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat",
                        "data": {"status": "alive"},
                        "timestamp": datetime.now().isoformat()
                    }))
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"Barcode WebSocket error: {e}")
                break
            
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)

# Function to broadcast measurement data
async def broadcast_measurement_data(measurement: dict):
    message = json.dumps({
        "type": "measurement_data",
        "data": measurement,
        "timestamp": datetime.now().isoformat()
    })
    await manager.broadcast(message)

# Function to broadcast barcode data
async def broadcast_barcode_data(barcode: str):
    message = json.dumps({
        "type": "barcode_scanned",
        "data": {"barcode": barcode},
        "timestamp": datetime.now().isoformat()
    })
    await manager.broadcast(message)