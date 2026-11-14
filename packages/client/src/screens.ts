import {
  NAME_MAX_LENGTH,
  PROTOCOL_VERSION,
  ROOM_CODE_LENGTH,
  type ClientMessage,
  type ServerMessage,
  type Slot,
  getMiniGame,
  listMiniGameIds,
} from '@monkey-mania-2/shared';
import { loadSaved, save, type Connection } from './connection';
import { ASSET_BASE, monkeyColor } from './assets/manifest';

type RoomState = Extract<ServerMessage, { type: 'roomState' }>;
type RoundResult = Extract<ServerMessage, { type: 'roundResult' }>;
type MatchResult = Extract<ServerMessage, { type: 'matchResult' }>;

const pts = (n: number): string => `${n} ${n === 1 ? 'pt' : 'pts'}`;

const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A short fade to black and back, used when the menus and the canvas swap places. */
function pulseFade(): void {
  const fade = document.getElementById('fade');
  if (!fade || reducedMotion()) return;
  fade.classList.add('on');
  setTimeout(() => fade.classList.remove('on'), 200);
}

function badge(slot: Slot): HTMLImageElement {
  return el('img', {
    src: `${ASSET_BASE}ui/seat_badge_${monkeyColor(slot)}.png`,
    alt: `P${slot + 1}`,
  });
}

const ORDINALS = ['1st', '2nd', '3rd', '4th'];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/** Plain DOM menus over the game canvas: Home, Lobby, and a disconnected state. */
export class Screens {
  private slot: Slot | null = null;
  private room: RoomState | null = null;
  private error = '';
  private roundResult: RoundResult | null = null;
  private matchResult: MatchResult | null = null;
  private readonly inviteCode: string;
  /** Which pre-room screen is up. An invite link skips the start menu. */
  private view: 'start' | 'howto' | 'home' = 'start';

