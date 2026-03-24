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

        console.log('Response:', data);

        if (data.status === true && data.result) {
            displayResult(data.result);
        } else if (data.data) {
            displayResult(data.data);
        } else if (data.result) {
            displayResult(data.result);
        } else {
            showError(data.message || 'Gagal memproses link');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showError('Koneksi error. Cek internet atau coba lagi');
    } finally {
        loading.style.display = 'none';
        downloadBtn.disabled = false;
    }
});

// Display result - KHUSUS UNTUK FORMAT TIKTOK
function displayResult(data) {
    resultArea.style.display = 'block';
    resultContent.innerHTML = '';

    let videos = [];
    let thumbnail = data.cover || null;
    let title = data.title || null;
    let author = data.author?.nickname || data.author?.fullname || null;
    let stats = data.stats || null;
    let duration = data.duration || data.durations + ' detik' || null;
    let musicInfo = data.music_info || null;

    // Ambil video dari data.data (array)
    if (data.data && Array.isArray(data.data)) {
        data.data.forEach(item => {
            if (item.url) {
                let quality = item.type === 'nowatermark' ? 'No Watermark' : 
                              item.type === 'nowatermark_hd' ? 'HD No Watermark' : 
                              item.type || 'Video';
                videos.push({
                    url: item.url,
                    quality: quality,
                    size: item.size ? formatSize(item.size) : 'Unknown',
                    type: item.type
                });
            }
        });
    }

    // Ambil audio/music
    if (musicInfo && musicInfo.url) {
        videos.push({
            url: musicInfo.url,
            quality: 'Audio',
            size: 'Unknown',
            type: 'music',
            title: musicInfo.title,
            author: musicInfo.author
        });
    }

    // Tampilkan thumbnail, title, author, stats
    if (thumbnail || title || author) {
        const infoCard = document.createElement('div');
        infoCard.className = 'thumbnail-preview';
        infoCard.innerHTML = `
            ${thumbnail ? `<img src="${thumbnail}" alt="Thumbnail">` : ''}
            ${title ? `<div class="thumbnail-caption">${title.substring(0, 100)}${title.length > 100 ? '...' : ''}</div>` : ''}
            ${author ? `<div style="font-size: 11px; color: #64748b; margin-top: 6px;"><i class="fas fa-user"></i> ${author}</div>` : ''}
            ${duration ? `<div style="font-size: 11px; color: #64748b;"><i class="fas fa-clock"></i> ${duration}</div>` : ''}
            ${stats ? `
                <div style="display: flex; gap: 12px; margin-top: 10px; font-size: 11px; color: #475569;">
                    ${stats.views ? `<span><i class="fas fa-eye"></i> ${stats.views}</span>` : ''}
                    ${stats.likes ? `<span><i class="fas fa-heart"></i> ${stats.likes}</span>` : ''}
                    ${stats.comment ? `<span><i class="fas fa-comment"></i> ${stats.comment}</span>` : ''}
                    ${stats.share ? `<span><i class="fas fa-share"></i> ${stats.share}</span>` : ''}
                </div>
            ` : ''}
        `;
        resultContent.appendChild(infoCard);
    }

    if (videos.length === 0) {
        showError('Tidak ada video yang ditemukan');
        return;
    }

    // Tampilkan daftar download
    videos.forEach(video => {
        const item = document.createElement('div');
        item.className = 'video-item';
        
        const icon = video.type === 'music' ? 'fa-music' : 'fa-video';
        const typeLabel = video.type === 'music' ? '🎵 Audio' : '📹 Video';
        
        item.innerHTML = `
            <div class="video-quality">
                <i class="fas ${icon}"></i> ${video.quality}
            </div>
            <div class="video-info">
                <div>${typeLabel} - ${video.quality}</div>
                ${video.title ? `<div style="font-size: 11px; color: #64748b;">${video.title.substring(0, 50)}</div>` : ''}
                <div class="video-size">${video.size}</div>
            </div>
            <div class="download-icon">
                <i class="fas fa-download"></i>
            </div>
        `;
        
        item.onclick = () => downloadVideo(video.url, `${currentPlatform}_${video.quality.replace(/\s+/g, '_')}_${Date.now()}.mp4`);
        resultContent.appendChild(item);
    });
}

// Format file size
function formatSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
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
            showToast('Download dimulai!');
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
        tiktok: ['tiktok.com', 'vm.tiktok', 'vt.tiktok'],
        instagram: ['instagram.com', 'instagr.am'],
        youtube: ['youtube.com', 'youtu.be'],
        facebook: ['facebook.com', 'fb.com', 'fb.watch'],
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

// Tambahin CSS buat toast kalo belum ada
const style = document.createElement('style');
style.textContent = `
    .toast-message {
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #0f172a;
        color: white;
        padding: 12px 24px;
        border-radius: 100px;
        font-size: 13px;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        animation: fadeInOut 2s ease forwards;
        white-space: nowrap;
    }
    
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
        15% { opacity: 1; transform: translateX(-50%) translateY(0); }
        85% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
`;
document.head.appendChild(style);