import React from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useChatConnection } from '@packages/components/chat';
import { HeaderChatProvider, HeaderMessageButton } from '../../apps/user-ui/src/shared/components/header-chat';
import { NotificationBadge } from '../../apps/user-ui/src/shared/components/account-tools';

jest.mock('react', () => ({ ...jest.requireActual('react'), useState: jest.fn(), useRef: jest.fn(), useEffect: jest.fn(), useLayoutEffect: jest.fn(), useCallback: jest.fn(), useId: () => 'chat-panel', useContext: jest.fn() }));
jest.mock('react-dom', () => ({ createPortal: (children: unknown) => children }));
jest.mock('next/navigation', () => ({ usePathname: jest.fn() }));
jest.mock('next/link', () => ({ __esModule: true, default: 'a' }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), useInfiniteQuery: jest.fn(), useQueryClient: jest.fn(), useMutation: jest.fn() }));
jest.mock('@packages/components/storefront-language', () => ({ useStorefrontText: () => ({ t: (text: string) => text, locale: 'en-US' }) }));
jest.mock('@packages/components/chat', () => ({ useChatConnection: jest.fn(), ChatAttachments: 'chat-attachments', AttachmentPreview: 'attachment-preview', MessageAttachment: 'message-attachment' }));
jest.mock('@/utils/axioInstance', () => ({ __esModule: true, default: { get: jest.fn() } }), { virtual: true });
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: jest.fn() }), { virtual: true });
jest.mock('../../apps/user-ui/src/shared/components/header-notifications', () => ({ HeaderNotificationButton: 'header-notification-button' }));

const useUser = jest.requireMock('@/hooks/useUser').default;
const originalWebSocket = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
const conversation = (id: string, name: string) => ({ conversationId: id, seller: { id: `seller-${id}`, name, avatar: null, isOnline: true }, lastMessage: 'Hello', lastMessageAt: '2026-10-18T03:00:00Z', unreadCount: 2 });
const conversations = [conversation('one', 'First shop'), conversation('two', 'Second shop')];

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

// Follow public component events with persistent state/ref hooks. Child elements
// stay as React elements, so these regressions need no browser renderer or DOM.
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
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: { OPEN: 1 } });
  (usePathname as jest.Mock).mockReturnValue('/products');
  useUser.mockReturnValue({ user: { id: 'buyer-one' } });
  (React.useContext as jest.Mock).mockReturnValue(null);
  (useQuery as jest.Mock).mockImplementation(({ queryKey }) => queryKey[0] === 'header-chat-conversations'
    ? { data: conversations, isLoading: false, isError: false, refetch: jest.fn() }
    : { data: 4 });
  (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: false, isError: false, dataUpdatedAt: 0, hasNextPage: false });
  (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries: jest.fn().mockResolvedValue(undefined), setQueryData: jest.fn() });
  (useChatConnection as jest.Mock).mockReturnValue(false);
});

afterEach(() => {
  if (originalWebSocket) Object.defineProperty(globalThis, 'WebSocket', originalWebSocket);
  else Reflect.deleteProperty(globalThis, 'WebSocket');
  jest.useRealTimers();
});

test('header message action toggles a dialog without navigating away from shopping', () => {
  const toggle = jest.fn();
  (React.useContext as jest.Mock).mockReturnValue({ open: false, panelId: 'chat-panel', toggle });
  const button = HeaderMessageButton({ userId: 'buyer-one' });
  expect(button.type).toBe('button');
  expect(button.props.href).toBeUndefined();
  expect(button.props['aria-haspopup']).toBe('dialog');
  expect(button.props['aria-expanded']).toBe(false);
  const trigger = {};
  button.props.onClick({ currentTarget: trigger });
  expect(toggle).toHaveBeenCalledWith(trigger);
  expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['header-chat-unread', 'buyer-one'] }));
});

test('the existing fullscreen Inbox keeps its route and does not start another popup', () => {
  const toggle = jest.fn();
  (usePathname as jest.Mock).mockReturnValue('/inbox');
  (React.useContext as jest.Mock).mockReturnValue({ open: false, panelId: 'chat-panel', toggle });
  const link = HeaderMessageButton({ userId: 'buyer-one' });
  expect(link.type).toBe('a');
  expect(link.props.href).toBe('/inbox');
  expect(link.props.onClick).toBeUndefined();
  expect(toggle).not.toHaveBeenCalled();
});

