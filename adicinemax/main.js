import { getStreams as getVidSrc } from './vidsrc.js';
import { getStreams as getVidLink } from './vidlink.js';

const TMDB_KEY = "b030404650f279792a8d3287232358e3"; 
const TMDB_URL = "https://api.themoviedb.org/3";

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

export const source = {
  async search(query) {
    try {
      const url = `${TMDB_URL}/search/multi?api_key=${TMDB_KEY}&language=id-ID&query=${encodeURIComponent(query)}&include_adult=false`;
      const res = await (await fetch(url, { headers })).json();
      return res.results
        .filter(item => item.media_type === "movie" || item.media_type === "tv")
        .map(item => ({
          title: item.title || item.name,
          poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
          url: JSON.stringify({
            id: item.id,
            type: item.media_type,
            title: item.title || item.name,
            year: (item.release_date || item.first_air_date || "").substring(0, 4)
          })
        }));
    } catch (e) { return []; }
  },

  async getMainPage() {
     try {
        const url = `${TMDB_URL}/trending/all/day?api_key=${TMDB_KEY}&language=id-ID`;
        const res = await (await fetch(url, { headers })).json();
        const items = res.results.map(item => ({
            title: item.title || item.name,
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            url: JSON.stringify({
                id: item.id,
                type: item.media_type,
                title: item.title || item.name,
                year: (item.release_date || item.first_air_date || "").substring(0, 4)
            })
        }));
        return [{ title: "Trending Adicinemax", items: items }];
     } catch (e) { return []; }
  },

  async detail(url) {
    const data = JSON.parse(url);
    const detailUrl = `${TMDB_URL}/${data.type}/${data.id}?api_key=${TMDB_KEY}&append_to_response=season,credits`;
    const res = await (await fetch(detailUrl, { headers })).json();
    
    const result = {
      title: res.title || res.name,
      description: res.overview,
      poster: res.poster_path ? `https://image.tmdb.org/t/p/original${res.poster_path}` : "",
      background: res.backdrop_path ? `https://image.tmdb.org/t/p/original${res.backdrop_path}` : "",
      year: (res.release_date || res.first_air_date || "").substring(0, 4),
      episodes: []
    };

    if (data.type === "movie") {
      result.episodes.push({
        title: "Full Movie",
        url: JSON.stringify({ id: data.id, type: "movie", season: 0, episode: 0 }),
        season: 1, episode: 1
      });
    } else {
      if (res.seasons) {
        for (const season of res.seasons) {
          if (season.season_number > 0) {
            const sUrl = `${TMDB_URL}/tv/${data.id}/season/${season.season_number}?api_key=${TMDB_KEY}`;
            const sRes = await (await fetch(sUrl, { headers })).json();
            if (sRes.episodes) {
              sRes.episodes.forEach(eps => {
                result.episodes.push({
                  title: `S${eps.season_number} E${eps.episode_number} - ${eps.name}`,
                  url: JSON.stringify({
                    id: data.id,
                    type: "tv",
                    season: eps.season_number,
                    episode: eps.episode_number
                  }),
                  season: eps.season_number,
                  episode: eps.episode_number,
                  description: eps.overview,
                  poster: eps.still_path ? `https://image.tmdb.org/t/p/w300${eps.still_path}` : ""
                });
              });
            }
          }
        }
      }
    }
    return result;
  },

  async stream(url) {
    const data = JSON.parse(url);
    const [vidSrc, vidLink] = await Promise.allSettled([
        getVidSrc(data.id, data.type, data.season, data.episode).catch(() => []),
        getVidLink(data.id, data.type, data.season, data.episode).catch(() => [])
    ]);
    
    let streams = [];
    if (vidSrc.status === "fulfilled" && Array.isArray(vidSrc.value)) streams.push(...vidSrc.value);
    if (vidLink.status === "fulfilled" && Array.isArray(vidLink.value)) streams.push(...vidLink.value);
    
    return streams;
  }
};
