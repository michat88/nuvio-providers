const cheerio = require('cheerio-without-node-native');

// Konstanta
const SEARCH_URL = "https://moviebox.ph/wefeed-h5-bff/web/subject/search";
const STREAM_API = "https://fmoviesunblocked.net";
const TMDB_API_KEY = "b030404650f279792a8d3287232358e3";

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    return new Promise((resolve, reject) => {
        // 1. Ambil Judul dari TMDB
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

        fetch(tmdbUrl)
            .then(res => res.json())
            .then(tmdbData => {
                // Ambil judul, prioritaskan original title jika title biasa kosong
                const title = tmdbData.title || tmdbData.name || tmdbData.original_title;
                const releaseDate = tmdbData.release_date || tmdbData.first_air_date || "";
                const year = releaseDate ? parseInt(releaseDate.substring(0, 4)) : 0;

                console.log(`[Adimoviebox] Mencari: ${title} (${year})`);

                // 2. Request Search ke Adimoviebox
                const searchBody = {
                    keyword: title,
                    page: 1,
                    perPage: 10,
                    subjectType: 0
                };

                return fetch(SEARCH_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(searchBody)
                })
                .then(res => res.json())
                .then(searchRes => {
                    if (!searchRes.data || !searchRes.data.items || searchRes.data.items.length === 0) {
                        throw new Error("Tidak ada hasil pencarian");
                    }

                    const items = searchRes.data.items;
                    
                    // --- PERBAIKAN LOGIKA PENCARIAN ---
                    // Logika Baru: Cari yang judulnya mirip. Abaikan tahun jika tidak ketemu yang pas.
                    
                    // Prioritas 1: Judul Sama Persis (Case Insensitive)
                    let matchedMedia = items.find(item => (item.title || "").toLowerCase() === title.toLowerCase());

                    // Prioritas 2: Judul Mengandung Kata Kunci (Fuzzy)
                    if (!matchedMedia) {
                        matchedMedia = items.find(item => (item.title || "").toLowerCase().includes(title.toLowerCase()));
                    }

                    // Prioritas 3: Ambil hasil paling atas (Fallback terakhir)
                    // Ini berisiko salah film, tapi lebih baik daripada "No Result"
                    if (!matchedMedia && items.length > 0) {
                        matchedMedia = items[0];
                    }

                    if (!matchedMedia) throw new Error("Gagal mencocokkan media");

                    return matchedMedia;
                });
            })
            .then(media => {
                // 3. Request Link
                const subjectId = media.subjectId;
                const detailPath = media.detailPath;
                
                // Set Season & Episode
                // Jika Movie, se/ep = 0. Jika TV tapi seasonNum undefined, default ke 1
                const se = (mediaType === 'movie') ? 0 : (seasonNum || 1);
                const ep = (mediaType === 'movie') ? 0 : (episodeNum || 1);

                const playUrl = `${STREAM_API}/wefeed-h5-bff/web/subject/play?subjectId=${subjectId}&se=${se}&ep=${ep}`;
                
                // Referer Wajib
                const validReferer = `${STREAM_API}/spa/videoPlayPage/movies/${detailPath}?id=${subjectId}&type=/movie/detail&lang=en`;

                return fetch(playUrl, {
                    headers: { 'Referer': validReferer }
                })
                .then(res => res.json())
                .then(playRes => {
                    if (!playRes.data || !playRes.data.streams) {
                        // Jangan throw error, kembalikan array kosong saja biar tidak crash
                        return []; 
                    }

                    const streams = [];
                    const sourceStreams = playRes.data.streams;

                    sourceStreams.reverse().forEach(source => {
                        if (source.url) {
                            streams.push({
                                name: `Adimoviebox ${source.resolutions || ""}`,
                                title: `Stream ${source.resolutions || "Auto"}`,
                                url: source.url,
                                quality: source.resolutions || "Auto",
                                headers: {
                                    "Referer": validReferer,
                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                                },
                                provider: "adimoviebox"
                            });
                        }
                    });
                    
                    resolve(streams);
                });
            })
            .catch(err => {
                // Error handling diam (silent) agar UI tidak terganggu
                console.log("[Adimoviebox] Error:", err.message);
                resolve([]); 
            });
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