  constructor(
    private readonly root: HTMLElement,
    private readonly conn: Connection,
  ) {
    this.inviteCode = (new URLSearchParams(location.search).get('room') ?? '')
      .toUpperCase()
      .slice(0, ROOM_CODE_LENGTH);
    if (this.inviteCode) this.view = 'home';
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.room && this.view !== 'start') this.go('start');
      else this.root.classList.add('skip');
    });
    this.conn.on('joined', (m) => {
      this.slot = m.slot;
      save('rejoinToken', m.rejoinToken);
      this.error = '';
    });
    this.conn.on('roundResult', (m) => {
      this.roundResult = m;
      this.render();
    });
    this.conn.on('matchResult', (m) => {
      this.matchResult = m;
      this.render();
    });
    this.conn.on('roundIntro', (m) => {
      if (m.round === 1) this.matchResult = null;
      this.roundResult = null;
    });
    this.conn.on('roomState', (m) => {
      this.room = m;
      if (m.phase === 'LOBBY') this.roundResult = this.matchResult = null;
      history.replaceState(null, '', `/?room=${m.code}`);
      this.render();
    });
    this.conn.on('error', (m) => {
      this.error = m.message;
      this.render();
    });
    this.conn.on('status', (s) => {
      if (s === 'closed' && this.room) this.render();
    });
    this.render();
  }

  private connectAndSend(message: ClientMessage): void {
    this.error = '';
    if (this.conn.status === 'open') {
      this.conn.send(message);
      return;
    }
    this.error = 'Connecting…';
    this.render();
    void this.conn.connect().then((ok) => {
      if (ok) {
        this.error = '';
        this.conn.send(message);
      } else {
        this.error = 'Could not reach the server.';
        this.render();
      }
    });
  }

  private leave(): void {
    this.conn.send({ type: 'leave' });
    this.conn.close();
    this.room = null;
    this.slot = null;
    this.error = '';
    this.view = 'start';
    history.replaceState(null, '', '/');
    this.render();
  }

  private go(view: 'start' | 'howto' | 'home'): void {
    this.view = view;
    this.error = '';
    this.render();
  }

  private render(): void {
    // During a round the canvas is the screen; menus come back for results and the podium.
    const playing =
      this.conn.status === 'open' &&
      (this.room?.phase === 'INTRO' || this.room?.phase === 'PLAYING');
    if (playing !== this.root.hidden) pulseFade();
    this.root.hidden = playing;
    if (playing) {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    this.root.replaceChildren(
      this.room
        ? this.conn.status === 'closed'
          ? this.disconnected()
          : this.room.phase === 'RESULTS'
            ? this.results(this.room)
            : this.room.phase === 'PODIUM'
              ? this.podium(this.room)
              : this.lobby(this.room)
        : this.view === 'start'
          ? this.start()
          : this.view === 'howto'
            ? this.howTo()
            : this.home(),
    );
    this.root.classList.toggle('title', !this.room && this.view === 'start');
    const focus = this.root.querySelector<HTMLElement>('[autofocus]');
    focus?.focus();
  }

  private errorLine(): HTMLElement {
    return el('p', { className: 'error', textContent: this.error, role: 'alert' });
  }

  private start(): HTMLElement {
    const item = (text: string, onClick?: () => void): HTMLButtonElement => {
      const b = el('button', { type: 'button', textContent: text });
      if (onClick) b.onclick = onClick;
      else b.disabled = true; // Settings arrives with T17.
      return b;
    };
    const buttons = [
      item('Play', () => this.go('home')),
      item('How to Play', () => this.go('howto')),
      item('Settings'),
    ];
    buttons[0]?.setAttribute('autofocus', '');
    const menu = el('nav', { className: 'menu' }, ...buttons);
    menu.onkeydown = (e) => {
      const enabled = buttons.filter((b) => !b.disabled);
      const i = enabled.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      enabled[(i + step + enabled.length) % enabled.length]?.focus();
    };
    return el(
      'main',
      { className: 'start' },
      el('h1', { className: 'logo', textContent: 'Monkey Mania II:' }),
      el('p', { className: 'tagline', textContent: 'Primate Party' }),
      menu,
    );
  }

  private howTo(): HTMLElement {
    const back = el('button', { type: 'button', textContent: 'Back' });
    back.onclick = () => this.go('start');
    back.setAttribute('autofocus', '');
    const games = listMiniGameIds()
      .filter((id) => id !== 'sandbox')
      .map((id) => getMiniGame(id))
      .map((g) =>
        g ? el('li', {}, el('b', { textContent: `${g.displayName}: ` }), g.controlsHint) : '',
      );
    return el(
      'main',
      { className: 'screen' },
      el('h1', { textContent: 'How to Play' }),
      el('p', { textContent: 'Move: WASD or arrow keys (touch stick). Action: Space (tap).' }),
      el('ul', { className: 'howto' }, ...games),
      el('div', { className: 'row' }, back),
    );
  }

  private home(): HTMLElement {
    const name = el('input', {
      id: 'name',
      maxLength: NAME_MAX_LENGTH,
      value: loadSaved('name'),
      placeholder: 'Monkey name',
      autocomplete: 'off',
    });
    const code = el('input', {
      id: 'code',
      maxLength: ROOM_CODE_LENGTH,
      value: this.inviteCode,
      placeholder: 'ABCD',
      autocomplete: 'off',
    });
    const playerName = (): string => {
      const v = name.value.trim();
      if (v) save('name', v);
      return v;
    };
    const back = el('button', { type: 'button', textContent: 'Back' });
    back.onclick = () => this.go('start');
    const create = el('button', { type: 'button', textContent: 'Create Room' });
    const join = el('button', { type: 'button', textContent: 'Join Room' });
    create.onclick = () => {
      const n = playerName();
      if (!n) return this.fail('Enter a name first.', name);
      this.connectAndSend({ type: 'createRoom', v: PROTOCOL_VERSION, name: n });
    };
    join.onclick = () => {
      const n = playerName();
      const c = code.value.trim().toUpperCase();
      if (!n) return this.fail('Enter a name first.', name);
      if (c.length !== ROOM_CODE_LENGTH) return this.fail('Room codes have 4 letters.', code);
      const rejoinToken = loadSaved('rejoinToken');
      this.connectAndSend({
        type: 'joinRoom',
        v: PROTOCOL_VERSION,
        code: c,
        name: n,
        ...(rejoinToken ? { rejoinToken } : {}),
      });
    };
    const form = el(
      'form',
      {},
      el('label', { htmlFor: 'name', textContent: 'Your name' }),
      name,
      el('div', { className: 'row' }, create),
      el('label', {
        htmlFor: 'code',
        textContent: this.inviteCode ? `Joining room ${this.inviteCode}` : 'Room code',
      }),
      code,
      el('div', { className: 'row' }, join, back),
      this.errorLine(),
    );
    form.onsubmit = (e) => {
      e.preventDefault();
      (this.inviteCode || code.value ? join : create).click();
    };
    (name.value ? (this.inviteCode ? join : name) : name).setAttribute('autofocus', '');
    return el('main', { className: 'screen' }, el('h1', { textContent: 'Monkey Mania II' }), form);
  }

  private fail(message: string, field: HTMLElement): void {
    this.error = message;
    this.render();
    this.root.querySelector<HTMLElement>(`#${field.id}`)?.focus();
  }

  private lobby(room: RoomState): HTMLElement {
    const me = this.slot;
    const isHost = me === room.host;
    const seats = el('ul', { className: 'seats' });
    room.seats.forEach((seat, i) => {
      const status = !seat
        ? ''
        : seat.isBot
          ? '✔ READY'
          : !seat.connected
            ? '✖ AWAY'
            : seat.ready
              ? '✔ READY'
              : '… waiting';
      const label = !seat
        ? 'Empty (a bot will fill in)'
        : `${seat.name}${seat.isBot ? ' (bot)' : ''}${i === room.host ? ' ★' : ''}${i === me ? ' (you)' : ''}`;
      seats.append(
        el(
          'li',
          { className: `${seat?.ready || seat?.isBot ? 'ready' : ''}${i === me ? ' me' : ''}` },
          badge(i),
          el('span', { className: 'grow', textContent: label }),
          el('span', { textContent: status }),
        ),
      );
    });

    const mySeat = me === null ? null : room.seats[me];
    const ready = el('button', {
      type: 'button',
      textContent: mySeat?.ready ? 'Not ready' : 'Ready',
    });
    ready.setAttribute('aria-pressed', String(!!mySeat?.ready));
    ready.onclick = () => this.conn.send({ type: 'setReady', ready: !mySeat?.ready });

    const invite = `${location.origin}/?room=${room.code}`;
    const copy = el('button', { type: 'button', textContent: 'Copy invite link' });
    copy.onclick = () => {
      navigator.clipboard.writeText(invite).then(
        () => ((copy.textContent = 'Copied!'), undefined),
        () => ((copy.textContent = invite), undefined),
      );
    };

    const leave = el('button', { type: 'button', textContent: 'Leave' });
    leave.onclick = () => this.leave();

    const actions = el('div', { className: 'row' }, ready, copy);
    if (isHost) {
      const start = el('button', { type: 'button', textContent: 'Start' });
      start.onclick = () => this.conn.send({ type: 'startMatch' });
      actions.append(start);
    }
    actions.append(leave);

    ready.setAttribute('autofocus', '');
    return el(
      'main',
      { className: 'screen' },
      el('h1', { textContent: `Room ${room.code}` }),
      seats,
      actions,
      el('p', {
        textContent: isHost
          ? 'You are the host. Start when everyone is ready.'
          : 'Waiting for the host to start.',
      }),
      this.errorLine(),
    );
  }

  private seatName(room: RoomState, slot: Slot): string {
    const seat = room.seats[slot];
    return `${seat?.name ?? `Player ${slot + 1}`}${slot === this.slot ? ' (you)' : ''}`;
  }

  /** One row per placement group: "1st  Name  +3  (total 7)". Ties share a place. */
  private standingsList(
    room: RoomState,
    placements: Slot[][],
    scores: { slot: Slot; points: number; total: number }[],
    showPoints: boolean,
  ): HTMLElement {
    const list = el('ol', { className: 'seats standings' });
    let place = 0;
    for (const group of placements) {
      for (const slot of group) {
        const s = scores.find((x) => x.slot === slot);
        const total = el('span', { textContent: pts(s?.total ?? 0) });
        const row = el(
          'li',
          { className: `${place === 0 ? 'ready' : ''}${slot === this.slot ? ' me' : ''}` },
          el('span', { className: 'place', textContent: ORDINALS[place] ?? `${place + 1}th` }),
          badge(slot),
          el('span', { className: 'grow', textContent: this.seatName(room, slot) }),
        );
        if (showPoints && s && s.points > 0) {
          row.append(el('span', { className: 'gain', textContent: `+${s.points}` }));
          this.countUp(total, s.total - s.points, s.total);
        }
        row.append(total);
        list.append(row);
      }
      place += group.length;
    }
    return list;
  }

  /** Counts a total up to its new value so the point gain is visible. */
  private countUp(node: HTMLElement, from: number, to: number): void {
    if (reducedMotion()) return;
    let v = from;
    node.textContent = pts(v);
    const timer = setInterval(() => {
      v++;
      node.textContent = pts(v);
      if (v >= to || !node.isConnected) clearInterval(timer);
    }, 350);
  }

  private results(room: RoomState): HTMLElement {
    const r = this.roundResult;
    const body = r
      ? this.standingsList(room, r.placements, r.scores, true)
      : el('p', { textContent: 'Round over.' });
    return el(
      'main',
      { className: 'screen' },
      el('h1', { textContent: r ? `Round ${r.round} results` : 'Round over' }),
      body,
      el('p', { textContent: 'Next round starting…' }),
    );
  }

  private podium(room: RoomState): HTMLElement {
    const m = this.matchResult;
    const rematch = el('button', { type: 'button', textContent: 'Rematch' });
    rematch.onclick = () => this.conn.send({ type: 'rematch' });
    rematch.setAttribute('autofocus', '');
    const leave = el('button', { type: 'button', textContent: 'Leave' });
    leave.onclick = () => this.leave();
    const winners = m?.placements[0] ?? [];
    return el(
      'main',
      { className: 'screen' },
      m ? el('img', { className: 'crown', src: `${ASSET_BASE}ui/crown.png`, alt: '' }) : el('span'),
      el('h1', { textContent: 'Podium' }),
      m
        ? el('p', {
            textContent:
              winners.length > 1
                ? `Tie: ${winners.map((s) => this.seatName(room, s)).join(' and ')}!`
                : `${winners[0] === undefined ? '' : this.seatName(room, winners[0])} wins!`,
          })
        : el('p', { textContent: 'The match ended early.' }),
      m ? this.standingsList(room, m.placements, m.totals, false) : el('span'),
      el('div', { className: 'row' }, rematch, leave),
      this.errorLine(),
    );
  }

  private disconnected(): HTMLElement {
    const retry = el('button', { type: 'button', textContent: 'Back to menu' });
    retry.onclick = () => this.leave();
    retry.setAttribute('autofocus', '');
    return el(
      'main',
      { className: 'screen' },
      el('h1', { textContent: 'Disconnected' }),
      el('p', { textContent: 'Lost connection to the server.' }),
      retry,
    );
  }
}
