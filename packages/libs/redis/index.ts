import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_DATABASE_URL || process.env.REDIS_DATEBASE_URL || 'redis://localhost:6379')

export default redis;
