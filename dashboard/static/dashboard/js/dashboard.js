document.addEventListener('DOMContentLoaded', function() {    
    const cpuDisplay = document.getElementById('cpu');
    const ramDisplay = document.getElementById('ram');
    const diskDisplay = document.getElementById('disk');
    
    if (!cpuDisplay || !ramDisplay || !diskDisplay) {
        return;
    }

    const sshInfo = window.sshInfo;
    console.log('sshInfo:', sshInfo);
    
    if (!sshInfo) {
        cpuDisplay.textContent = 'No SSH info';
        ramDisplay.textContent = 'No SSH info';
        diskDisplay.textContent = 'No SSH info';
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host + '/ws/cpu/';
    console.log('Attempting WebSocket connection to:', wsUrl);
    
    const socket = new WebSocket(wsUrl);

    socket.onopen = function() {
        console.log('WebSocket connected');
        const msg = {
            action: 'start',
            ssh_data: sshInfo
        };

        console.log('Sending:', msg);
        socket.send(JSON.stringify(msg));
        
        setTimeout(() => {
            const fileDisplay = document.getElementById('file-display');
            if (fileDisplay && window.FileBrowser) {
                window.fileBrowser = new FileBrowser('file-display', socket, sshInfo);
            }
        }, 500);
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log('Received:', data);
        if (!data.action && data.status) {
            if (data.status === 'error') {
                cpuDisplay.textContent = 'Error - ' + data.message;
                ramDisplay.textContent = 'Error - ' + data.message;
                diskDisplay.textContent = 'Error - ' + data.message;
            } else {
                cpuDisplay.textContent = 'CPU: ' + data.cpu;
                ramDisplay.textContent = 'RAM: ' + data.ram;
                diskDisplay.textContent = 'DISK: ' + data.disk;
            }
        }
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        cpuDisplay.textContent = 'CPU: WebSocket error';
        ramDisplay.textContent = 'RAM: WebSocket error';
        diskDisplay.textContent = 'DISK: WebSocket error';
    };

    socket.onclose = function() {
        console.log('WebSocket disconnected');
        cpuDisplay.textContent = 'CPU: Disconnected';
        ramDisplay.textContent = 'RAM: Disconnected';
        diskDisplay.textContent = 'DISK: Disconnected';
    };
});