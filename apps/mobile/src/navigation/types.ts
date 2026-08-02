import type { Character, ChatMode } from '../types';

export type RouteName = 'login' | 'home' | 'characters' | 'chat' | 'members';

export interface RouteParamsMap {
  login: undefined;
  home: undefined;
  characters: { mode: ChatMode };
  chat: { mode: ChatMode; conversationId?: string; characters: Character[] };
  members: { from?: 'home' | 'characters' | 'chat' } | undefined;
}

export interface Route<T extends RouteName = RouteName> {
  key: string;
  name: T;
  params: RouteParamsMap[T];
}

export interface NavigationState {
  stack: Route[];
}

export type NavAction =
  | { type: 'PUSH'; route: Route }
  | { type: 'POP' }
  | { type: 'REPLACE'; route: Route }
  | { type: 'RESET'; route: Route };
