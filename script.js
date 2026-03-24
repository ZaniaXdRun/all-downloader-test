// Konfigurasi
const API_BASE = 'https://api.vreden.my.id/api';

// Platform mapping ke endpoint
const platformEndpoints = {
    tiktok: '/download/tiktok',
    instagram: '/download/instagram',
    youtube: '/download/youtube',
    facebook: '/download/facebook',
    twitter: '/download/twitter'
};

let currentPlatform = 'tiktok';

// DOM Elements
const platformBtns = document.querySelectorAll('.platform-btn');
const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const loading = document.getElementById('loading');
const resultArea = document.getElementById('resultArea');
const resultContent = document.getElementById('resultContent');

// Platform selector handler
platformBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        platformBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPlatform = btn.dataset.platform;
        
        // Clear result
        resultArea.style.display = 'none';
        resultContent.innerHTML = '';
    });
});

// Download handler
downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('Masukkan link video terlebih dahulu!');
        return;
    }

    // Reset UI
    resultArea.style.display = 'none';
    resultContent.innerHTML = '';
    loading.style.display = 'block';
    downloadBtn.disabled = true;

    try {
        const endpoint = platformEndpoints[currentPlatform];
        const apiUrl = `${API_BASE}${endpoint}?url=${encodeURIComponent(url)}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status && data.data) {
            displayResult(data.data);
        } else {
            showError(data.message || 'Gagal memproses link. Coba lagi.');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Terjadi kesalahan. Periksa koneksi internet Anda.');
    } finally {
        loading.style.display = 'none';
        downloadBtn.disabled = false;
    }
});

// Display result
function displayResult(data) {
    resultArea.style.display = 'block';
    resultContent.innerHTML = '';

    let videos = [];
    
    if (data.video) {
        videos = [{
            url: data.video,
            quality: data.quality || 'HD',
            size: data.size || 'Unknown'
        }];
    } else if (data.videos && Array.isArray(data.videos)) {
        videos = data.videos;
    } else if (data.url) {
        videos = [{
            url: data.url,
            quality: data.quality || 'SD',
            size: data.size || 'Unknown'
        }];
    } else if (data.medias && Array.isArray(data.medias)) {
        videos = data.medias.map(m => ({
            url: m.url,
            quality: m.quality || m.resolution || 'Unknown',
            size: m.size || 'Unknown'
        }));
    } else if (typeof data === 'object') {
        for (let key in data) {
            if (typeof data[key] === 'string' && (data[key].startsWith('http') && (data[key].includes('.mp4') || data[key].includes('video')))) {
                videos.push({
                    url: data[key],
                    quality: key,
                    size: 'Unknown'
                });
            }
        }
    }

    if (videos.length === 0) {
        showError('Tidak ada video yang ditemukan.');
        return;
    }

    // Display videos
    videos.forEach((video, index) => {
        const videoEl = document.createElement('div');
        videoEl.className = 'video-item';
        videoEl.innerHTML = `
            <div class="video-quality">
                <i class="fas fa-hd"></i> ${video.quality}
            </div>
            <div class="video-info">
                <div>Kualitas ${video.quality}</div>
                <div class="video-size">${video.size}</div>
            </div>
            <div class="download-icon">
                <i class="fas fa-download"></i>
            </div>
        `;
        
        videoEl.addEventListener('click', () => {
            downloadVideo(video.url, `${currentPlatform}_${video.quality}_${Date.now()}.mp4`);
        });
        
        resultContent.appendChild(videoEl);
    });

    // Add thumbnail if exists
    if (data.thumbnail) {
        const thumbEl = document.createElement('div');
        thumbEl.style.cssText = `
            background: rgba(0,255,255,0.1);
            border-radius: 16px;
            padding: 12px;
            margin-bottom: 16px;
            text-align: center;
        `;
        thumbEl.innerHTML = `
            <img src="${data.thumbnail}" style="max-width: 100%; border-radius: 12px;" alt="Thumbnail">
            ${data.title ? `<div style="margin-top: 8px; font-size: 12px; color: #00ccff;">${data.title.substring(0, 100)}</div>` : ''}
        `;
        resultContent.insertBefore(thumbEl, resultContent.firstChild);
    }
}

// Download video
function downloadVideo(url, filename) {
    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        })
        .catch(error => {
            window.open(url, '_blank');
        });
}

// Show error message
function showError(message) {
    resultArea.style.display = 'block';
    resultContent.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
        </div>
    `;
}

// Enter key handler
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        downloadBtn.click();
    }
});

// Auto-detect platform dari URL
urlInput.addEventListener('input', (e) => {
    const url = e.target.value.toLowerCase();
    
    if (url.includes('tiktok.com')) {
        setActivePlatform('tiktok');
    } else if (url.includes('instagram.com')) {
        setActivePlatform('instagram');
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        setActivePlatform('youtube');
    } else if (url.includes('facebook.com') || url.includes('fb.com')) {
        setActivePlatform('facebook');
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
        setActivePlatform('twitter');
    }
});

function setActivePlatform(platform) {
    if (currentPlatform !== platform) {
        platformBtns.forEach(btn => {
            if (btn.dataset.platform === platform) {
                btn.click();
            }
        });
    }
}