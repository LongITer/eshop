import axios, { AxiosError } from 'axios';
import api from '../../apps/user-ui/src/utils/axioInstance';
import sellerApi from '../../apps/seller-ui/src/utils/axioInstance';

test.each([api, sellerApi])('temporary refresh failures do not redirect to login', async client => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const assign = jest.fn();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/profile', assign } } });
  const refresh = jest.spyOn(axios, 'post').mockRejectedValue(new AxiosError('Network Error'));
  const adapter = async (config: any) => { throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401, statusText: '', headers: {}, config, data: {} }); };
  try {
    await expect(client.get('/protected', { adapter })).rejects.toThrow('Network Error');
    expect(assign).not.toHaveBeenCalled();
  } finally {
    refresh.mockRestore();
    if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('a 401 after refresh redirects a protected page instead of leaving stale profile data visible', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const assign = jest.fn();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/profile', assign } } });
  const refresh = jest.spyOn(axios, 'post').mockResolvedValue({ status: 201 });
  const adapter = jest.fn(async config => {
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
      status: 401, statusText: 'Unauthorized', headers: {}, config, data: { message: 'Unauthorized' },
    });
  });
  try {
    await expect(api.get('/order/get-user-orders', { adapter })).rejects.toMatchObject({ response: { status: 401 } });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/login');
  } finally {
    refresh.mockRestore();
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
