import type { Character, ChatMode } from '../types';

export type RouteName = 'login' | 'home' | 'characters' | 'chat' | 'members';

export interface RouteParamsMap {
  login: undefined;
  home: undefined;
  characters: { mode: ChatMode };
  chat: { mode: ChatMode; conversationId?: string; characters: Character[] };
  members: { from?: 'home' | 'characters' | 'chat' } | undefined;
}

/** 以 name 为判别字段的路由联合类型，便于按路由收窄参数 */
export type Route =
  | { key: string; name: 'login'; params: undefined }
  | { key: string; name: 'home'; params: undefined }
  | { key: string; name: 'characters'; params: { mode: ChatMode } }
  | { key: string; name: 'chat'; params: { mode: ChatMode; conversationId?: string; characters: Character[] } }
  | { key: string; name: 'members'; params: { from?: 'home' | 'characters' | 'chat' } | undefined };

export interface NavigationState {
  stack: Route[];
}

export type NavAction =
  | { type: 'PUSH'; route: Route }
  | { type: 'POP' }
  | { type: 'REPLACE'; route: Route }
  | { type: 'RESET'; route: Route };
