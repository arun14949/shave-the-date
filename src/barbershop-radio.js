export const SONGS = [
  ['Mujhse Mohabbat Ka', 0],
  ['Dil Deta Hai Ro Ro Duhai - Pankaj', 308],
  ['Aaye Ho Meri Zindagi Mein - Male', 804],
  ['Sona Kitna Sona Hai', 1163],
  ['Aapke Pyaar Mein Hum', 1451],
  ['Aayiye Aapka Intezaar Tha', 1776],
  ['Channe Ke Khet Mein', 2248],
  ['Tere Dar Par Sanam - Male', 2605],
  ['Jo Bhi Kasmein', 2967],
  ['Pardesi Pardesi', 3302],
  ['Utha Le Jaoonga', 3745],
  ['Tumse Milne Ko Dil', 4040],
  ['Chamma Chamma Baaje Re', 4336],
  ['College Ki Ladkiyon', 4688],
  ['Aake Teri Baahon Mein', 5032],
  ['Kisi Din Banoongi Main', 5437],
  ['Ghoonghat Ki Aadh Se', 5871],
  ['Main Agar Saamne', 6243],
  ['Phoolon Sa Chehra Tera', 6584],
  ['Phool Maangu Na Bahaar Maangu', 6987],
];

export function songIndexAt(seconds) {
  for (let index = SONGS.length - 1; index > 0; index--) {
    if (seconds >= SONGS[index][1]) return index;
  }
  return 0;
}

export function openingTimeAt(index, fraction, mixDuration = 0) {
  const start = SONGS[index][1];
  const nextStart = SONGS[index + 1]?.[1];
  const end = nextStart ?? (mixDuration > start ? mixDuration : start + 240);
  const middle = Math.max(.3, Math.min(.7, fraction));
  return Math.round(start + (end - start) * middle);
}

export function createShuffleBag(count, random = Math.random) {
  let deck = [];
  return {
    next(current = -1) {
      if (!deck.length) {
        deck = Array.from({ length: count }, (_, index) => index);
        for (let index = deck.length - 1; index > 0; index--) {
          const swap = Math.floor(random() * (index + 1));
          [deck[index], deck[swap]] = [deck[swap], deck[index]];
        }
      }
      if (deck.length > 1 && deck.at(-1) === current) {
        const swap = Math.floor(random() * (deck.length - 1));
        [deck[swap], deck[deck.length - 1]] = [deck[deck.length - 1], deck[swap]];
      }
      return deck.pop();
    },
    remove(index) { deck = deck.filter(song => song !== index); },
  };
}

export function songAudioUrl(index, half = 0) {
  return `/assets/music/song-${String(index).padStart(2, '0')}-${half ? 'b' : 'a'}.json`;
}

