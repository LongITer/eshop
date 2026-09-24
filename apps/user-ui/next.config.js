//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');


/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
      },
      {
        protocol: 'https',
        hostname: 'cdn-media.sforum.vn',
      },
      {
        protocol: 'https',
        hostname: 'png.pngtree.com',
      },
      {
        protocol: 'https',
        hostname: 'thiepmung.com',
      },
      {
        protocol: 'https',
        hostname: 'hunggiaco.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
      // Order API endpoints — listed explicitly so they don't conflict
      // with the /order/[orderId] page route (afterFiles rewrites run
      // before dynamic routes, so a wildcard /order/:path* would
      // intercept page navigation).
      {
        source: '/order/get-user-orders',
        destination: 'http://localhost:8080/order/get-user-orders',
      },
      {
        source: '/order/get-order/:orderId',
        destination: 'http://localhost:8080/order/get-order/:orderId',
      },
      {
        source: '/order/create-payment-intent',
        destination: 'http://localhost:8080/order/create-payment-intent',
      },
      {
        source: '/order/create-payment-session',
        destination: 'http://localhost:8080/order/create-payment-session',
      },
      {
        source: '/order/verify-payment-session',
        destination: 'http://localhost:8080/order/verify-payment-session',
      },
      {
        source: '/order/verify-coupon',
        destination: 'http://localhost:8080/order/verify-coupon',
      },
      {
        source: '/product/:path*',
        destination: 'http://localhost:8080/product/:path*',
      },
      {
        source: '/chatting/:path*',
        destination: 'http://localhost:8080/chatting/:path*',
      },
    ];
  },

};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);

