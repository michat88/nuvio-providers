import { load } from 'cheerio';

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
let BASEDOM = "https://cloudnestra.com"; 
const SOURCE_URL = "https://vidsrc.xyz/embed";

function fetchWrapper(url, options) {
    return fetch(url, options);
}

function makeRequest(url, options = {}) {
    const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive'
    };
    return fetchWrapper(url, {
        method: options.method || 'GET',
        headers: { ...defaultHeaders, ...options.headers },
        ...options
    }).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    });
}

function serversLoad(html) {
    const $ = load(html);
    const servers = [];
    const title = $("title").text() ?? "";
    const baseFrameSrc = $("iframe").attr("src") ?? "";
    if (baseFrameSrc) {
        try {
            const fullUrl = baseFrameSrc.startsWith("//") ? "https:" + baseFrameSrc : baseFrameSrc;
            BASEDOM = new URL(fullUrl).origin;
        } catch (e) {}
    }
    $(".serversList .server").each((index, element) => {
        const server = $(element);
        servers.push({ name: server.text().trim(), dataHash: server.attr("data-hash") ?? null });
    });
    return { servers: servers, title: title };
}

function mapResolutionToQualityP(qualityString) {
    if (!qualityString) return 'Unknown';
    const resMatch = qualityString.match(/(\d+)x(\d+)/);
    if (!resMatch) return qualityString;
    const height = parseInt(resMatch[2], 10);
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    return `${height}p`;
}

function parseMasterM3U8(m3u8Content, masterM3U8Url) {
    const lines = m3u8Content.split('\n').map(line => line.trim());
    const streams = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXT-X-STREAM-INF:")) {
            let quality = "unknown";
            const resolutionMatch = lines[i].match(/RESOLUTION=(\d+x\d+)/);
            if (resolutionMatch) quality = mapResolutionToQualityP(resolutionMatch[1]);
            if (i + 1 < lines.length && lines[i + 1] && !lines[i + 1].startsWith("#")) {
                const streamUrlPart = lines[i + 1];
                try {
                    const fullStreamUrl = new URL(streamUrlPart, masterM3U8Url).href;
                    streams.push({ quality: quality, url: fullStreamUrl });
                } catch (e) {
                    streams.push({ quality: quality, url: streamUrlPart });
                }
                i++;
            }
        }
    }
    return streams;
}

function PRORCPhandler(prorcp) {
    const prorcpUrl = `${BASEDOM}/prorcp/${prorcp}`;
    return fetchWrapper(prorcpUrl, {
        headers: { "Referer": `${BASEDOM}/` }
    }).then(r => r.text()).then(resp => {
        const match = /file:\s*'([^']*)'/gm.exec(resp);
        if (match && match[1]) {
            return fetchWrapper(match[1], { headers: { "Referer": prorcpUrl } }).then(r => r.text()).then(m3u8 => parseMasterM3U8(m3u8, match[1]));
        }
        return null;
    }).catch(() => null);
}

function SRCRCPhandler(srcrcpPath, refererForSrcrcp) {
    const srcrcpUrl = BASEDOM + srcrcpPath;
    return fetchWrapper(srcrcpUrl, {
        headers: { "Referer": refererForSrcrcp }
    }).then(r => r.text()).then(resp => {
        if (!resp) return null;
        const fileMatch = /file:\s*'([^']*)'/gm.exec(resp);
        if (fileMatch && fileMatch[1]) {
            return fetchWrapper(fileMatch[1], { headers: { "Referer": srcrcpUrl } }).then(r => r.text()).then(m3u8 => parseMasterM3U8(m3u8, fileMatch[1]));
        }
        if (resp.trim().startsWith("#EXTM3U")) return parseMasterM3U8(resp, srcrcpUrl);
        return null;
    }).catch(() => null);
}

function rcpGrabber(html) {
    const match = html.match(/src:\s*'([^']*)'/);
    return match && match[1] ? { data: match[1] } : null;
}

function getUrl(id, type) {
    if (type === "movie") return `${SOURCE_URL}/movie/${id}`;
    const [tmdb, s, e] = id.split(':');
    return `${SOURCE_URL}/tv/${tmdb}/${s}-${e}`;
}

export async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    let id = tmdbId;
    let type = mediaType;
    if (mediaType === 'tv' && seasonNum && episodeNum) {
        id = `${tmdbId}:${seasonNum}:${episodeNum}`;
        type = 'series';
    }
    const url = getUrl(id, type === 'series' ? 'tv' : 'movie');

    try {
        const embedResp = await fetchWrapper(url, { headers: { "Referer": SOURCE_URL } }).then(r => r.text());
        if (!embedResp) return [];
        const { servers, title } = serversLoad(embedResp);
        const streams = [];

        for (const server of servers) {
            if (!server.dataHash) continue;
            try {
                const rcpUrl = `${BASEDOM}/rcp/${server.dataHash}`;
                const rcpHtml = await fetchWrapper(rcpUrl, { headers: { "Referer": url } }).then(r => r.text());
                const rcpData = rcpGrabber(rcpHtml);
                
                if (rcpData && rcpData.data) {
                    let streamDetails = [];
                    if (rcpData.data.startsWith("/prorcp/")) {
                        streamDetails = await PRORCPhandler(rcpData.data.replace("/prorcp/", ""));
                    } else if (rcpData.data.startsWith("/srcrcp/") && server.name !== "Superembed") {
                        streamDetails = await SRCRCPhandler(rcpData.data, rcpUrl);
                    }

                    if (streamDetails && streamDetails.length > 0) {
                        streams.push(...streamDetails.map(s => ({
                            name: "VidSrc",
                            title: `${title} - ${s.quality}`,
                            url: s.url,
                            quality: s.quality,
                            type: 'direct'
                        })));
                    }
                }
            } catch (e) {}
        }
        return streams;
    } catch (e) { return []; }
}
