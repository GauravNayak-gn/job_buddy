import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            await self.close()
            return
            
        self.user_id = str(user.id)
        self.group_name = f"user_{self.user_id}"
        
        # Join user group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
        
    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            
    async def receive(self, text_data):
        # In this REST + WS design, messages are sent over HTTP REST APIs and received via WS.
        # However, we can log or handle incoming messages over WS if needed in the future.
        pass
        
    # Receive message from group
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
            'conversation_id': event['conversation_id']
        }))
        
    # Receive new conversation notification from group
    async def chat_conversation(self, event):
        await self.send(text_data=json.dumps({
            'type': 'conversation',
            'conversation': event['conversation']
        }))
