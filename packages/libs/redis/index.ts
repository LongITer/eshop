import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_DATEBASE_URL!)

export default redis;