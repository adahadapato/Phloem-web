/**
 * The live connection for order chats (the API's /hubs/chat, SignalR). One connection for the whole site, opened
 * while someone is signed in and a page listens; it reconnects by itself and falls back to long polling where
 * WebSockets are blocked.
 *
 * Pages subscribe with {@link onChatEvent}; the connection opens with the first listener and closes after the last
 * leaves (or on sign-out). Sending goes through the normal API ({@link ./services/chatService}); the only thing sent
 * here is "I'm typing".
 */
import {
  HttpTransportType, HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection,
} from '@microsoft/signalr'
import { freshAccessToken } from './client'
import { apiUrl } from './config'
import type { ChatMessageEvent, ChatReadEvent, ChatTypingEvent } from './contracts/dtos'
import { tokens } from './tokens'

/** What arrives live. */
export type ChatEvent =
  | { type: 'message'; data: ChatMessageEvent }
  | { type: 'read'; data: ChatReadEvent }
  | { type: 'typing'; data: ChatTypingEvent }
  /** The connection came back after a drop: reload, something may have been missed. */
  | { type: 'reconnected' }

type Listener = (event: ChatEvent) => void

const listeners = new Set<Listener>()
let connection: HubConnection | null = null
let starting: Promise<void> | null = null
let stopTimer: ReturnType<typeof setTimeout> | null = null

const emit = (event: ChatEvent) => listeners.forEach((listener) => listener(event))

function build(): HubConnection {
  const hub = new HubConnectionBuilder()
    .withUrl(apiUrl('hubs/chat'), {
      accessTokenFactory: freshAccessToken,
      withCredentials: false,   // the API's CORS allows no cookies; the token is enough
      transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000, 60_000])
    .configureLogging(import.meta.env.DEV ? LogLevel.Warning : LogLevel.None)
    .build()

  hub.on('chatMessage', (data: ChatMessageEvent) => emit({ type: 'message', data }))
  hub.on('chatRead', (data: ChatReadEvent) => emit({ type: 'read', data }))
  hub.on('chatTyping', (data: ChatTypingEvent) => emit({ type: 'typing', data }))
  hub.onreconnected(() => emit({ type: 'reconnected' }))
  // Gave up reconnecting (e.g. a long time offline): try again in a minute while someone still listens
  hub.onclose(() => {
    if (listeners.size > 0 && tokens.accessToken) setTimeout(() => void start(), 60_000)
  })
  return hub
}

async function start(): Promise<void> {
  if (!tokens.canRefresh) return
  connection ??= build()
  if (connection.state !== HubConnectionState.Disconnected) return
  starting ??= connection.start()
    .catch(() => {
      // API not reachable: pages still work (they load on open); try again shortly
      setTimeout(() => { if (listeners.size > 0) void start() }, 15_000)
    })
    .finally(() => { starting = null })
  await starting
}

/** Closes the connection (signing out, or nobody listening). */
export async function stopChatHub(): Promise<void> {
  const current = connection
  connection = null
  if (current) await current.stop().catch(() => undefined)
}

/**
 * Listens for live chat events; opens the connection if needed.
 * @returns A function that stops listening.
 */
export function onChatEvent(listener: Listener): () => void {
  listeners.add(listener)
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
  void start()
  return () => {
    listeners.delete(listener)
    // Pages come and go while moving around: keep the connection a little while before closing it
    if (listeners.size === 0) stopTimer = setTimeout(() => { if (listeners.size === 0) void stopChatHub() }, 30_000)
  }
}

/** Tells the other side I'm typing (at most every 3 seconds; ignored when not connected). */
let lastTyping = 0
export function sendTyping(orderNumber: string): void {
  const now = Date.now()
  if (now - lastTyping < 3_000 || connection?.state !== HubConnectionState.Connected) return
  lastTyping = now
  void connection.invoke('Typing', orderNumber).catch(() => undefined)
}

tokens.onExpired(() => void stopChatHub())
