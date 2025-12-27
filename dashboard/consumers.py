import json
import asyncio
import re
import asyncssh
from channels.generic.websocket import AsyncWebsocketConsumer
import os

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
            action = data.get('action')
            ssh_data = data.get('ssh_data', {})
            
            if action == 'start':
                print(f"Starting monitor with SSH data: {ssh_data}")
                asyncio.create_task(self.monitor(ssh_data))
            elif action == 'list_directory':
                path = data.get('path', '~')
                await self.list_directory(ssh_data, path)
            elif action == 'read_file':
                filepath = data.get('filepath')
                await self.read_file(ssh_data, filepath)
            elif action == 'write_file':
                filepath = data.get('filepath')
                content = data.get('content', '')
                await self.write_file(ssh_data, filepath, content)
            elif action == 'create_file':
                filepath = data.get('filepath')
                await self.create_file(ssh_data, filepath)
            elif action == 'create_folder':
                folderpath = data.get('folderpath')
                await self.create_folder(ssh_data, folderpath)
            elif action == 'delete_file':
                filepath = data.get('filepath')
                await self.delete_file(ssh_data, filepath)
            elif action == 'rename':
                old_path = data.get('old_path')
                new_path = data.get('new_path')
                await self.rename_file(ssh_data, old_path, new_path)
        except Exception as e:
            print(f"Receive error: {e}")
            await self.send(text_data=json.dumps({'status': 'error', 'message': str(e)}))

    async def list_directory(self, ssh_data, path):
        try:
            async with asyncssh.connect(
                ssh_data.get('host'),
                port=int(ssh_data.get('port', 22)),
                username=ssh_data.get('user'),
                password=ssh_data.get('password'),
                known_hosts=None,
                connect_timeout=10
            ) as conn:
                if path == '~':
                    expand_cmd = f'ls -l ~'
                    real_path = '~'
                else:
                    expand_cmd = f'ls -l {path}'
                    real_path = path
                
                result = await conn.run(expand_cmd, timeout=5)
                output = result.stdout.strip()
                
                items = []
                for line in output.split('\n')[1:]: 
                    if not line.strip():
                        continue
                    
                    parts = line.split()
                    if len(parts) >= 9:
                        permissions = parts[0]
                        size = parts[4]
                        name = ' '.join(parts[8:])
                        item_type = 'directory' if permissions[0] == 'd' else 'file'
                        
                        items.append({
                            'name': name,
                            'type': item_type,
                            'size': size,
                            'permissions': permissions
                        })
                
                await self.send(text_data=json.dumps({
                    'action': 'directory_list',
                    'status': 'success',
                    'path': real_path,
                    'items': items
                }))
        except Exception as e:
            print(f"List directory error: {e}")
            await self.send(text_data=json.dumps({
                'action': 'directory_list',
                'status': 'error',
                'message': str(e)
            }))

    async def read_file(self, ssh_data, filepath):
        try:
            async with asyncssh.connect(
                ssh_data.get('host'),
                port=int(ssh_data.get('port', 22)),
                username=ssh_data.get('user'),
                password=ssh_data.get('password'),
                known_hosts=None,
                connect_timeout=10
            ) as conn:
                result = await conn.run(f'cat "{filepath}"', timeout=5)
                content = result.stdout
                
                await self.send(text_data=json.dumps({
                    'action': 'file_content',
                    'status': 'success',
                    'filepath': filepath,
                    'content': content
                }))
        except Exception as e:
            print(f"Read file error: {e}")
            await self.send(text_data=json.dumps({
                'action': 'file_content',
                'status': 'error',
                'message': str(e)
            }))

    async def write_file(self, ssh_data, filepath, content):
        try:
            async with asyncssh.connect(
                ssh_data.get('host'),
                port=int(ssh_data.get('port', 22)),
                username=ssh_data.get('user'),
                password=ssh_data.get('password'),
                known_hosts=None,
                connect_timeout=10
            ) as conn:
                result = await conn.run(f'cat > "{filepath}"', input=content.encode(), timeout=5)
                
                await self.send(text_data=json.dumps({
                    'action': 'file_written',
                    'status': 'success',
                    'filepath': filepath
                }))
        except Exception as e:
            print(f"Write file error: {e}")
            await self.send(text_data=json.dumps({
                'action': 'file_written',
                'status': 'error',
                'message': str(e)
            }))

    async def create_file(self, ssh_data, filepath):
        try:
            async with asyncssh.connect(
                ssh_data.get('host'),
                port=int(ssh_data.get('port', 22)),
                username=ssh_data.get('user'),
                password=ssh_data.get('password'),
                known_hosts=None,
                connect_timeout=10
            ) as conn:
                await conn.run(f'touch "{filepath}"', timeout=5)
                
                await self.send(text_data=json.dumps({
                    'action': 'file_created',
                    'status': 'success',
                    'filepath': filepath
                }))
        except Exception as e:
            print(f"Create file error: {e}")
            await self.send(text_data=json.dumps({
                'action': 'file_created',
                'status': 'error',
                'message': str(e)
            }))

    async def create_folder(self, ssh_data, folderpath):
        try:
            async with asyncssh.connect(
                ssh_data.get('host'),
                port=int(ssh_data.get('port', 22)),
                username=ssh_data.get('user'),
                password=ssh_data.get('password'),
                known_hosts=None,
                connect_timeout=10
            ) as conn:
                await conn.run(f'mkdir -p "{folderpath}"', timeout=5)
                
                await self.send(text_data=json.dumps({
                    'action': 'folder_created',
                    'status': 'success',
                    'folderpath': folderpath
                }))
        except Exception as e:
            print(f"Create folder error: {e}")
            await self.send(text_data=json.dumps({
                'action': 'folder_created',
                'status': 'error',
                'message': str(e)
            }))

    async def delete_file(self, ssh_data, filepath):
        try:
            async with asyncssh.connect(
                ssh_data.get('host'),
                port=int(ssh_data.get('port', 22)),
                username=ssh_data.get('user'),
                password=ssh_data.get('password'),
                known_hosts=None,
                connect_timeout=10
            ) as conn:
                await conn.run(f'rm -rf "{filepath}"', timeout=5)
                
                await self.send(text_data=json.dumps({
                    'action': 'file_deleted',
                    'status': 'success',
                    'filepath': filepath
                }))
        except Exception as e:
            print(f"Delete file error: {e}")
            await self.send(text_data=json.dumps({
                'action': 'file_deleted',
                'status': 'error',
                'message': str(e)
            }))

    async def rename_file(self, ssh_data, old_path, new_path):
        try:
            async with asyncssh.connect(
                ssh_data.get('host'),
                port=int(ssh_data.get('port', 22)),
                username=ssh_data.get('user'),
                password=ssh_data.get('password'),
                known_hosts=None,
                connect_timeout=10
            ) as conn:
                await conn.run(f'mv "{old_path}" "{new_path}"', timeout=5)
                
                await self.send(text_data=json.dumps({
                    'action': 'item_renamed',
                    'status': 'success',
                    'old_path': old_path,
                    'new_path': new_path
                }))
        except Exception as e:
            print(f"Rename file error: {e}")
            await self.send(text_data=json.dumps({
                'action': 'item_renamed',
                'status': 'error',
                'message': str(e)
            }))

    async def files(self, ssh_data):
        try:
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
                        result = await conn.run('ls -l', timeout=5)
                        output = result.stdout.strip()
                        files = re.findall(r'^-.*\s+(\S+)$', output, re.MULTILINE)
                        print(f"Files: {files}")
                        await self.send(text_data=json.dumps({'status': 'success', 'files': files}))
                    except Exception as e:
                        print(f"Command error: {e}")
                        await self.send(text_data=json.dumps({'status': 'error', 'message': str(e)}))
                        break
                    
                    await asyncio.sleep(1)
        except Exception as e:
            print(f"Error: {e}")
            await self.send(text_data=json.dumps({'status': 'error', 'message': f"SSH error: {str(e)}"}))
    async def monitor(self, ssh_data):
        try:
            async with asyncssh.connect(
                ssh_data.get('host'),
                port=int(ssh_data.get('port', 22)),
                username=ssh_data.get('user'),
                password=ssh_data.get('password'),
                known_hosts=None,
                connect_timeout=10
            ) as conn:
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
                        data = {}
                        lines = output.strip().split('\n')

                        for i, line in enumerate(lines):
                            if line.startswith('CPU:'):
                                data['cpu'] = line.split('CPU: ')[1].strip()
                            elif line.startswith('RAM:'):
                                data['ram'] = line.split('RAM: ')[1].strip()
                            elif line.startswith('DISK:'):
                                for disk_line in lines[i+1:]:  
                                    if disk_line.strip()[:2] == '/ ':
                                        data['disk'] = disk_line.strip()
                                        break
                                break
                        
                        await self.send(text_data=json.dumps({
                            'status': 'success', #data.status in js 
                            'cpu': data.get('cpu', 'N/A'),
                            'ram': data.get('ram', 'N/A'),
                            'disk': data.get('disk', 'N/A'),
                        }))
                    except Exception as e:
                        print(f"Command error: {e}")
                        await self.send(text_data=json.dumps({'status': 'error', 'message': str(e)}))
                        break
                    
                    await asyncio.sleep(1)
        except Exception as e:
            print(f"SSH error: {e}")
            await self.send(text_data=json.dumps({'status': 'error', 'message': f"SSH error: {str(e)}"}))
