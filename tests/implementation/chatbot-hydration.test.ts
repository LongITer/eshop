import React from 'react';
import { renderToString } from 'react-dom/server';
import ChatbotWidget from '../../apps/user-ui/src/shared/components/chatbot/ChatbotWidget';

jest.mock('../../apps/user-ui/src/hooks/useUser', () => ({ __esModule: true, default: () => ({ user: null }) }));
jest.mock('../../apps/user-ui/src/hooks/useLocationTracking', () => ({ __esModule: true, default: () => null }));
jest.mock('../../apps/user-ui/src/hooks/useDeviceTracking', () => ({ __esModule: true, default: () => null }));
jest.mock('../../apps/user-ui/src/store', () => ({ useStore: (select: any) => select({ cart: [], addToCart: jest.fn() }) }));

test('initial chatbot markup matches SSR even when the browser saved English', () => {
  const serverHtml = renderToString(React.createElement(ChatbotWidget));
  const storage = { getItem: jest.fn(() => 'en'), setItem: jest.fn() };
  const keys = ['window', 'localStorage', 'sessionStorage'] as const;
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
    expect(renderToString(React.createElement(ChatbotWidget))).toBe(serverHtml);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  } finally {
    keys.forEach((key, index) => {
      if (previous[index]) Object.defineProperty(globalThis, key, previous[index]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
});
