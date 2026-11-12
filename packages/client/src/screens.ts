import {
  NAME_MAX_LENGTH,
  PROTOCOL_VERSION,
  ROOM_CODE_LENGTH,
  type ClientMessage,
  type ServerMessage,
  type Slot,
} from '@monkey-mania-2/shared';
import { loadSaved, save, type Connection } from './connection';

type RoomState = Extract<ServerMessage, { type: 'roomState' }>;
type RoundResult = Extract<ServerMessage, { type: 'roundResult' }>;
type MatchResult = Extract<ServerMessage, { type: 'matchResult' }>;

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

  constructor(
    private readonly root: HTMLElement,
    private readonly conn: Connection,
  ) {
    this.inviteCode = (new URLSearchParams(location.search).get('room') ?? '')
      .toUpperCase()
      .slice(0, ROOM_CODE_LENGTH);
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
    history.replaceState(null, '', '/');
    this.render();
  }

  private render(): void {
    // During a round the canvas is the screen; menus come back for results and the podium.
    const playing =
      this.conn.status === 'open' &&
      (this.room?.phase === 'INTRO' || this.room?.phase === 'PLAYING');
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
        : this.home(),
    );
    const focus = this.root.querySelector<HTMLElement>('[autofocus]');
    focus?.focus();
  }

  private errorLine(): HTMLElement {
    return el('p', { className: 'error', textContent: this.error, role: 'alert' });
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
      el('div', { className: 'row' }, join),
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
      const text = !seat
        ? 'Empty (a bot will fill in)'
        : `${seat.name}${seat.isBot ? ' (bot)' : ''}${i === room.host ? ' ★ host' : ''}${i === me ? ' (you)' : ''} — ${
            seat.isBot
              ? 'ready'
              : !seat.connected
                ? 'disconnected'
                : seat.ready
                  ? 'READY'
                  : 'not ready'
          }`;
      seats.append(
        el('li', { className: seat?.ready ? 'ready' : '', textContent: `${i + 1}. ${text}` }),
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
        const gain = showPoints && s ? `  +${s.points}` : '';
        list.append(
          el('li', {
            className: place === 0 ? 'ready' : '',
            textContent: `${ORDINALS[place] ?? `${place + 1}th`}  ${this.seatName(room, slot)}${gain}  —  ${s?.total ?? 0} pts`,
          }),
        );
      }
      place += group.length;
    }
    return list;
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
