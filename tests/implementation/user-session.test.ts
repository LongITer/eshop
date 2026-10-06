import axios, { AxiosError } from 'axios';
import api from '../../apps/user-ui/src/utils/axioInstance';

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