export function createBarbershopRadio() {
  const card = document.querySelector('#barbershop-radio');
  const toggle = document.querySelector('#music-toggle');
  const close = document.querySelector('#radio-close');
  const backdrop = document.querySelector('#radio-backdrop');
  const title = document.querySelector('#song-title');
  const list = document.querySelector('#song-list');
  const play = document.querySelector('#song-play');
  const prev = document.querySelector('#song-prev');
  const next = document.querySelector('#song-next');
  const audio = document.querySelector('#barbershop-audio');
  const shuffle = createShuffleBag(SONGS.length);
  const history = [];
  const rows = [];
  let started = false;
  let selected = 0;
  let currentHalf = 0;
  let open = false;
  let loadId = 0;
  const sources = new Map();
  const openingIndex = shuffle.next();

  function getSource(index, half) {
    const url = songAudioUrl(index, half);
    if (!sources.has(url)) {
      const entry = { src: null, promise: null };
      entry.promise = fetch(url).then(response => {
        if (!response.ok) throw new Error(`Song unavailable: ${response.status}`);
        return response.json();
      }).then(data => {
        if (typeof data.src !== 'string' || !data.src.startsWith('data:audio/mp4;base64,')) {
          throw new Error('Invalid song data');
        }
        entry.src = data.src;
        return entry.src;
      }).catch(error => {
        sources.delete(url);
        throw error;
      });
      sources.set(url, entry);
    }
    return sources.get(url);
  }

  const openingReady = getSource(openingIndex, 1).promise.catch(() => null);

  for (let index = 0; index < SONGS.length; index++) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'song-row';
    const number = document.createElement('span');
    number.className = 'song-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('span');
    label.className = 'song-label';
    label.textContent = SONGS[index][0];
    row.append(number, label);
    row.addEventListener('click', () => {
      started = true;
      shuffle.remove(index);
      jump(index);
    });
    list.append(row);
    rows.push(row);
  }

  function showSong(index) {
    const nextIndex = Math.max(0, Math.min(SONGS.length - 1, index));
    const changed = nextIndex !== selected;
    selected = nextIndex;
    title.textContent = SONGS[selected][0];
    for (let i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('is-active', i === selected);
      if (i === selected) rows[i].setAttribute('aria-current', 'true');
      else rows[i].removeAttribute('aria-current');
    }
    if (changed && open) rows[selected].scrollIntoView({ block: 'nearest' });
  }

  function syncSheet() {
    card.classList.toggle('is-open', open);
    card.setAttribute('aria-hidden', String(!open));
    if (open) {
      card.removeAttribute('inert');
      card.setAttribute('aria-modal', 'true');
    } else {
      card.setAttribute('inert', '');
      card.removeAttribute('aria-modal');
    }
    backdrop.hidden = !open;
    document.body.classList.toggle('radio-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close music' : 'Open music');
  }

  function setOpen(nextOpen) {
    open = nextOpen;
    syncSheet();
    if (open) close.focus();
    else toggle.focus();
  }

  toggle.addEventListener('click', () => setOpen(!open));
  close.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (open && event.key === 'Escape') setOpen(false);
  });
  showSong(0);
  syncSheet();

  function updatePlay() {
    const playing = !audio.paused && !audio.ended;
    play.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    card.classList.toggle('is-playing', playing);
    toggle.classList.toggle('is-playing', playing);
  }

  function playAudio() {
    const attempt = audio.play();
    attempt?.catch(() => updatePlay());
  }

  function loadSong(index, half = 0) {
    showSong(index);
    currentHalf = half;
    const currentLoad = ++loadId;
    const entry = getSource(selected, half);
    const begin = src => {
      if (currentLoad !== loadId) return;
      audio.src = src;
      audio.load();
      playAudio();
      if (half === 0) getSource(index, 1).promise.catch(() => null);
    };
    if (entry.src) begin(entry.src);
    else {
      audio.pause();
      entry.promise.then(begin).catch(() => {
        if (currentLoad === loadId) title.textContent = 'Music unavailable right now';
      });
    }
  }

  function jump(index, remember = true) {
    if (remember && started && index !== selected) history.push(selected);
    started = true;
    loadSong(index);
  }

  function nextRandom() { jump(shuffle.next(selected)); }

  audio.addEventListener('play', updatePlay);
  audio.addEventListener('pause', updatePlay);
  audio.addEventListener('playing', updatePlay);
  audio.addEventListener('ended', () => {
    if (currentHalf === 0) loadSong(selected, 1);
    else nextRandom();
  });
  audio.addEventListener('error', () => {
    updatePlay();
    title.textContent = 'Music unavailable right now';
  });

  prev.addEventListener('click', () => {
    if (history.length) jump(history.pop(), false);
  });
  next.addEventListener('click', nextRandom);
  play.addEventListener('click', () => {
    if (!started) {
      started = true;
      loadSong(shuffle.next());
    } else if (audio.paused) playAudio();
    else audio.pause();
  });

  return {
    ready() { return openingReady; },
    start() {
      if (started) return;
      started = true;
      loadSong(openingIndex, 1);
    },
  };
}
