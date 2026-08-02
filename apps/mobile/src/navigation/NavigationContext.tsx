import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { BackHandler } from 'react-native';
import type { Route, RouteName, RouteParamsMap } from './types';

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `route_${keyCounter}`;
}

interface NavigationContextValue {
  stack: Route[];
  current: Route;
  canGoBack: boolean;
  push: <T extends RouteName>(name: T, params: RouteParamsMap[T]) => void;
  replace: <T extends RouteName>(name: T, params: RouteParamsMap[T]) => void;
  pop: () => void;
  reset: <T extends RouteName>(name: T, params: RouteParamsMap[T]) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

type NavState = { stack: Route[] };

type NavAction =
  | { type: 'PUSH'; route: Route }
  | { type: 'POP' }
  | { type: 'REPLACE'; route: Route }
  | { type: 'RESET'; route: Route };

function reducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'PUSH':
      return { stack: [...state.stack, action.route] };
    case 'POP': {
      if (state.stack.length <= 1) return state;
      return { stack: state.stack.slice(0, -1) };
    }
    case 'REPLACE':
      return { stack: [...state.stack.slice(0, -1), action.route] };
    case 'RESET':
      return { stack: [action.route] };
    default:
      return state;
  }
}

const HOME_ROUTE: Route = { key: nextKey(), name: 'home', params: undefined };

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ stack: [HOME_ROUTE] }));
  const current = state.stack[state.stack.length - 1] ?? HOME_ROUTE;
  const stackRef = useRef(state.stack);
  stackRef.current = state.stack;

  const push = useCallback(<T extends RouteName>(name: T, params: RouteParamsMap[T]) => {
    dispatch({ type: 'PUSH', route: { key: nextKey(), name, params } });
  }, []);

  const replace = useCallback(<T extends RouteName>(name: T, params: RouteParamsMap[T]) => {
    dispatch({ type: 'REPLACE', route: { key: nextKey(), name, params } });
  }, []);

  const pop = useCallback(() => dispatch({ type: 'POP' }), []);

  const reset = useCallback(<T extends RouteName>(name: T, params: RouteParamsMap[T]) => {
    dispatch({ type: 'RESET', route: { key: nextKey(), name, params } });
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stackRef.current.length > 1) {
        dispatch({ type: 'POP' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      stack: state.stack,
      current,
      canGoBack: state.stack.length > 1,
      push,
      replace,
      pop,
      reset,
    }),
    [state.stack, current, push, replace, pop, reset],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation 必须在 <NavigationProvider> 内使用');
  return ctx;
}