test('both header triggers share one popup, and account or route changes close it immediately', () => {
  const ui = component(() => HeaderChatProvider({ children: React.createElement('header') }));
  const popup = () => ui.all().find(node => typeof node.type === 'function');
  expect(popup()).toBeUndefined();
  ui.tree.props.value.toggle({}); ui.render();
  expect(ui.tree.props.value.open).toBe(true);
  expect(popup().props.userId).toBe('buyer-one');
  expect(ui.all().filter(node => typeof node.type === 'function')).toHaveLength(1);
  ui.tree.props.value.toggle({}); ui.render();
  expect(popup()).toBeUndefined();
  ui.tree.props.value.toggle({}); ui.render();
  useUser.mockReturnValue({ user: { id: 'buyer-two' } }); ui.render();
  expect(ui.tree.props.value.open).toBe(false);
  expect(popup()).toBeUndefined();
  ui.tree.props.value.toggle({}); ui.render();
  expect(popup().props.userId).toBe('buyer-two');
  (usePathname as jest.Mock).mockReturnValue('/cart'); ui.render();
  expect(popup()).toBeUndefined();
  ui.tree.props.value.toggle({}); ui.render();
  (usePathname as jest.Mock).mockReturnValue('/inbox'); ui.render();
  expect(popup()).toBeUndefined();
});

