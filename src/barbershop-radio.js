const VIDEO_ID = 'uIYFObB-yv0';
const ORIGINAL_TRACKS = [
  ['Barbershop Groove', '/assets/music/barbershop-groove.mp3'],
  ['Wedding Morning', '/assets/music/wedding-morning.mp3'],
  ['Clipper Swing', '/assets/music/clipper-swing.mp3'],
];

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

export function openingTimeAt(index, fraction, videoDuration = 0) {
  const start = SONGS[index][1];
  const nextStart = SONGS[index + 1]?.[1];
  const end = nextStart ?? (videoDuration > start ? videoDuration : start + 240);
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
  const playerHost = document.querySelector('#youtube-player');
  const listHeading = document.querySelector('.radio-list-heading');
  const shuffle = createShuffleBag(SONGS.length);
  const originalShuffle = createShuffleBag(ORIGINAL_TRACKS.length);
  const history = [];
  const originalHistory = [];
  const rows = [];
  const originalRows = [];
  const originalAudio = new Audio();
  originalAudio.id = 'original-radio-audio';
  originalAudio.hidden = true;
  originalAudio.preload = 'auto';
  originalAudio.volume = .7;
  document.body.append(originalAudio);
  let player;
  let ready = false;
  let started = false;
  let playing = false;
  let selected = 0;
  let open = false;
  let hasPlayed = false;
  let openingFraction = .5;
  let seekHoldUntil = 0;
  let gestureIframe;
  let originalActive = false;
  let originalSelected = Math.floor(Math.random() * ORIGINAL_TRACKS.length);
  let originalStartPending = true;

  originalAudio.src = ORIGINAL_TRACKS[originalSelected][1];
  originalAudio.addEventListener('loadedmetadata', () => {
    if (!originalStartPending) return;
    originalStartPending = false;
    if (Number.isFinite(originalAudio.duration)) {
      originalAudio.currentTime = originalAudio.duration * (.3 + Math.random() * .4);
    }
  });
  originalAudio.addEventListener('play', () => {
    if (!originalActive) return;
    playing = true;
    updatePlay();
  });
  originalAudio.addEventListener('pause', () => {
    if (!originalActive) return;
    playing = false;
    updatePlay();
  });
  originalAudio.addEventListener('ended', () => {
    if (originalActive) jumpOriginal(originalShuffle.next(originalSelected));
  });

  function showOriginal(index) {
    originalSelected = index;
    title.textContent = ORIGINAL_TRACKS[index][0];
    for (let i = 0; i < originalRows.length; i++) {
      originalRows[i].classList.toggle('is-active', i === index);
      if (i === index) originalRows[i].setAttribute('aria-current', 'true');
      else originalRows[i].removeAttribute('aria-current');
    }
  }

  function activateOriginal() {
    if (!originalActive) {
      originalActive = true;
      list.replaceChildren(...originalRows);
      listHeading.children[0].textContent = 'Original barbershop songs';
      listHeading.children[1].textContent = `${ORIGINAL_TRACKS.length} tracks · Shuffle on`;
    }
    showOriginal(originalSelected);
    if (originalAudio.paused) originalAudio.play().catch(() => {
      playing = false;
      updatePlay();
    });
  }

  function jumpOriginal(index, remember = true) {
    if (remember && index !== originalSelected) originalHistory.push(originalSelected);
    showOriginal(index);
    originalAudio.src = ORIGINAL_TRACKS[index][1];
    originalStartPending = false;
    originalAudio.play().catch(() => {
      playing = false;
      updatePlay();
    });
  }

  for (let index = 0; index < ORIGINAL_TRACKS.length; index++) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'song-row';
    const number = document.createElement('span');
    number.className = 'song-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('span');
    label.className = 'song-label';
    label.textContent = ORIGINAL_TRACKS[index][0];
    row.append(number, label);
    row.addEventListener('click', () => jumpOriginal(index));
    originalRows.push(row);
  }

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
    if (open && started && ready && !playing && !originalActive) {
      if (!hasPlayed) player.seekTo(openingTimeAt(selected, openingFraction, player.getDuration()), true);
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

  function startIframeFromGesture() {
    // The IFrame API can arrive after the entry tap. Create an autoplay embed
    // during that tap so the browser can associate playback with its gesture.
    const time = openingTimeAt(selected, openingFraction);
    const frame = document.createElement('iframe');
    frame.id = 'youtube-player-frame';
    frame.title = 'Barbershop music';
    frame.width = '1';
    frame.height = '1';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.src = `https://www.youtube.com/embed/${VIDEO_ID}?enablejsapi=1&autoplay=1&start=${time}&playsinline=1&controls=0&rel=0&origin=${encodeURIComponent(location.origin)}`;
    playerHost.replaceChildren(frame);
    gestureIframe = frame;
    hasPlayed = true;
  }

  function bootPlayer() {
    if (!window.YT?.Player || player) return;
    player = new window.YT.Player(gestureIframe || 'youtube-player', {
      width: '1', height: '1', ...(gestureIframe ? {} : { videoId: VIDEO_ID }),
      playerVars: { playsinline: 1, controls: 0, rel: 0, origin: location.origin },
      events: {
        onReady(event) {
          ready = true;
          event.target.setVolume(65);
          if (started) {
            if (!hasPlayed) {
              event.target.seekTo(openingTimeAt(selected, openingFraction, event.target.getDuration()), true);
              hasPlayed = true;
            }
            event.target.playVideo();
          }
        },
        onStateChange(event) {
          if (event.data === window.YT.PlayerState.PLAYING) {
            originalActive = false;
            originalAudio.pause();
            list.replaceChildren(...rows);
            listHeading.children[0].textContent = 'Songs in this mix';
            listHeading.children[1].textContent = `${SONGS.length} tracks · Shuffle on`;
            showSong(selected);
            playing = true;
          }
          if (event.data === window.YT.PlayerState.PAUSED && !originalActive) {
            playing = false;
          }
          updatePlay();
          if (event.data === window.YT.PlayerState.ENDED && !originalActive) nextRandom();
        },
        onError(event) {
          console.warn('Barbershop radio playback error', event.data);
          activateOriginal();
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
    if (originalActive) {
      if (originalHistory.length) jumpOriginal(originalHistory.pop(), false);
      return;
    }
    if (history.length) jump(history.pop(), false);
  });
  next.addEventListener('click', () => {
    if (originalActive) jumpOriginal(originalShuffle.next(originalSelected));
    else nextRandom();
  });
  play.addEventListener('click', () => {
    if (originalActive) {
      if (originalAudio.paused) originalAudio.play();
      else originalAudio.pause();
      return;
    }
    if (!ready) return;
    started = true;
    if (playing) player.pauseVideo();
    else {
      hasPlayed = true;
      player.playVideo();
    }
  });
  setInterval(() => {
    if (!ready || !playing || originalActive) return;
    const current = player.getCurrentTime();
    if (!Number.isFinite(current) || performance.now() < seekHoldUntil) return;
    const end = SONGS[selected + 1]?.[1] ?? player.getDuration();
    if (Number.isFinite(end) && end > 0 && current >= end - .15) nextRandom();
  }, 350);

  return {
    start() {
      if (started) return;
      started = true;
      showSong(shuffle.next(0));
      openingFraction = .3 + Math.random() * .4;
      activateOriginal();
      if (ready) {
        hasPlayed = true;
        seekHoldUntil = performance.now() + 1600;
        player.seekTo(openingTimeAt(selected, openingFraction, player.getDuration()), true);
        player.playVideo();
      } else if (!player) startIframeFromGesture();
    },
  };
}
