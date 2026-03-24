// Konfigurasi
const API_BASE = 'https://api.vreden.my.id/api';
const CORS_PROXIES = [
    'https://cors-anywhere.herokuapp.com/',
    'https://api.allorigins.win/raw?url=',
    'https://thingproxy.freeboard.io/fetch/'
];

let currentPlatform = 'tiktok';
let currentProxyIndex = 0;

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

// Fetch dengan CORS proxy dan retry
async function fetchWithProxy(url, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            let fetchUrl = url;
            
            // Pake proxy kalo langsung gagal
            if (i > 0) {
                const proxy = CORS_PROXIES[currentProxyIndex % CORS_PROXIES.length];
                fetchUrl = proxy + encodeURIComponent(url);
                currentProxyIndex++;
                console.log(`🔄 Using proxy: ${proxy}`);
            }
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(fetchUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.log(`Attempt ${i + 1} failed:`, error.message);
            if (i === retries) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Download handler
downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('🔗 Masukkan link video terlebih dahulu');
        return;
    }

    resultArea.style.display = 'none';
    resultContent.innerHTML = '';
    loading.style.display = 'flex';
    downloadBtn.disabled = true;

    try {
        const endpoint = platformEndpoints[currentPlatform];
        const apiUrl = `${API_BASE}${endpoint}?url=${encodeURIComponent(url)}`;
        
        console.log('📡 Fetching:', apiUrl);
        
        const data = await fetchWithProxy(apiUrl);
        console.log('✅ Response:', data);

        if (data.status === true && data.result) {
            displayResult(data.result);
        } else if (data.data) {
            displayResult(data.data);
        } else if (data.result) {
            displayResult(data.result);
        } else if (data.video) {
            displayResult(data);
        } else {
            showError(`⚠️ Gagal: ${data.message || 'Format response tidak dikenali'}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        // Coba fallback ke API alternatif
        try {
            showToast('Mencoba server cadangan...');
            const fallbackData = await fallbackFetch(url);
            if (fallbackData) {
                displayResult(fallbackData);
                return;
            }
        } catch (e) {
            console.log('Fallback failed:', e);
        }
        
        showError('⚠️ Gagal konek ke server. Coba lagi nanti atau cek internet.');
    } finally {
        loading.style.display = 'none';
        downloadBtn.disabled = false;
    }
});

// Fallback API (TikWM langsung pake proxy)
async function fallbackFetch(url) {
    const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const proxyUrl = `https://cors-anywhere.herokuapp.com/${tikwmUrl}`;
    
    try {
        const response = await fetch(proxyUrl, {
            headers: {
                'Origin': 'https://www.tikwm.com'
            }
        });
        const data = await response.json();
        
        if (data.code === 0 && data.data) {
            return {
                title: data.data.title,
                cover: data.data.cover,
                duration: data.data.duration,
                author: data.data.author,
                data: [
                    { type: 'nowatermark', url: data.data.play },
                    { type: 'nowatermark_hd', url: data.data.hdplay },
                    { type: 'music', url: data.data.music }
                ]
            };
        }
        return null;
    } catch {
        return null;
    }
}

// Platform endpoints
const platformEndpoints = {
    tiktok: '/download/tiktok',
    instagram: '/download/instagram',
    youtube: '/download/youtube',
    facebook: '/download/facebook',
    twitter: '/download/twitter'
};

// Display result
function displayResult(data) {
    resultArea.style.display = 'block';
    resultContent.innerHTML = '';

    let videos = [];
    let thumbnail = data.cover || data.thumbnail || null;
    let title = data.title || data.caption || null;
    let author = data.author?.nickname || data.author?.fullname || data.author?.unique_id || null;
    let stats = data.stats || null;
    let duration = data.duration || (data.durations ? data.durations + ' detik' : null);

    // Ambil video dari data.data (array)
    if (data.data && Array.isArray(data.data)) {
        data.data.forEach(item => {
            if (item.url) {
                let quality = item.type === 'nowatermark' ? 'No Watermark' : 
                              item.type === 'nowatermark_hd' ? 'HD No Watermark' : 
                              item.type === 'music' ? 'Audio' :
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
    
    // Cek juga langsung dari play/hdplay
    if (data.play && !videos.find(v => v.url === data.play)) {
        videos.push({
            url: data.play,
            quality: 'No Watermark',
            size: 'Unknown',
            type: 'nowatermark'
        });
    }
    
    if (data.hdplay && !videos.find(v => v.url === data.hdplay)) {
        videos.push({
            url: data.hdplay,
            quality: 'HD No Watermark',
            size: 'Unknown',
            type: 'nowatermark_hd'
        });
    }
    
    // Ambil music
    if (data.music || data.music_info?.url) {
        const musicUrl = data.music || data.music_info?.url;
        if (musicUrl && !videos.find(v => v.url === musicUrl)) {
            videos.push({
                url: musicUrl,
                quality: 'Audio',
                size: 'Unknown',
                type: 'music'
            });
        }
    }

    // Tampilkan info card
    if (thumbnail || title || author) {
        const infoCard = document.createElement('div');
        infoCard.className = 'thumbnail-preview';
        infoCard.innerHTML = `
            ${thumbnail ? `<img src="${thumbnail}" alt="Thumbnail" onerror="this.style.display='none'">` : ''}
            ${title ? `<div class="thumbnail-caption">${title.substring(0, 120)}${title.length > 120 ? '...' : ''}</div>` : ''}
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
        showError('❌ Tidak ada video yang ditemukan. Coba link lain.');
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

// Download video dengan fallback
async function downloadVideo(url, filename) {
    showToast('⏬ Memulai download...');
    
    try {
        // Coba fetch dulu pake proxy kalo perlu
        let downloadUrl = url;
        
        // Kalo url dari tikwm, pake proxy
        if (url.includes('tikwm.com')) {
            downloadUrl = `https://cors-anywhere.herokuapp.com/${url}`;
        }
        
        const res = await fetch(downloadUrl);
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
            showToast('✅ Download dimulai!');
        } else {
            throw new Error();
        }
    } catch {
        // Fallback: buka di tab baru
        window.open(url, '_blank');
        showToast('🔗 Link dibuka di tab baru');
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

// Enter key
urlInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') downloadBtn.click();
});

// Tambahin CSS
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