test('View details opens only the selected fullscreen thread and conversation switches preserve drafts', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: {} } });
  try {
    const provider = component(() => HeaderChatProvider({ children: null }));
    provider.tree.props.value.toggle({}); provider.render();
    const element = provider.all().find(node => typeof node.type === 'function');
    const ui = component(() => element.type(element.props));
    const details = () => ui.all().find(node => node.type === 'a' && nodeText(node) === 'View details');
    expect(details().props.href).toBe('/inbox');
    ui.all().find(node => node.type === 'button' && nodeText(node).includes('First shop')).props.onClick(); ui.render();
    expect(details().props.href).toBe('/inbox?conversationId=one');
    ui.all().find(node => node.type === 'textarea').props.onChange({ target: { value: 'Draft for first shop' } }); ui.render();
    ui.all().find(node => node.props['aria-label'] === 'Back to conversations').props.onClick(); ui.render();
    ui.all().find(node => node.type === 'button' && nodeText(node).includes('Second shop')).props.onClick(); ui.render();
    expect(ui.all().find(node => node.type === 'textarea').props.value).toBe('');
    expect(details().props.href).toBe('/inbox?conversationId=two');
    ui.all().find(node => node.props['aria-label'] === 'Back to conversations').props.onClick(); ui.render();
    ui.all().find(node => node.type === 'button' && nodeText(node).includes('First shop')).props.onClick(); ui.render();
    expect(ui.all().find(node => node.type === 'textarea').props.value).toBe('Draft for first shop');
    const query = (useInfiniteQuery as jest.Mock).mock.calls.at(-1)![0];
    expect(query.queryKey).toEqual(['header-chat-messages', 'buyer-one', 'one']);
    const link = details(); link.props.onClick(); provider.render();
    expect(provider.tree.props.value.open).toBe(false);
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test.each(['close button', 'header toggle'])('reopening Message after using the %s starts at the conversation list and preserves the thread draft', closeWith => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: {} } });
  try {
    const provider = component(() => HeaderChatProvider({ children: null }));
    const mountPopup = () => {
      const element = provider.all().find(node => typeof node.type === 'function');
      return component(() => element.type(element.props));
    };
    provider.tree.props.value.toggle({}); provider.render();
    const chat = mountPopup();
    chat.all().find(node => node.type === 'button' && nodeText(node).includes('First shop')).props.onClick(); chat.render();
    chat.all().find(node => node.type === 'textarea').props.onChange({ target: { value: 'Keep this draft after reopening' } }); chat.render();
    chat.all().find(node => node.type === 'chat-attachments').props.onUploaded('https://example.test/draft-image.png'); chat.render();

    if (closeWith === 'close button') chat.all().find(node => node.props['aria-label'] === 'Close chat').props.onClick();
    else provider.tree.props.value.toggle({});
    provider.render();
    expect(provider.tree.props.value.open).toBe(false);
    expect(provider.all().some(node => typeof node.type === 'function')).toBe(false);

    provider.tree.props.value.toggle({}); provider.render();
    const reopened = mountPopup();
    expect(reopened.all().some(node => node.props['aria-label'] === 'Search conversations')).toBe(true);
    expect(reopened.all().some(node => node.type === 'textarea')).toBe(false);
    expect(reopened.all().find(node => node.type === 'a' && nodeText(node) === 'View details').props.href).toBe('/inbox');
    expect((useInfiniteQuery as jest.Mock).mock.calls.at(-1)![0]).toEqual(expect.objectContaining({
      queryKey: ['header-chat-messages', 'buyer-one', null], enabled: false,
    }));

    reopened.all().find(node => node.type === 'button' && nodeText(node).includes('First shop')).props.onClick(); reopened.render();
    expect(reopened.all().find(node => node.type === 'textarea').props.value).toBe('Keep this draft after reopening');
    expect(reopened.all().find(node => node.type === 'attachment-preview').props.url).toBe('https://example.test/draft-image.png');
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('account actions compose the shared chat and notification triggers only for signed-in users', () => {
  const first = NotificationBadge();
  expect(nodes(first).find(node => node.type === HeaderMessageButton).props.userId).toBe('buyer-one');
  expect(nodes(first).find(node => node.type === 'header-notification-button').props.userId).toBe('buyer-one');
  useUser.mockReturnValue({ user: { id: 'buyer-two' } });
  const second = NotificationBadge();
  expect(nodes(second).find(node => node.type === 'header-notification-button').props.userId).toBe('buyer-two');
  useUser.mockReturnValue({ user: null });
  expect(NotificationBadge()).toBeNull();
});

test('another tab own-message echo does not clear the current draft or acknowledge a different pending send', () => {
  jest.useFakeTimers();
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: {}, visibilityState: 'visible' } });
  const send = jest.fn();
  (useChatConnection as jest.Mock).mockImplementation(({ socketRef }) => { socketRef.current = { readyState: 1, send }; return true; });
  try {
    const provider = component(() => HeaderChatProvider({ children: null }));
    provider.tree.props.value.toggle({}); provider.render();
    const element = provider.all().find(node => typeof node.type === 'function');
    const ui = component(() => element.type(element.props));
    ui.all().find(node => node.type === 'button' && nodeText(node).includes('First shop')).props.onClick(); ui.render();
    const input = () => ui.all().find(node => node.type === 'textarea');
    const event = (payload: any) => { (useChatConnection as jest.Mock).mock.calls.at(-1)![0].onEvent({ type: 'NEW_MESSAGE', payload }); ui.render(); };
    const message = { id: 'message-one', conversationId: 'one', senderId: 'buyer-one', senderType: 'user', content: 'Sent in another tab', attachments: [], createdAt: '2026-10-18T03:01:00Z' };
    input().props.onChange({ target: { value: 'My unsent draft' } }); ui.render();
    event(message);
    expect(input().props.value).toBe('My unsent draft');
    ui.all().find(node => node.type === 'form').props.onSubmit({ preventDefault: jest.fn() }); ui.render();
    expect(send.mock.calls.map(([frame]) => JSON.parse(frame))).toContainEqual({ messageBody: 'My unsent draft', attachments: [], conversationId: 'one' });
    event({ ...message, id: 'message-two' });
    expect(input().props.value).toBe('My unsent draft');
    expect(ui.all().find(node => node.type === 'fieldset').props.disabled).toBe(true);
    event({ ...message, id: 'message-three', content: 'My unsent draft' });
    expect(input().props.value).toBe('');
    expect(ui.all().find(node => node.type === 'fieldset').props.disabled).toBe(false);
  } finally {
    jest.clearAllTimers();
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('an attachment upload finishing after a thread switch stays with its original conversation', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: {} } });
  try {
    const provider = component(() => HeaderChatProvider({ children: null }));
    provider.tree.props.value.toggle({}); provider.render();
    const element = provider.all().find(node => typeof node.type === 'function');
    const ui = component(() => element.type(element.props));
    const select = (name: string) => { ui.all().find(node => node.type === 'button' && nodeText(node).includes(name)).props.onClick(); ui.render(); };
    const back = () => { ui.all().find(node => node.props['aria-label'] === 'Back to conversations').props.onClick(); ui.render(); };
    select('First shop');
    ui.all().find(node => node.type === 'textarea').props.onChange({ target: { value: 'First shop draft' } }); ui.render();
    const uploaded = ui.all().find(node => node.type === 'chat-attachments').props.onUploaded;
    back(); select('Second shop');
    ui.all().find(node => node.type === 'textarea').props.onChange({ target: { value: 'Second shop draft' } }); ui.render();
    uploaded('https://example.test/first-shop.pdf'); ui.render();
    expect(ui.all().some(node => node.type === 'attachment-preview')).toBe(false);
    expect(ui.all().find(node => node.type === 'textarea').props.value).toBe('Second shop draft');
    back(); select('First shop');
    expect(ui.all().find(node => node.type === 'attachment-preview').props.url).toBe('https://example.test/first-shop.pdf');
    expect(ui.all().find(node => node.type === 'textarea').props.value).toBe('First shop draft');
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
