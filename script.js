// Konfigurasi - PAKE ENDPOINT YANG BENER
const API_BASE = 'https://api.vreden.my.id/api/download';

const platformEndpoints = {
    tiktok: '/tiktok',
    instagram: '/instagram',
    youtube: '/youtube',
    facebook: '/facebook',
    twitter: '/twitter',
    pinterest: '/pinterest'
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

// Fetch dengan timeout
async function fetchWithTimeout(url, timeout = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Download handler
downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('🔗 Masukkan link video terlebih dahulu');
        return;
    }

    // Validasi link berdasarkan platform
    const validations = {
        tiktok: /(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i,
        instagram: /(instagram\.com|instagr\.am)/i,
        youtube: /(youtube\.com|youtu\.be)/i,
        facebook: /(facebook\.com|fb\.com|fb\.watch)/i,
        twitter: /(twitter\.com|x\.com)/i,
        pinterest: /(pinterest\.com|pin\.it)/i
    };
    
    const validator = validations[currentPlatform];
    if (validator && !validator.test(url)) {
        showError(`❌ Link bukan ${currentPlatform.charAt(0).toUpperCase() + currentPlatform.slice(1)}!`);
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
        
        const data = await fetchWithTimeout(apiUrl, 15000);
        console.log('✅ Response:', data);

        if (data.status === true && data.result) {
            if (currentPlatform === 'twitter') {
                displayTwitterResult(data.result);
            } else if (currentPlatform === 'pinterest') {
                displayPinterestResult(data.result);
            } else {
                displayTikTokResult(data.result);
            }
        } else if (data.data && data.data.result) {
            displayTikTokResult(data.data.result);
        } else if (data.result) {
            if (currentPlatform === 'twitter') {
                displayTwitterResult(data.result);
            } else if (currentPlatform === 'pinterest') {
                displayPinterestResult(data.result);
            } else {
                displayTikTokResult(data.result);
            }
        } else {
            showError(`⚠️ Gagal: ${data.message || 'Format response tidak dikenali'}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        if (error.name === 'AbortError') {
            showError('⏰ Timeout! Server terlalu lama merespons. Coba lagi.');
        } else if (error.message.includes('HTTP 400')) {
            showError('❌ Link tidak valid atau konten tidak ditemukan');
        } else if (error.message.includes('HTTP 403')) {
            showError('🚫 Akses ditolak. Coba link yang berbeda.');
        } else if (error.message.includes('Failed to fetch')) {
            showError('⚠️ Tidak bisa konek ke server. Cek koneksi internet.');
        } else {
            showError(`⚠️ Error: ${error.message}`);
        }
    } finally {
        loading.style.display = 'none';
        downloadBtn.disabled = false;
    }
});

// Display TikTok/IG/YT/FB result
function displayTikTokResult(data) {
    resultArea.style.display = 'block';
    resultContent.innerHTML = '';

    let videos = [];
    let thumbnail = data.cover || data.thumbnail || null;
    let title = data.title || data.caption || null;
    let author = data.author?.nickname || data.author?.fullname || null;
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
                let size = item.size ? formatSize(item.size) : 'Unknown';
                
                videos.push({
                    url: item.url,
                    quality: quality,
                    size: size,
                    type: item.type
                });
            }
        });
    }
    
    // Cek juga langsung dari play/hdplay (fallback)
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
                <div style="display: flex; gap: 12px; margin-top: 10px; font-size: 11px; color: #475569; flex-wrap: wrap;">
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

// Display Twitter/X result
function displayTwitterResult(data) {
    resultArea.style.display = 'block';
    resultContent.innerHTML = '';

    let videos = [];
    let thumbnail = data.cover || data.thumbnail || null;
    let title = data.title || data.caption || null;
    let author = data.author?.username || data.author?.name || null;

    // Ambil video dari data.data
    if (data.data && Array.isArray(data.data)) {
        data.data.forEach(item => {
            if (item.url) {
                let quality = item.type === 'nowatermark_hd' ? 'HD' : 
                              item.type === 'nowatermark' ? 'SD' : 
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

    // Tampilkan info
    if (thumbnail || title || author) {
        const infoCard = document.createElement('div');
        infoCard.className = 'thumbnail-preview';
        infoCard.innerHTML = `
            ${thumbnail ? `<img src="${thumbnail}" alt="Thumbnail" onerror="this.style.display='none'">` : ''}
            ${title ? `<div class="thumbnail-caption">${title.substring(0, 100)}${title.length > 100 ? '...' : ''}</div>` : ''}
            ${author ? `<div style="font-size: 11px; color: #1da1f2; margin-top: 6px;"><i class="fab fa-twitter"></i> @${author}</div>` : ''}
        `;
        resultContent.appendChild(infoCard);
    }

    if (videos.length === 0) {
        showError('❌ Tidak ada video yang ditemukan di tweet ini.');
        return;
    }

    videos.forEach(video => {
        const item = document.createElement('div');
        item.className = 'video-item';
        item.innerHTML = `
            <div class="video-quality">
                <i class="fab fa-twitter"></i> ${video.quality}
            </div>
            <div class="video-info">
                <div>Twitter Video - ${video.quality}</div>
                <div class="video-size">${video.size}</div>
            </div>
            <div class="download-icon">
                <i class="fas fa-download"></i>
            </div>
        `;
        item.onclick = () => downloadVideo(video.url, `twitter_${Date.now()}.mp4`);
        resultContent.appendChild(item);
    });
}

// Display Pinterest result
function displayPinterestResult(data) {
    resultArea.style.display = 'block';
    resultContent.innerHTML = '';

    let mediaUrl = null;
    let isVideo = false;
    let thumbnail = null;

    // Cek apakah video atau gambar
    if (data.video || data.url?.includes('.mp4')) {
        mediaUrl = data.video || data.url;
        isVideo = true;
        thumbnail = data.thumbnail || data.cover;
    } else if (data.image || data.url) {
        mediaUrl = data.image || data.url;
        isVideo = false;
    }

    if (!mediaUrl) {
        showError('❌ Tidak ada media yang ditemukan.');
        return;
    }

    // Tampilkan preview
    if (thumbnail && isVideo) {
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'thumbnail-preview';
        thumbDiv.innerHTML = `<img src="${thumbnail}" alt="Preview">`;
        resultContent.appendChild(thumbDiv);
    }

    // Tombol download
    const item = document.createElement('div');
    item.className = 'video-item';
    item.innerHTML = `
        <div class="video-quality">
            <i class="fab fa-pinterest"></i> ${isVideo ? 'Video' : 'Gambar'}
        </div>
        <div class="video-info">
            <div>Pinterest ${isVideo ? 'Video' : 'Image'}</div>
            <div class="video-size">Klik untuk download</div>
        </div>
        <div class="download-icon">
            <i class="fas fa-download"></i>
        </div>
    `;
    item.onclick = () => downloadMedia(mediaUrl, `pinterest_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`);
    resultContent.appendChild(item);
}

// Download media untuk Pinterest
function downloadMedia(url, filename) {
    showToast('⏬ Memulai download...');
    window.open(url, '_blank');
    showToast('🔗 Link dibuka di tab baru');
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
    showToast('⏬ Memulai download...');
    
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
            showToast('✅ Download dimulai!');
        } else {
            throw new Error();
        }
    } catch {
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
        twitter: ['twitter.com', 'x.com'],
        pinterest: ['pinterest.com', 'pin.it']
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