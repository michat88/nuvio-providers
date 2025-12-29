const SEARCH_URL = "https://moviebox.ph/wefeed-h5-bff/web/subject/search";
const STREAM_API = "https://fmoviesunblocked.net";

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    return new Promise((resolve, reject) => {
        // 1. Ambil Metadata TMDB (Judul & Tahun)
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=b030404650f279792a8d3287232358e3`;

        fetch(tmdbUrl)
            .then(res => res.json())
            .then(tmdbData => {
                const title = tmdbData.title || tmdbData.name || tmdbData.original_title;
                const releaseDate = tmdbData.release_date || tmdbData.first_air_date || "";
                const year = parseInt(releaseDate.split('-')[0]) || 0;

                // 2. Cari di MovieBox API
                // Sesuai logika Kotlin: invokeAdimoviebox
                const searchBody = {
                    keyword: title,
                    page: 1,
                    perPage: 10,
                    subjectType: 0
                };

                return fetch(SEARCH_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    body: JSON.stringify(searchBody)
                })
                .then(res => res.json())
                .then(searchRes => {
                    if (!searchRes.data || !searchRes.data.items) {
                        throw new Error("MovieBox: Tidak ada hasil pencarian");
                    }

                    // Logika pencocokan (Fuzzy Match sesuai Kotlin)
                    // Cek judul sama persis ATAU (judul mengandung kata kunci DAN tahun sama)
                    const matchedItem = searchRes.data.items.find(item => {
                        const itemYear = parseInt((item.releaseDate || "").split('-')[0]);
                        const itemTitle = (item.title || "").toLowerCase();
                        const searchTitle = title.toLowerCase();

                        return itemTitle === searchTitle || 
                               (itemTitle.includes(searchTitle) && itemYear === year);
                    });

                    if (!matchedItem) {
                        throw new Error("MovieBox: Judul tidak cocok");
                    }

                    return matchedItem;
                });
            })
            .then(item => {
                // 3. Ambil Stream URL
                const subjectId = item.subjectId;
                
                // Logic Kotlin: Jika movie se/ep = 0, jika TV gunakan nomornya
                const se = mediaType === 'movie' ? 0 : seasonNum;
                const ep = mediaType === 'movie' ? 0 : episodeNum;
                
                const playUrl = `${STREAM_API}/wefeed-h5-bff/web/subject/play?subjectId=${subjectId}&se=${se}&ep=${ep}`;
                
                // Header Referer Wajib (diambil dari detailPath item)
                const refererUrl = `${STREAM_API}/spa/videoPlayPage/movies/${item.detailPath}?id=${subjectId}&type=/movie/detail&lang=en`;

                return fetch(playUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Referer': refererUrl
                    }
                })
                .then(res => res.json())
                .then(playRes => {
                    const streams = [];
                    
                    if (playRes.data && playRes.data.streams) {
                        // Reverse agar kualitas tinggi ada di atas (sesuai logika Kotlin: streams.reversed())
                        const serverStreams = playRes.data.streams.reverse();

                        serverStreams.forEach(stream => {
                            if (!stream.url) return;
                            
                            // Parsing resolusi untuk label kualitas
                            let quality = "Auto";
                            if (stream.resolutions) {
                                if (stream.resolutions.includes("2160") || stream.resolutions.includes("4k")) quality = "4K";
                                else if (stream.resolutions.includes("1080")) quality = "1080p";
                                else if (stream.resolutions.includes("720")) quality = "720p";
                                else if (stream.resolutions.includes("480")) quality = "480p";
                            }

                            streams.push({
                                name: `MovieBox ${quality}`,
                                title: `MovieBox Stream (${quality})`,
                                url: stream.url,
                                quality: quality,
                                headers: {
                                    "Referer": refererUrl,
                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                                },
                                provider: "moviebox"
                            });
                        });
                    }
                    
                    resolve(streams);
                });
            })
            .catch(err => {
                console.error("MovieBox Error:", err);
                resolve([]); // Return kosong agar app tidak crash
            });
    });
}

// Export Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
