import json
import asyncio
import re
import asyncssh
from channels.generic.websocket import AsyncWebsocketConsumer

class Consumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        print("WebSocket connected")

    async def disconnect(self, close_code):
        print("WebSocket disconnected")

    async def receive(self, text_data):
        print(f"Received: {text_data}")
        try:
            data = json.loads(text_data)
            if data.get('action') == 'start':
                ssh_data = data.get('ssh_data', {})
                print(f"Starting monitor with SSH data: {ssh_data}")
                asyncio.create_task(self.monitor(ssh_data))
        except Exception as e:
            print(f"Receive error: {e}")
            await self.send(text_data=json.dumps({'status': 'error', 'message': str(e)}))

    async def monitor(self, ssh_data):
        try:
            print(f"Connecting to {ssh_data.get('host')}:{ssh_data.get('port')}")
            async with asyncssh.connect(
                ssh_data.get('host'),
                port=int(ssh_data.get('port', 22)),
                username=ssh_data.get('user'),
                password=ssh_data.get('password'),
                known_hosts=None,
                connect_timeout=10
            ) as conn:
                print("SSH connected")
                while True:  
                    try:
                        result = await conn.run(
                            r"""
                            echo "CPU: $(top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\([0-9.]*\)%* id.*/\1/' | awk '{print 100 - $1"%"}')" \
                            && echo "RAM: $(free -m | awk '/Mem:/ {print $3"MB / "$2"MB"}')" \
                            && echo "DISK:" \
                            && df -h --output=target,used,size
                            """, #cpu ram and disk cmd
                            timeout=5
                        )
                        output_raw = result.stdout
                        output = output_raw.decode('utf-8') if isinstance(output_raw, bytes) else str(output_raw)
                        print(f"Command output: {output}")
                        data = {}
                        lines = output.strip().split('\n')

                        for i, line in enumerate(lines):
                            if line.startswith('CPU:'):
                                data['cpu'] = line.split('CPU: ')[1].strip()
                            elif line.startswith('RAM:'):
                                data['ram'] = line.split('RAM: ')[1].strip()
                            elif line.startswith('DISK:'):
                                disk_lines = []
                                for disk_line in lines[i+1:]:  
                                    if disk_line.strip():
                                        disk_lines.append(disk_line.strip())
                                data['disk'] = disk_lines
                                break
                        
                        print(f"Sending Data: {data}")
                        await self.send(text_data=json.dumps({
                            'status': 'success', #data.status in js 
                            'cpu': data.get('cpu', 'N/A'),
                            'ram': data.get('ram', 'N/A'),
                            'disk': data.get('disk', []),
                        }))
                    except Exception as e:
                        print(f"Command error: {e}")
                        await self.send(text_data=json.dumps({'status': 'error', 'message': str(e)}))
                        break
                    
                    await asyncio.sleep(1)
        except Exception as e:
            print(f"SSH error: {e}")
            await self.send(text_data=json.dumps({'status': 'error', 'message': f"SSH error: {str(e)}"}))
