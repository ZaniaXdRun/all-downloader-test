// Konfigurasi
const API_BASE = 'https://api.vreden.my.id/api';

const platformEndpoints = {
    tiktok: '/download/tiktok',
    instagram: '/download/instagram',
    youtube: '/download/youtube',
    facebook: '/download/facebook',
    twitter: '/download/twitter'
};

let currentPlatform = 'tiktok';

// DOM Elements
const platformBtns = document.querySelectorAll('.platform-chip');
const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const loading = document.getElementById('loading');
const resultArea = document.getElementById('resultArea');
const resultContent = document.getElementById('resultContent');

// Platform selector
platformBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        platformBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPlatform = btn.dataset.platform;
        resultArea.style.display = 'none';
        resultContent.innerHTML = '';
    });
});

// Download handler
downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('Masukkan link video terlebih dahulu');
        return;
    }

    resultArea.style.display = 'none';
    resultContent.innerHTML = '';
    loading.style.display = 'flex';
    downloadBtn.disabled = true;

    try {
        const endpoint = platformEndpoints[currentPlatform];
        const apiUrl = `${API_BASE}${endpoint}?url=${encodeURIComponent(url)}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data && data.data) {
            displayResult(data.data);
        } else if (data && data.result) {
            displayResult(data.result);
        } else if (data && data.video) {
            displayResult(data);
        } else if (data && data.url) {
            displayResult(data);
        } else if (data && data.status === true) {
            displayResult(data.data || data);
        } else {
            showError(data.message || 'Gagal memproses link');
        }
    } catch (error) {
        showError('Koneksi error. Cek internet atau coba lagi');
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
    let thumbnail = null;
    let title = null;

    // Thumbnail
    if (data.thumbnail) thumbnail = data.thumbnail;
    if (data.thumb) thumbnail = data.thumb;
    if (data.cover) thumbnail = data.cover;

    // Title
    if (data.title) title = data.title;
    if (data.caption) title = data.caption;

    // Parse videos
    if (data.video && typeof data.video === 'string') {
        videos.push({ url: data.video, quality: data.quality || 'HD', size: data.size || 'Unknown' });
    }
    
    if (data.videos && Array.isArray(data.videos)) {
        data.videos.forEach(v => {
            videos.push({ url: v.url || v, quality: v.quality || 'SD', size: v.size || 'Unknown' });
        });
    }
    
    if (data.medias && Array.isArray(data.medias)) {
        data.medias.forEach(m => {
            if (m.url) videos.push({ url: m.url, quality: m.quality || 'SD', size: m.size || 'Unknown' });
        });
    }
    
    if (data.url && typeof data.url === 'string' && data.url.includes('.mp4')) {
        videos.push({ url: data.url, quality: data.quality || 'SD', size: data.size || 'Unknown' });
    }
    
    if (data.no_watermark && data.no_watermark.url) {
        videos.push({ url: data.no_watermark.url, quality: 'No Watermark', size: data.no_watermark.size || 'Unknown' });
    }
    
    if (data.watermark && data.watermark.url) {
        videos.push({ url: data.watermark.url, quality: 'With Watermark', size: data.watermark.size || 'Unknown' });
    }

    // Remove duplicates
    const unique = [];
    const seen = new Set();
    for (const v of videos) {
        if (!seen.has(v.url)) {
            seen.add(v.url);
            unique.push(v);
        }
    }
    videos = unique;

    if (videos.length === 0) {
        showError('Tidak ada video yang ditemukan');
        return;
    }

    // Thumbnail
    if (thumbnail) {
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'thumbnail-preview';
        thumbDiv.innerHTML = `
            <img src="${thumbnail}" onerror="this.style.display='none'">
            ${title ? `<div class="thumbnail-caption">${title.substring(0, 80)}${title.length > 80 ? '...' : ''}</div>` : ''}
        `;
        resultContent.appendChild(thumbDiv);
    }

    // Video list
    videos.forEach(video => {
        const item = document.createElement('div');
        item.className = 'video-item';
        item.innerHTML = `
            <div class="video-quality">
                <i class="fas fa-video"></i> ${video.quality}
            </div>
            <div class="video-info">
                <div>${video.quality}</div>
                <div class="video-size">${video.size}</div>
            </div>
            <div class="download-icon">
                <i class="fas fa-download"></i>
            </div>
        `;
        item.onclick = () => downloadVideo(video.url, `${currentPlatform}_${video.quality}_${Date.now()}.mp4`);
        resultContent.appendChild(item);
    });
}

// Download video
async function downloadVideo(url, filename) {
    showToast('Memulai download...');
    try {
        const res = await fetch(url);
        if (res.ok) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            showToast('Download dimulai');
        } else {
            throw new Error();
        }
    } catch {
        window.open(url, '_blank');
        showToast('Link dibuka di tab baru');
    }
}

// Show error
function showError(msg) {
    resultArea.style.display = 'block';
    resultContent.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            ${msg}
        </div>
    `;
}

// Show toast
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Enter key
urlInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') downloadBtn.click();
});

// Auto detect platform
urlInput.addEventListener('input', e => {
    const url = e.target.value.toLowerCase();
    const patterns = {
        tiktok: ['tiktok.com', 'vm.tiktok'],
        instagram: ['instagram.com'],
        youtube: ['youtube.com', 'youtu.be'],
        facebook: ['facebook.com', 'fb.com'],
        twitter: ['twitter.com', 'x.com']
    };
    for (const [platform, keywords] of Object.entries(patterns)) {
        if (keywords.some(k => url.includes(k))) {
            platformBtns.forEach(btn => {
                if (btn.dataset.platform === platform) btn.click();
            });
            break;
        }
    }
});
