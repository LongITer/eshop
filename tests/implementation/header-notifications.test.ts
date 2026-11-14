import React from 'react';
import { usePathname } from 'next/navigation';
import { HeaderNotificationsProvider, HeaderNotificationButton } from '../../apps/user-ui/src/shared/components/header-notifications';
import { useHeaderChatController } from '../../apps/user-ui/src/shared/components/header-chat';

jest.mock('react', () => ({ ...jest.requireActual('react'), useState: jest.fn(), useRef: jest.fn(), useEffect: jest.fn(), useLayoutEffect: jest.fn(), useCallback: jest.fn(), useId: () => 'notification-panel', useContext: jest.fn() }));
jest.mock('react-dom', () => ({ createPortal: (children: unknown) => children }));
jest.mock('next/navigation', () => ({ usePathname: jest.fn() }));
jest.mock('next/link', () => ({ __esModule: true, default: 'a' }));
jest.mock('@packages/components/storefront-language', () => ({ useStorefrontText: () => ({ t: (text: string) => text, locale: 'en-US' }) }));
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: jest.fn() }), { virtual: true });
jest.mock('@/hooks/useNotifications', () => ({ useNotifications: jest.fn(), useReadNotifications: jest.fn() }), { virtual: true });
jest.mock('../../apps/user-ui/src/shared/components/header-chat', () => ({
  useHeaderChatController: jest.fn(), headerActionClass: 'header-action', HeaderActionCount: 'action-count',
}));
jest.mock('../../apps/user-ui/src/shared/components/notification-item', () => ({ NotificationItem: 'notification-item' }), { virtual: true });

const useUser = jest.requireMock('@/hooks/useUser').default;
const { useNotifications, useReadNotifications } = jest.requireMock('@/hooks/useNotifications');
const chat = { open: false, close: jest.fn() };

function nodes(tree: any): any[] {
  const result: any[] = [];
  const visit = (node: any) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!React.isValidElement(node)) return;
    result.push(node); visit((node as any).props.children);
  };
  visit(tree); return result;
}
const nodeText = (node: any): string => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(nodeText).join('') : node?.props ? nodeText(node.props.children) : '';

// Exercise component events without a browser: state and refs survive renders,
// while child components stay as elements until explicitly mounted by a test.
function component(renderComponent: () => any) {
  const hooks: any[] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  let tree: any;
  const install = () => {
    (React.useState as jest.Mock).mockImplementation((initial: any) => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], (value: any) => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    });
    (React.useRef as jest.Mock).mockImplementation((initial: any) => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    });
    (React.useEffect as jest.Mock).mockImplementation((effect: () => void, deps?: any[]) => {
      const index = cursor++;
      if (!(index in hooks) || !deps || deps.some((value, i) => !Object.is(value, hooks[index]?.[i]))) {
        hooks[index] = deps; effects.push(effect);
      }
    });
    (React.useLayoutEffect as jest.Mock).mockImplementation(() => {});
    (React.useCallback as jest.Mock).mockImplementation((callback: any) => callback);
  };
  const render = () => {
    install(); cursor = 0; effects = []; tree = renderComponent(); effects.forEach(effect => effect()); return tree;
  };
  render();
  return { render, get tree() { return tree; }, all: () => nodes(tree) };
}

beforeEach(() => {
  jest.clearAllMocks();
  (usePathname as jest.Mock).mockReturnValue('/products');
  useUser.mockReturnValue({ user: { id: 'buyer-one' } });
  (React.useContext as jest.Mock).mockReturnValue(null);
  chat.open = false;
  chat.close.mockReset();
  chat.close.mockImplementation(() => { chat.open = false; });
  (useHeaderChatController as jest.Mock).mockImplementation(() => chat);
  useNotifications.mockReturnValue({ data: { notifications: [], unreadCount: 7, total: 0, totalCount: 0 }, isLoading: false, isError: false, refetch: jest.fn() });
  useReadNotifications.mockReturnValue({ mutate: jest.fn(), isPending: false, isError: false });
});

test('the bell toggles the shared notification dialog without navigating away', () => {
  const toggle = jest.fn();
  (React.useContext as jest.Mock).mockReturnValue({ open: false, panelId: 'notification-panel', toggle });
  const button = HeaderNotificationButton({ userId: 'buyer-one' });
  expect(button.type).toBe('button');
  expect(button.props.href).toBeUndefined();
  expect(button.props['aria-label']).toBe('Notifications: 7 unread');
  expect(button.props['aria-haspopup']).toBe('dialog');
  expect(button.props['aria-expanded']).toBe(false);
  const trigger = {};
  button.props.onClick({ currentTarget: trigger });
  expect(toggle).toHaveBeenCalledWith(trigger);
  expect(useNotifications).toHaveBeenCalledWith('buyer-one', { limit: 1 });
});

