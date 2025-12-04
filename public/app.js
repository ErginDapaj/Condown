document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
        resetForms();
    });
});
function resetForms() {
    document.getElementById('youtube-form').reset();
    document.getElementById('convert-form').reset();
    hideElements('youtube-info', 'youtube-progress', 'youtube-result', 'convert-progress', 'convert-result');
    updateFileInputLabel();
}
function hideElements(...ids) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}
function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
}
function setButtonLoading(buttonId, loading) {
    const button = document.getElementById(buttonId);
    const text = button.querySelector('.btn-text');
    const loader = button.querySelector('.btn-loader');
    if (loading) {
        button.disabled = true;
        text.style.display = 'none';
        loader.style.display = 'inline';
    } else {
        button.disabled = false;
        text.style.display = 'inline';
        loader.style.display = 'none';
    }
}
function updateProgress(progressId, textId, percent, message) {
    const progressFill = document.getElementById(progressId);
    const progressText = document.getElementById(textId);
    if (progressFill) {
        progressFill.style.width = `${Math.min(percent, 100)}%`;
    }
    if (progressText) {
        const percentText = percent > 0 ? `<span class="progress-percentage">${Math.round(percent)}%</span> - ` : '';
        progressText.innerHTML = `${percentText}${message}`;
    }
}
function showResult(elementId, success, message, downloadUrl = null) {
    const resultEl = document.getElementById(elementId);
    resultEl.className = `result ${success ? 'success' : 'error'}`;
    resultEl.innerHTML = `
        <h3>${success ? 'Success!' : 'Error'}</h3>
        <p>${message}</p>
        ${downloadUrl ? `<a href="${downloadUrl}" download>Download File</a>` : ''}
    `;
    showElement(elementId);
}
function updateFileInputLabel() {
    const fileInput = document.getElementById('video-file');
    const label = document.querySelector('.file-input-label');
    if (fileInput && label) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                label.classList.add('has-file');
                label.innerHTML = `<span>✓</span> ${e.target.files[0].name}`;
            } else {
                label.classList.remove('has-file');
                label.innerHTML = `<span>📁</span> Choose Video File`;
            }
        });
    }
}
updateFileInputLabel();
function setupDirectorySelector(selectId, inputId, browseBtnId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    const browseBtn = document.getElementById(browseBtnId);
    if (!select || !input || !browseBtn) return;
    select.addEventListener('change', () => {
        if (select.value === 'custom') {
            input.style.display = 'block';
            input.value = '';
            input.focus();
        } else {
            input.style.display = 'none';
            input.value = select.value;
        }
    });
    browseBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/directories');
            if (!response.ok) throw new Error('Failed to fetch directories');
            const directories = await response.json();
            showDirectoryBrowser(directories, (selectedPath) => {
                if (selectedPath) {
                    select.value = 'custom';
                    input.style.display = 'block';
                    input.value = selectedPath;
                }
            });
        } catch (error) {
            console.error('Error fetching directories:', error);
            alert('Failed to load directories. Please enter path manually.');
        }
    });
}
function showDirectoryBrowser(directories, callback) {
    const modal = document.createElement('div');
    modal.className = 'directory-modal';
    modal.innerHTML = `
        <div class="directory-modal-content">
            <div class="directory-modal-header">
                <h3>Select Directory</h3>
                <button class="directory-modal-close">&times;</button>
            </div>
            <div class="directory-modal-body">
                <div class="directory-list">
                    ${directories.map(dir => `
                        <div class="directory-item" data-path="${dir.path}">
                            <span class="directory-icon">📁</span>
                            <span class="directory-name">${dir.name}</span>
                            <span class="directory-path">${dir.path}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="directory-modal-footer">
                <button class="btn btn-secondary directory-modal-cancel">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const closeModal = () => {
        document.body.removeChild(modal);
    };
    modal.querySelector('.directory-modal-close').addEventListener('click', closeModal);
    modal.querySelector('.directory-modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    modal.querySelectorAll('.directory-item').forEach(item => {
        item.addEventListener('click', () => {
            const path = item.dataset.path;
            callback(path);
            closeModal();
        });
    });
}
setupDirectorySelector('youtube-output-select', 'youtube-output', 'youtube-browse-btn');
setupDirectorySelector('convert-output-select', 'convert-output', 'convert-browse-btn');
document.getElementById('youtube-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('youtube-url').value;
    const quality = document.getElementById('youtube-quality').value;
    const format = document.getElementById('youtube-format').value;
    const outputSelect = document.getElementById('youtube-output-select').value;
    const outputInput = document.getElementById('youtube-output').value.trim();
    const output = outputSelect === 'custom' ? outputInput : (outputSelect || '');
    setButtonLoading('youtube-submit', true);
    hideElements('youtube-info', 'youtube-result');
    showElement('youtube-progress');
    updateProgress('youtube-progress-fill', 'youtube-progress-text', 0, 'Fetching video information...');
    try {
        const infoResponse = await fetch('/api/youtube/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!infoResponse.ok) {
            const error = await infoResponse.json();
            throw new Error(error.error || 'Failed to get video info');
        }
        const info = await infoResponse.json();
        document.getElementById('youtube-info-content').innerHTML = `
            <p><strong>Title:</strong> ${info.title}</p>
            <p><strong>Channel:</strong> ${info.channel}</p>
            <p><strong>Duration:</strong> ${formatDuration(info.duration)}</p>
        `;
        showElement('youtube-info');
        const response = await fetch('/api/youtube/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, quality, format, output: output || undefined })
        });
        if (!response.ok) {
            throw new Error('Failed to start download');
        }
        if (response.body === null || response.body === undefined) {
            console.error('Response body is null or undefined');
            try {
                const text = await response.text();
                console.error('Response text:', text.substring(0, 200));
                const result = JSON.parse(text);
                if (result.error) {
                    throw new Error(result.error);
                }
                if (result.success || result.complete) {
                    updateProgress('youtube-progress-fill', 'youtube-progress-text', 100, 'Download complete!');
                    hideElements('youtube-progress');
                    showResult('youtube-result', true, 
                        `Video downloaded successfully: ${result.filename || 'video'}`, 
                        result.downloadUrl);
                }
                setButtonLoading('youtube-submit', false);
                return;
            } catch (fallbackError) {
                console.error('Fallback error:', fallbackError);
                throw new Error('Server response is not streamable. Please try again.');
            }
        }
        if (typeof response.body.getReader !== 'function') {
            console.error('Response.body.getReader is not a function. Response.body:', response.body);
            try {
                const text = await response.text();
                const result = JSON.parse(text);
                if (result.error) {
                    throw new Error(String(result.error || 'Unknown error'));
                }
                if (result.success || result.complete) {
                    updateProgress('youtube-progress-fill', 'youtube-progress-text', 100, 'Download complete!');
                    hideElements('youtube-progress');
                    showResult('youtube-result', true, 
                        `Video downloaded successfully: ${result.filename || 'video'}`, 
                        result.downloadUrl);
                }
                setButtonLoading('youtube-submit', false);
                return;
            } catch (jsonError) {
                console.error('Failed to parse as JSON:', jsonError);
                throw new Error('Response is not streamable and not valid JSON');
            }
        }
        let reader;
        try {
            reader = response.body.getReader();
        } catch (readerError) {
            console.error('Error getting reader:', readerError);
            throw new Error('Failed to create stream reader');
        }
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6).trim();
                            if (!jsonStr) continue; 
                            let data;
                            try {
                                data = JSON.parse(jsonStr);
                            } catch (parseError) {
                                console.error('Failed to parse JSON:', jsonStr.substring(0, 100), parseError);
                                continue; 
                            }
                            if (data && data.error) {
                                let errorMsg = 'Unknown error';
                                try {
                                    if (typeof data.error === 'string') {
                                        errorMsg = data.error;
                                    } else if (data.error && typeof data.error === 'object' && data.error.message) {
                                        errorMsg = data.error.message;
                                    } else if (data.error && typeof data.error === 'object') {
                                        errorMsg = JSON.stringify(data.error);
                                    } else {
                                        errorMsg = String(data.error);
                                    }
                                } catch (e) {
                                    errorMsg = 'Error occurred (could not stringify)';
                                }
                                throw new Error(errorMsg);
                            }
                            if (data.complete) {
                                updateProgress('youtube-progress-fill', 'youtube-progress-text', 100, 'Download complete!');
                                setTimeout(() => {
                                    hideElements('youtube-progress');
                                    showResult('youtube-result', true, 
                                        `Video downloaded successfully: ${data.filename}`, 
                                        data.downloadUrl);
                                }, 500);
                                setButtonLoading('youtube-submit', false);
                                return;
                            }
                            if (data.percent !== undefined) {
                                updateProgress('youtube-progress-fill', 'youtube-progress-text', 
                                    data.percent, data.message || 'Downloading...');
                            }
                        } catch (err) {
                            console.error('Error parsing SSE data:', err);
                        }
                    }
                }
            }
        } catch (streamError) {
            console.error('Stream reading error:', streamError);
            throw streamError;
        }
    } catch (error) {
        hideElements('youtube-progress');
        showResult('youtube-result', false, error.message);
        setButtonLoading('youtube-submit', false);
    }
});
document.getElementById('convert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('video-file');
    const format = document.getElementById('convert-format').value;
    const quality = document.getElementById('convert-quality').value;
    const outputSelect = document.getElementById('convert-output-select').value;
    const outputInput = document.getElementById('convert-output').value.trim();
    const output = outputSelect === 'custom' ? outputInput : (outputSelect || '');
    if (!fileInput.files[0]) {
        showResult('convert-result', false, 'Please select a video file');
        return;
    }
    setButtonLoading('convert-submit', true);
    hideElements('convert-result');
    showElement('convert-progress');
    updateProgress('convert-progress-fill', 'convert-progress-text', 0, 'Uploading file...');
    const formData = new FormData();
    formData.append('video', fileInput.files[0]);
    formData.append('format', format);
    formData.append('quality', quality);
    if (output) {
        formData.append('output', output);
    }
    try {
        const response = await fetch('/api/convert', {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            throw new Error('Failed to start conversion');
        }
        if (response.body === null || response.body === undefined) {
            console.error('Response body is null or undefined');
            try {
                const text = await response.text();
                console.error('Response text:', text.substring(0, 200));
                const result = JSON.parse(text);
                if (result.error) {
                    throw new Error(result.error);
                }
                if (result.success || result.complete) {
                    updateProgress('convert-progress-fill', 'convert-progress-text', 100, 'Conversion complete!');
                    hideElements('convert-progress');
                    showResult('convert-result', true, 
                        `Video converted successfully: ${result.filename || 'video'}`, 
                        result.downloadUrl);
                }
                setButtonLoading('convert-submit', false);
                return;
            } catch (fallbackError) {
                console.error('Fallback error:', fallbackError);
                throw new Error('Server response is not streamable. Please try again.');
            }
        }
        if (typeof response.body.getReader !== 'function') {
            console.error('Response.body.getReader is not a function. Response.body:', response.body);
            try {
                const text = await response.text();
                const result = JSON.parse(text);
                if (result.error) {
                    throw new Error(String(result.error || 'Unknown error'));
                }
                if (result.success || result.complete) {
                    updateProgress('convert-progress-fill', 'convert-progress-text', 100, 'Conversion complete!');
                    hideElements('convert-progress');
                    showResult('convert-result', true, 
                        `Video converted successfully: ${result.filename || 'video'}`, 
                        result.downloadUrl);
                }
                setButtonLoading('convert-submit', false);
                return;
            } catch (jsonError) {
                console.error('Failed to parse as JSON:', jsonError);
                throw new Error('Response is not streamable and not valid JSON');
            }
        }
        let reader;
        try {
            reader = response.body.getReader();
        } catch (readerError) {
            console.error('Error getting reader:', readerError);
            throw new Error('Failed to create stream reader');
        }
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6).trim();
                            if (!jsonStr) continue; 
                            let data;
                            try {
                                data = JSON.parse(jsonStr);
                            } catch (parseError) {
                                console.error('Failed to parse JSON:', jsonStr.substring(0, 100), parseError);
                                continue; 
                            }
                            if (data && data.error) {
                                let errorMsg = 'Unknown error';
                                try {
                                    if (typeof data.error === 'string') {
                                        errorMsg = data.error;
                                    } else if (data.error && typeof data.error === 'object' && data.error.message) {
                                        errorMsg = data.error.message;
                                    } else if (data.error && typeof data.error === 'object') {
                                        errorMsg = JSON.stringify(data.error);
                                    } else {
                                        errorMsg = String(data.error);
                                    }
                                } catch (e) {
                                    errorMsg = 'Error occurred (could not stringify)';
                                }
                                throw new Error(errorMsg);
                            }
                            if (data.complete) {
                                updateProgress('convert-progress-fill', 'convert-progress-text', 100, 'Conversion complete!');
                                setTimeout(() => {
                                    hideElements('convert-progress');
                                    showResult('convert-result', true, 
                                        `Video converted successfully: ${data.filename}`, 
                                        data.downloadUrl);
                                }, 500);
                                setButtonLoading('convert-submit', false);
                                return;
                            }
                            if (data.percent !== undefined) {
                                updateProgress('convert-progress-fill', 'convert-progress-text', 
                                    data.percent, data.message || 'Converting...');
                            }
                        } catch (err) {
                            console.error('Error parsing SSE data:', err);
                        }
                    }
                }
            }
        } catch (streamError) {
            console.error('Stream reading error:', streamError);
            throw streamError;
        }
    } catch (error) {
        hideElements('convert-progress');
        showResult('convert-result', false, error.message);
        setButtonLoading('convert-submit', false);
    }
});
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

