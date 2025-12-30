const cheerio = require('cheerio-without-node-native');

// Konstanta dari file Adicinemax21Extractor.kt
const SEARCH_URL = "https://moviebox.ph/wefeed-h5-bff/web/subject/search";
const STREAM_API = "https://fmoviesunblocked.net";
const TMDB_API_KEY = "b030404650f279792a8d3287232358e3"; // API Key dari source code Kotlin

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    return new Promise((resolve, reject) => {
        // 1. Fetch Metadata dari TMDB untuk mendapatkan Judul & Tahun
        // Adimoviebox butuh pencarian teks (keyword)
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

        fetch(tmdbUrl)
            .then(res => res.json())
            .then(tmdbData => {
                const title = tmdbData.title || tmdbData.name || tmdbData.original_title;
                // Ambil tahun (4 digit pertama)
                const releaseDate = tmdbData.release_date || tmdbData.first_air_date || "";
                const year = releaseDate ? parseInt(releaseDate.substring(0, 4)) : 0;

                // 2. Cari Konten di Adimoviebox
                // Kotlin: requestBody = mapOf("keyword" to title, "page" to 1, "perPage" to 10, "subjectType" to 0)
                const searchBody = {
                    keyword: title,
                    page: 1,
                    perPage: 10,
                    subjectType: 0
                };

                return fetch(SEARCH_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(searchBody)
                })
                .then(res => res.json())
                .then(searchRes => {
                    // Cek apakah data ada
                    if (!searchRes.data || !searchRes.data.items || searchRes.data.items.length === 0) {
                        throw new Error("Konten tidak ditemukan di Adimoviebox");
                    }

                    const items = searchRes.data.items;

                    // Logika Matching dari Kotlin:
                    // (item.title == title) ATAU (item.title contains title DAN itemYear == year)
                    const matchedMedia = items.find(item => {
                        const itemTitle = (item.title || "").toLowerCase();
                        const searchTitle = title.toLowerCase();
                        const itemYear = item.releaseDate ? parseInt(item.releaseDate.split("-")[0]) : 0;

                        // Exact match atau fuzzy match dengan tahun yang sama
                        return itemTitle === searchTitle || 
                               (itemTitle.includes(searchTitle) && itemYear === year);
                    });

                    if (!matchedMedia) {
                        // Fallback: ambil hasil pertama jika tidak ada yang cocok sempurna
                        // (Opsional, tapi membantu jika judul sedikit beda)
                        if (items.length > 0) return items[0]; 
                        throw new Error("Tidak ada hasil yang cocok");
                    }

                    return matchedMedia;
                });
            })
            .then(media => {
                // 3. Request Link Stream
                const subjectId = media.subjectId;
                const detailPath = media.detailPath;
                
                // Set Season & Episode (0 jika movie)
                const se = (mediaType === 'movie') ? 0 : seasonNum;
                const ep = (mediaType === 'movie') ? 0 : episodeNum;

                // URL untuk Play
                const playUrl = `${STREAM_API}/wefeed-h5-bff/web/subject/play?subjectId=${subjectId}&se=${se}&ep=${ep}`;
                
                // Valid Referer (PENTING: Diambil dari logika Kotlin agar tidak 403 Forbidden)
                // Kotlin: val validReferer = "$streamApi/spa/videoPlayPage/movies/${matchedMedia.detailPath}?id=$subjectId&type=/movie/detail&lang=en"
                // Catatan: path 'movies' mungkin perlu disesuaikan jika itu TV series, tapi di kode asli hardcoded 'movies' tampaknya.
                const validReferer = `${STREAM_API}/spa/videoPlayPage/movies/${detailPath}?id=${subjectId}&type=/movie/detail&lang=en`;

                return fetch(playUrl, {
                    headers: {
                        'Referer': validReferer
                    }
                })
                .then(res => res.json())
                .then(playRes => {
                    if (!playRes.data || !playRes.data.streams) {
                        throw new Error("Stream tidak ditemukan");
                    }

                    const streams = [];
                    const sourceStreams = playRes.data.streams;

                    // Kotlin: streams.reversed().forEach { ... }
                    // Kita ikuti urutannya
                    sourceStreams.reverse().forEach(source => {
                        if (source.url) {
                            streams.push({
                                name: `Adimoviebox - ${source.resolutions || "Auto"}`,
                                title: `Adimoviebox Stream`,
                                url: source.url,
                                quality: source.resolutions || "Auto",
                                headers: {
                                    "Referer": validReferer, // Header ini penting agar video bisa diputar
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
                console.log("Adimoviebox Error:", err.message);
                resolve([]); // Kembalikan array kosong agar aplikasi tidak crash
            });
    });
}

// Export module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
