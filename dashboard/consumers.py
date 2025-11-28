import json
import asyncio
import asyncssh
from channels.generic.websocket import AsyncWebsocketConsumer

class Consumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.monitoring = True
    #we aint using close code but its required so
    async def disconnect(self, close_code): 
        self.monitoring = False

    async def receive(self, text_data):
        data = json.loads(text_data)

        if data['action'] == 'start':
            ssh_data = data['ssh_data']
            self.monitoring = True
            asyncio.create_task(self.monitor(ssh_data)) 

    async def monitor(self, ssh_data):
        async with asyncssh.connect(
            ssh_data['host'],
            port = ssh_data.get('port', 22),
            username = ssh_data['user'],
            password = ssh_data['password'],
            known_hosts = None
        ) as conn:
            while self.monitoring:
                result = await conn.run("top -bn1 | grep 'Cpu(s)'")
                output = result.stdout
                cpu = round(100 - float([f for f in output if 'id' in f][0][:-3].strip()), 1) #type: ignore
                cpu = str(cpu) + '%'

                await self.send(text_data=json.dumps({
                    'cpu': cpu
                }))
                
                await asyncio.sleep(1)