const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const ENC_DEC_API = "https://enc-dec.app/api";
const VIDLINK_API = "https://vidlink.pro/api/b";

const VIDLINK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "Referer": "https://vidlink.pro/",
    "Origin": "https://vidlink.pro"
};

function makeRequest(url, options = {}) {
    return fetch(url, {
        method: options.method || 'GET',
        headers: { ...VIDLINK_HEADERS, ...options.headers },
        ...options
    }).then(r => { if (!r.ok) throw new Error(r.status); return r; });
}

function parseM3U8(content, baseUrl) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    const streams = [];
    let currentRes = null;
    for (const line of lines) {
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            if (resMatch) currentRes = resMatch[1];
        } else if (currentRes && !line.startsWith('#')) {
            streams.push({ resolution: currentRes, url: line.startsWith('http') ? line : new URL(line, baseUrl).toString() });
            currentRes = null;
        }
    }
    return streams;
}

function getQualityFromResolution(resolution) {
    if (!resolution) return 'Auto';
    const height = parseInt(resolution.split('x')[1]);
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    return '360p';
}

function processVidlinkResponse(data, mediaInfo) {
    const streams = [];
    if (data.stream && data.stream.playlist) {
        streams.push({
            name: "Vidlink - Auto",
            title: mediaInfo.title,
            url: data.stream.playlist,
            quality: "Auto",
            headers: VIDLINK_HEADERS
        });
    } else if (data.url) {
        streams.push({
            name: "Vidlink - Direct",
            title: mediaInfo.title,
            url: data.url,
            quality: "Auto",
            headers: VIDLINK_HEADERS
        });
    }
    return streams;
}

export async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbInfo = await makeRequest(tmdbUrl).then(r => r.json());
        const encryptedId = await makeRequest(`${ENC_DEC_API}/enc-vidlink?text=${tmdbId}`).then(r => r.json()).then(d => d.result);

        let vidlinkUrl = mediaType === 'tv' ? `${VIDLINK_API}/tv/${encryptedId}/${seasonNum}/${episodeNum}` : `${VIDLINK_API}/movie/${encryptedId}`;
        const data = await makeRequest(vidlinkUrl).then(r => r.json());

        const mediaInfo = { title: mediaType === 'tv' ? tmdbInfo.name : tmdbInfo.title };
        const streams = processVidlinkResponse(data, mediaInfo);

        for (let i = 0; i < streams.length; i++) {
            if (streams[i].url.includes('.m3u8')) {
                try {
                    const m3u8Content = await makeRequest(streams[i].url).then(r => r.text());
                    const parsed = parseM3U8(m3u8Content, streams[i].url);
                    if (parsed.length > 0) {
                        parsed.forEach(p => {
                            streams.push({
                                name: `Vidlink - ${getQualityFromResolution(p.resolution)}`,
                                title: mediaInfo.title,
                                url: p.url,
                                quality: getQualityFromResolution(p.resolution),
                                headers: VIDLINK_HEADERS
                            });
                        });
                    }
                } catch(e) {}
            }
        }
        return streams;
    } catch (e) { return []; }
}
