console.log('filebrowser.js loaded');

class FileBrowser {
    constructor(containerId, socket, sshInfo) {
        this.container = document.getElementById(containerId);
        this.socket = socket;
        this.sshInfo = sshInfo;
        this.currentPath = '~';
        this.selectedItem = null;
        this.currentEditFile = null;
        
        this.init();
    }

    init() {
        console.log('FileBrowser init started');
        console.log('Container:', this.container);
        console.log('Socket:', this.socket);
        console.log('SSH Info:', this.sshInfo);
        
        if (!this.container) {
            console.error('Container element not found!');
            return;
        }
        
        if (!this.socket) {
            console.error('Socket not provided!');
            return;
        }
        
        this.originalOnMessage = this.socket.onmessage;
        const self = this;
        
        this.socket.onmessage = function(event) {
            console.log('Socket message received:', event.data);
            const data = JSON.parse(event.data);
            
            if (data.action) {
                console.log('File browser action:', data.action);
                self.handleMessage(data);
            } 
            else if (self.originalOnMessage) {
                self.originalOnMessage(event);
            }
        };
        
        this.createUI();
        console.log('UI created');
        
        if (this.socket.readyState === WebSocket.OPEN) {
            console.log('Socket already open, loading directory immediately');
            this.loadDirectory(this.currentPath);
        } else {
            console.log('Socket not ready, waiting...');
            setTimeout(() => {
                console.log('Attempting to load directory, socket state:', this.socket.readyState);
                this.loadDirectory(this.currentPath);
            }, 2000);
        }
    }

