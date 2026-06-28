/* --- FILE: admin/admin-resources.js --- */
/* This file handles the specific logic for the admin-resources page */

document.addEventListener('DOMContentLoaded', function() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('resourceFile');
    const fileInfo = document.getElementById('fileInfo');

    if (fileUploadArea) {
        fileUploadArea.addEventListener('click', () => fileInput.click());
        
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    function handleFileSelect(file) {
        if (!file) {
            clearFileSelection();
            return;
        }
        const fileSize = (file.size / (1024 * 1024)).toFixed(2);
        fileInfo.innerHTML = `
            <div class="file-selected">
                <i class="fas fa-file"></i>
                <div>
                    <strong>${file.name}</strong>
                    <span>${fileSize} MB</span>
                </div>
                <button type="button" onclick="clearFileSelection()" class="btn-remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        fileInfo.classList.remove('hidden');
    }

    // Make this function global so the button can access it
    window.clearFileSelection = function() {
        document.getElementById('resourceFile').value = '';
        document.getElementById('fileInfo').innerHTML = '';
        document.getElementById('fileInfo').classList.add('hidden');
    }
    
    // Also, we need to add the new CSS for this file upload area
    if (!document.getElementById('admin-resources-css')) {
        const style = document.createElement('style');
        style.id = 'admin-resources-css';
        style.innerHTML = `
            .file-upload-area {
                border: 2px dashed var(--border-color);
                border-radius: 8px;
                padding: 2rem;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .file-upload-area.dragover,
            .file-upload-area:hover {
                border-color: var(--primary-blue);
                background: #f0f9ff;
            }
            .file-upload-area i {
                font-size: 2rem;
                color: var(--primary-blue);
                margin-bottom: 1rem;
            }
            .file-upload-area p {
                font-weight: 600;
                margin: 0;
            }
            .file-upload-area span {
                font-size: 0.875rem;
                color: #6b7280;
            }
            .file-info.hidden { display: none; }
            .file-selected {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: #f8fafc;
                border-radius: 8px;
                margin-top: 1rem;
            }
            .file-selected i {
                font-size: 1.5rem;
                color: var(--dark-text);
            }
            .file-selected div {
                flex-grow: 1;
                text-align: left;
            }
            .file-selected strong {
                display: block;
                font-size: 0.875rem;
            }
            .file-selected span {
                font-size: 0.75rem;
                color: #6b7280;
            }
            .btn-remove {
                background: none;
                border: none;
                color: var(--danger);
                cursor: pointer;
                font-size: 1.2rem;
            }
        `;
        document.head.appendChild(style);
    }
});