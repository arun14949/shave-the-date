const VIDEO_ID = 'uIYFObB-yv0';

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
    remove(index) {
      deck = deck.filter(song => song !== index);
    },
  };
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
  const shuffle = createShuffleBag(SONGS.length);
  const history = [];
  const rows = [];
  let player;
  let ready = false;
  let started = false;
  let playing = false;
  let selected = 0;
  let open = false;
  let hasPlayed = false;
  let seekHoldUntil = 0;

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

  function setOpen(next) {
    open = next;
    if (open && started && ready && !playing) {
      if (!hasPlayed) player.seekTo(SONGS[selected][1], true);
      hasPlayed = true;
      player.playVideo();
    }
    updatePlay();
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

  function updatePlay() {
    play.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    card.classList.toggle('is-playing', playing);
    toggle.classList.toggle('is-playing', playing);
    syncSheet();
  }

  function jump(index, remember = true) {
    if (remember && started && index !== selected) history.push(selected);
    showSong(index);
    seekHoldUntil = performance.now() + 1600;
    if (!ready) return;
    if (started) {
      hasPlayed = true;
    }
    player.seekTo(SONGS[selected][1], true);
    if (started) player.playVideo();
  }

  function nextRandom() {
    jump(shuffle.next(selected));
  }

  function bootPlayer() {
    if (!window.YT?.Player) return;
    player = new window.YT.Player('youtube-player', {
      width: '1', height: '1', videoId: VIDEO_ID,
      playerVars: { playsinline: 1, controls: 0, rel: 0, origin: location.origin },
      events: {
        onReady(event) {
          ready = true;
          event.target.setVolume(18);
          if (started) {
            hasPlayed = true;
            event.target.seekTo(SONGS[selected][1], true);
            event.target.playVideo();
          }
        },
        onStateChange(event) {
          if (event.data === window.YT.PlayerState.PLAYING) {
            playing = true;
          }
          if (event.data === window.YT.PlayerState.PAUSED) {
            playing = false;
          }
          updatePlay();
          if (event.data === window.YT.PlayerState.ENDED) nextRandom();
        },
        onError() {
          playing = false;
          updatePlay();
          title.textContent = 'Music unavailable right now';
        },
      },
    });
  }

  const oldReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { oldReady?.(); bootPlayer(); };
  if (window.YT?.Player) bootPlayer();
  else {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.append(script);
  }

  prev.addEventListener('click', () => {
    if (history.length) jump(history.pop(), false);
  });
  next.addEventListener('click', nextRandom);
  play.addEventListener('click', () => {
    if (!ready) return;
    started = true;
    if (playing) player.pauseVideo();
    else {
      hasPlayed = true;
      player.playVideo();
    }
  });
  setInterval(() => {
    if (!ready || !playing) return;
    const current = player.getCurrentTime();
    if (!Number.isFinite(current) || performance.now() < seekHoldUntil) return;
    const end = SONGS[selected + 1]?.[1] ?? player.getDuration();
    if (Number.isFinite(end) && end > 0 && current >= end - .15) nextRandom();
  }, 350);

  return {
    start() {
      if (started) return;
      started = true;
      showSong(shuffle.next());
      if (ready) {
        hasPlayed = true;
        seekHoldUntil = performance.now() + 1600;
        player.seekTo(SONGS[selected][1], true);
        player.playVideo();
      }
    },
  };
}
