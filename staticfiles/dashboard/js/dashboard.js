console.log('dashboard.js loaded');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded fired');
    
    const cpuDisplay = document.getElementById('cpu');
    console.log('cpuDisplay element:', cpuDisplay);
    
    if (!cpuDisplay) {
        console.log('CPU display element not found, exiting');
        return;
    }

    const sshInfo = window.sshInfo;
    console.log('sshInfo:', sshInfo);
    
    if (!sshInfo) {
        cpuDisplay.textContent = 'CPU: No SSH info';
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host + '/ws/cpu/';
    console.log('Attempting WebSocket connection to:', wsUrl);
    
    const socket = new WebSocket(wsUrl);

    socket.onopen = function() {
        console.log('✓ WebSocket connected');
        const msg = {
            action: 'start',
            ssh_data: sshInfo
        };
        console.log('Sending:', msg);
        socket.send(JSON.stringify(msg));
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log('✓ Received:', data);
        
        if (data.status === 'error') {
            cpuDisplay.textContent = 'CPU: Error - ' + data.message;
        } else if (data.cpu) {
            cpuDisplay.textContent = 'CPU: ' + data.cpu;
        }
    };

    socket.onerror = function(error) {
        console.error('✗ WebSocket error:', error);
        cpuDisplay.textContent = 'CPU: WebSocket error';
    };

    socket.onclose = function() {
        console.log('✗ WebSocket disconnected');
        cpuDisplay.textContent = 'CPU: Disconnected';
    };
});