    createUI() {
        this.container.innerHTML = `
            <div class="file-browser">
                <div class="file-browser-toolbar">
                    <button id="btn-back" class="btn-icon" title="Back">Back</button>
                    <button id="btn-home" class="btn-icon" title="Home">Home</button>
                    <button id="btn-refresh" class="btn-icon" title="Refresh">Refresh</button>
                    <div class="path-display" id="path-display">~</div>
                    <button id="btn-new-file" class="btn-primary">+ File</button>
                    <button id="btn-new-folder" class="btn-primary">+ Folder</button>
                </div>
                
                <div class="file-list-container">
                    <div id="file-list" class="file-list">
                        <div class="loading">Loading files...</div>
                    </div>
                </div>
                
                <div id="file-editor" class="file-editor" style="display: none;">
                    <div class="editor-header">
                        <span id="editor-filename" class="editor-filename">File</span>
                        <div class="editor-actions">
                            <button id="btn-save" class="btn-success">Save</button>
                            <button id="btn-close-editor" class="btn-secondary">✖ Close</button>
                        </div>
                    </div>
                    <textarea id="editor-content" class="editor-textarea" spellcheck="false"></textarea>
                </div>
                
                <div id="context-menu" class="context-menu" style="display: none;">
                    <div class="context-menu-item" data-action="open">Open</div>
                    <div class="context-menu-item" data-action="edit">Edit</div>
                    <div class="context-menu-item" data-action="rename">Rename</div>
                    <div class="context-menu-item" data-action="delete">Delete</div>
                </div>
            </div>
        `;
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        document.getElementById('btn-back').addEventListener('click', () => this.goBack());
        document.getElementById('btn-home').addEventListener('click', () => this.goHome());
        document.getElementById('btn-refresh').addEventListener('click', () => this.loadDirectory(this.currentPath));
        document.getElementById('btn-new-file').addEventListener('click', () => this.createNewFile());
        document.getElementById('btn-new-folder').addEventListener('click', () => this.createNewFolder());
        
        document.getElementById('btn-save').addEventListener('click', () => this.saveFile());
        document.getElementById('btn-close-editor').addEventListener('click', () => this.closeEditor());
        
        const contextMenu = document.getElementById('context-menu');
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });
        
        contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleContextMenuAction(action);
                contextMenu.style.display = 'none';
            });
        });
    }

    loadDirectory(path) {
        console.log('Loading directory:', path);
        console.log('Socket ready state:', this.socket.readyState);
        console.log('SSH Info:', this.sshInfo);
        
        if (this.socket.readyState !== WebSocket.OPEN) {
            console.error('Socket not open! State:', this.socket.readyState);
            this.showError('WebSocket not connected');
            return;
        }
        
        const message = {
            action: 'list_directory',
            ssh_data: this.sshInfo,
            path: path
        };
        
        console.log('Sending message:', JSON.stringify(message));
        this.socket.send(JSON.stringify(message));
    }

    handleMessage(data) {
        console.log('File browser received:', data);
        
        switch(data.action) {
            case 'directory_list':
                if (data.status === 'success') {
                    this.currentPath = data.path;
                    this.renderFileList(data.items);
                    document.getElementById('path-display').textContent = data.path;
                } else {
                    this.showError(data.message);
                }
                break;
                
            case 'file_content':
                if (data.status === 'success') {
                    this.openEditor(data.filepath, data.content);
                } else {
                    this.showError(data.message);
                }
                break;
                
            case 'file_written':
                if (data.status === 'success') {
                    this.showSuccess('File saved successfully!');
                    this.closeEditor();
                    this.loadDirectory(this.currentPath);
                } else {
                    this.showError(data.message);
                }
                break;
                
            case 'file_deleted':
                if (data.status === 'success') {
                    this.showSuccess('Item deleted successfully!');
                    this.loadDirectory(this.currentPath);
                } else {
                    this.showError(data.message);
                }
                break;
                
            case 'file_created':
            case 'folder_created':
                if (data.status === 'success') {
                    this.showSuccess('Created successfully!');
                    this.loadDirectory(this.currentPath);
                } else {
                    this.showError(data.message);
                }
                break;
                
            case 'item_renamed':
                if (data.status === 'success') {
                    this.showSuccess('Renamed successfully!');
                    this.loadDirectory(this.currentPath);
                } else {
                    this.showError(data.message);
                }
                break;
        }
    }

    renderFileList(items) {
        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '';
        
        if (items.length === 0) {
            fileList.innerHTML = '<div class="empty-message">📭 Empty directory</div>';
            return;
        }
        
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'file-item';
            itemDiv.dataset.name = item.name;
            itemDiv.dataset.type = item.type;
            
            const icon = this.getFileIcon(item);
            const sizeDisplay = item.type === 'directory' ? '<span class="file-type">Folder</span>' : `<span class="file-size">${this.formatSize(item.size)}</span>`;
            
            itemDiv.innerHTML = `
                <div class="file-icon">${icon}</div>
                <div class="file-info">
                    <div class="file-name">${this.escapeHtml(item.name)}</div>
                    ${sizeDisplay}
                </div>
                <div class="file-permissions">${item.permissions}</div>
            `;
            
            itemDiv.addEventListener('dblclick', () => {
                if (item.type === 'directory') {
                    this.openDirectory(item.name);
                } else {
                    this.openFile(item.name);
                }
            });
            
            itemDiv.addEventListener('click', (e) => {
                document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
                itemDiv.classList.add('selected');
                this.selectedItem = item;
            });
            
            itemDiv.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.selectedItem = item;
                document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
                itemDiv.classList.add('selected');
                this.showContextMenu(e.pageX, e.pageY);
            });
            
            fileList.appendChild(itemDiv);
        });
    }

    getFileIcon(item) {
        if (item.type === 'directory') {
            return '📁';
        }
        
        return ''; 
    }

    formatSize(size) {
        if (size === '-') return '-';
        const num = parseInt(size);
        if (isNaN(num)) return size;
        
        if (num < 1024) return num + ' B';
        if (num < 1024 * 1024) return (num / 1024).toFixed(1) + ' KB';
        if (num < 1024 * 1024 * 1024) return (num / (1024 * 1024)).toFixed(1) + ' MB';
        return (num / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }

    openDirectory(name) {
        const newPath = this.currentPath + '/' + name;
        this.loadDirectory(newPath);
    }

    openFile(name) {
        const filepath = this.currentPath + '/' + name;
        console.log('Opening file:', filepath);
        this.socket.send(JSON.stringify({
            action: 'read_file',
            ssh_data: this.sshInfo,
            filepath: filepath
        }));
    }

    openEditor(filepath, content) {
        document.getElementById('file-editor').style.display = 'flex';
        document.getElementById('editor-filename').textContent = filepath;
        document.getElementById('editor-content').value = content;
        this.currentEditFile = filepath;
    }

    closeEditor() {
        document.getElementById('file-editor').style.display = 'none';
        this.currentEditFile = null;
    }

    saveFile() {
        if (!this.currentEditFile) return;
        
        const content = document.getElementById('editor-content').value;
        console.log('Saving file:', this.currentEditFile);
        this.socket.send(JSON.stringify({
            action: 'write_file',
            ssh_data: this.sshInfo,
            filepath: this.currentEditFile,
            content: content
        }));
    }

    goBack() {
        if (this.currentPath === '~' || this.currentPath === '/') return;
        
        const parts = this.currentPath.split('/');
        parts.pop();
        const newPath = parts.join('/') || '/';
        this.loadDirectory(newPath);
    }

    goHome() {
        this.loadDirectory('~');
    }

    createNewFile() {
        const filename = prompt('Enter file name:');
        if (!filename) return;
        
        const filepath = this.currentPath + '/' + filename;
        this.socket.send(JSON.stringify({
            action: 'create_file',
            ssh_data: this.sshInfo,
            filepath: filepath
        }));
    }

    createNewFolder() {
        const foldername = prompt('Enter folder name:');
        if (!foldername) return;
        
        const folderpath = this.currentPath + '/' + foldername;
        this.socket.send(JSON.stringify({
            action: 'create_folder',
            ssh_data: this.sshInfo,
            folderpath: folderpath
        }));
    }

    showContextMenu(x, y) {
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.display = 'block';
        
        const menuWidth = 150;
        const menuHeight = 150;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let left = x;
        let top = y;
        
        if (x + menuWidth > windowWidth) {
            left = windowWidth - menuWidth - 10;
        }
        
        if (y + menuHeight > windowHeight) {
            top = windowHeight - menuHeight - 10;
        }
        
        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
    }

    handleContextMenuAction(action) {
        if (!this.selectedItem) return;
        
        const itemPath = this.currentPath + '/' + this.selectedItem.name;
        
        switch(action) {
            case 'open':
                if (this.selectedItem.type === 'directory') {
                    this.openDirectory(this.selectedItem.name);
                } else {
                    this.openFile(this.selectedItem.name);
                }
                break;
                
            case 'edit':
                if (this.selectedItem.type === 'file') {
                    this.openFile(this.selectedItem.name);
                }
                break;
                
            case 'rename':
                const newName = prompt('Enter new name:', this.selectedItem.name);
                if (newName && newName !== this.selectedItem.name) {
                    const newPath = this.currentPath + '/' + newName;
                    this.socket.send(JSON.stringify({
                        action: 'rename',
                        ssh_data: this.sshInfo,
                        old_path: itemPath,
                        new_path: newPath
                    }));
                }
                break;
                
            case 'delete':
                const itemType = this.selectedItem.type === 'directory' ? 'folder' : 'file';
                if (confirm(`Are you sure you want to delete this ${itemType}?\n"${this.selectedItem.name}"`)) {
                    this.socket.send(JSON.stringify({
                        action: 'delete_file',
                        ssh_data: this.sshInfo,
                        filepath: itemPath
                    }));
                }
                break;
        }
    }

    showError(message) {
        const fileList = document.getElementById('file-list');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = 'Error: ' + message;
        fileList.prepend(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }

    showSuccess(message) {
        const fileList = document.getElementById('file-list');
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        fileList.prepend(successDiv);
        
        setTimeout(() => successDiv.remove(), 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.FileBrowser = FileBrowser;