test('both header rows control one notification popup and reopening starts fresh', () => {
  const ui = component(() => HeaderNotificationsProvider({ children: React.createElement('header') }));
  const popups = () => ui.all().filter(node => typeof node.type === 'function');
  expect(popups()).toHaveLength(0);
  ui.tree.props.value.toggle({}); ui.render();
  expect(ui.tree.props.value.open).toBe(true);
  expect(popups()).toHaveLength(1);
  expect(popups()[0].props.userId).toBe('buyer-one');
  expect(chat.close).toHaveBeenCalled();
  ui.tree.props.value.toggle({}); ui.render();
  expect(popups()).toHaveLength(0);
  ui.tree.props.value.toggle({}); ui.render();
  expect(popups()).toHaveLength(1);
});

test('account changes, route changes, and opening Message dismiss private notifications', () => {
  const ui = component(() => HeaderNotificationsProvider({ children: null }));
  const open = () => { ui.tree.props.value.toggle({}); ui.render(); };
  const visible = () => ui.all().some(node => typeof node.type === 'function');
  open(); expect(visible()).toBe(true);
  useUser.mockReturnValue({ user: { id: 'buyer-two' } }); ui.render();
  expect(visible()).toBe(false);
  open(); expect(visible()).toBe(true);
  (usePathname as jest.Mock).mockReturnValue('/cart'); ui.render();
  expect(visible()).toBe(false);
  open(); expect(visible()).toBe(true);
  chat.open = true; ui.render();
  expect(visible()).toBe(false);
  chat.open = false; ui.render();
  expect(visible()).toBe(false);
  open();
  useUser.mockReturnValue({ user: null }); ui.render();
  expect(visible()).toBe(false);
});

test('a bell without the storefront provider still links to the notification center', () => {
  const button = HeaderNotificationButton({ userId: 'buyer-one' });
  expect(button.type).toBe('a');
  expect(button.props.href).toBe('/notifications');
});

test('clicking the bell while Message is open closes chat and keeps the newly opened notification panel', () => {
  chat.open = true;
  const ui = component(() => HeaderNotificationsProvider({ children: null }));
  ui.tree.props.value.toggle({}); ui.render();
  expect(chat.close).toHaveBeenCalledTimes(1);
  expect(chat.open).toBe(false);
  expect(ui.tree.props.value.open).toBe(true);
  ui.render();
  expect(ui.tree.props.value.open).toBe(true);
});

test('closing notification preview leaves shopping in place and view all is explicit', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: {} } });
  try {
    const provider = component(() => HeaderNotificationsProvider({ children: null }));
    const focus = jest.fn();
    provider.tree.props.value.toggle({ isConnected: true, focus }); provider.render();
    const element = provider.all().find(node => typeof node.type === 'function');
    const popup = component(() => element.type(element.props));
    expect(popup.all().find(node => node.type === 'a' && node.props.href === '/notifications')).toBeDefined();
    popup.all().find(node => node.type === 'button' && node.props['aria-label'] === 'Close notifications').props.onClick();
    provider.render();
    expect(provider.tree.props.value.open).toBe(false);
    expect(provider.all().some(node => typeof node.type === 'function')).toBe(false);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('notification preview supports explicit read actions, refresh, and retry without silently marking entries read', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: {} } });
  const query = {
    data: { notifications: [{ id: 'notice-one', title: 'Order confirmed', isRead: false }], unreadCount: 1, total: 1, totalCount: 1 },
    isLoading: false, isError: false, isFetching: false, refetch: jest.fn(),
  };
  const read = { mutate: jest.fn(), isPending: false, isError: false };
  useNotifications.mockReturnValue(query);
  useReadNotifications.mockReturnValue(read);
  try {
    const provider = component(() => HeaderNotificationsProvider({ children: null }));
    provider.tree.props.value.toggle({}); provider.render();
    const element = provider.all().find(node => typeof node.type === 'function');
    const popup = component(() => element.type(element.props));
    const row = () => popup.all().find(node => node.type === 'notification-item');
    expect(useNotifications).toHaveBeenLastCalledWith('buyer-one', { limit: 6 });
    expect(useReadNotifications).toHaveBeenLastCalledWith('buyer-one');
    expect(read.mutate).not.toHaveBeenCalled();
    row().props.onRead('notice-one');
    expect(read.mutate).toHaveBeenLastCalledWith('notice-one');
    popup.all().find(node => node.type === 'button' && nodeText(node) === 'Mark all as read').props.onClick();
    expect(read.mutate).toHaveBeenLastCalledWith(undefined);

    read.isPending = true; popup.render();
    expect(row().props.reading).toBe(true);
    expect(popup.all().find(node => node.type === 'button' && nodeText(node) === 'Mark all as read').props.disabled).toBe(true);
    read.isPending = false; read.isError = true; popup.render();
    expect(popup.all().some(node => node.props.role === 'alert' && nodeText(node).includes('Could not update notifications.'))).toBe(true);

    popup.all().find(node => node.props['aria-label'] === 'Refresh notifications').props.onClick();
    expect(query.refetch).toHaveBeenCalledTimes(1);
    query.isError = true; popup.render();
    expect(popup.all().some(node => node.props.role === 'alert' && nodeText(node).includes('Unable to load notifications.'))).toBe(true);
    popup.all().find(node => node.type === 'button' && nodeText(node) === 'Retry').props.onClick();
    expect(query.refetch).toHaveBeenCalledTimes(2);
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
