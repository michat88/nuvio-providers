const cheerio = require('cheerio-without-node-native');

const BASE_URL = "https://tv10.idlixku.com"; // Update domain jika perlu

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    return new Promise((resolve, reject) => {
        // 1. Dapatkan Metadata TMDB dulu untuk slug
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=b030404650f279792a8d3287232358e3`;

        fetch(tmdbUrl)
        .then(res => res.json())
        .then(tmdbData => {
            // Konversi judul ke format slug Idlix
            // Contoh: "The Flash" -> "the-flash"
            const title = tmdbData.title || tmdbData.name;
            const year = (tmdbData.release_date || tmdbData.first_air_date || "").substring(0, 4);
            
            const slug = title.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '') // Hapus karakter spesial
                .trim()
                .replace(/\s+/g, '-'); // Spasi jadi dash

            // 2. Bangun URL Halaman Idlix
            let url;
            if (mediaType === 'movie') {
                url = `${BASE_URL}/movie/${slug}-${year}`;
            } else {
                // Format TV: title-season-1-episode-1
                url = `${BASE_URL}/episode/${slug}-season-${seasonNum}-episode-${episodeNum}`;
            }

            console.log("Idlix Target URL:", url);
            
            return fetch(url).then(res => res.text()).then(html => ({html, url}));
        })
        .then(({html, pageUrl}) => {
            const $ = cheerio.load(html);
            
            // 3. Ekstrak Nonce dan Time (Sesuai kode Kotlin invokeIdlix)
            // Regex: window.idlixNonce='...' window.idlixTime=...
            const scriptContent = $('script:contains("window.idlix")').html();
            const nonceMatch = scriptContent.match(/window\.idlixNonce=['"]([a-f0-9]+)['"]/);
            const timeMatch = scriptContent.match(/window\.idlixTime=(\d+)/);

            if (!nonceMatch || !timeMatch) {
                throw new Error("Gagal mengambil token keamanan Idlix (Nonce/Time)");
            }

            const idlixNonce = nonceMatch[1];
            const idlixTime = timeMatch[1];
            
            // 4. Cari Player Options
            // Kotlin: document.select("ul#playeroptionsul > li")
            const promises = [];
            
            $('ul#playeroptionsul > li').each((i, el) => {
                const postId = $(el).attr('data-post');
                const nume = $(el).attr('data-nume');
                const type = $(el).attr('data-type');
                
                // Siapkan AJAX Request
                const ajaxUrl = `${BASE_URL}/wp-admin/admin-ajax.php`;
                const formData = new URLSearchParams();
                formData.append('action', 'doo_player_ajax');
                formData.append('post', postId);
                formData.append('nume', nume);
                formData.append('type', type);
                formData.append('_n', idlixNonce);
                formData.append('_p', postId);
                formData.append('_t', idlixTime);

                const req = fetch(ajaxUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': pageUrl
                    },
                    body: formData.toString()
                })
                .then(r => r.json())
                .then(json => {
                    // DI SINI TAHAP SULITNYA
                    // JSON response berisi: { embed_url: "...", key: "..." }
                    // Kotlin melakukan dekripsi di sini: 
                    // val metrix = parseJson<AesData>(json.embed_url).m
                    // val password = createIdlixKey(json.key, metrix)
                    // AesHelper.cryptoAESHandler(...)
                    
                    // KARENA KITA DI SANDBOX TANPA LIBRARY CRYPTO:
                    // Kita tidak bisa mendekripsi ini dengan mudah.
                    
                    // Untuk saat ini, kita log saja bahwa kita berhasil dapat data terenkripsi.
                    // Jika kamu ingin melanjutkannya, kamu harus inject library AES JS di sini.
                    console.log(`Berhasil fetch data player (Encrypted) untuk Source ${nume}`);
                    return null; 
                });
                
                promises.push(req);
            });
            
            return Promise.all(promises);
        })
        .then(results => {
            // Saat ini return kosong karena belum ada dekripsi
            resolve([]); 
        })
        .catch(err => {
            console.error("Idlix Error:", err);
            resolve([]);
        });
    });
}

// Helper untuk mendekode logika custom string Idlix (Ini Bagian Mudah)
// Bagian AES-nya yang sulit tanpa library.
function createIdlixKey(r, m) {
    const rList = r.split('x').filter(Boolean);
    let n = "";
    let reversedM = m.split("").reverse().join("");
    
    // Base64 decode manual (bisa pakai atob di browser env)
    // ...
    
    return n;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
