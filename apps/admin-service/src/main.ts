import { startNotificationWorker } from './lib/notification-jobs';
import { startModerationWorker } from './lib/product-moderation-worker';
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
import router from './routes/admin.route';

const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());

app.get('/', (req, res) => {
  res.send({ message: 'Welcome to admin-service!' });
});

// Routes
app.use('/admin', router);
app.use(errorMiddleware);

startNotificationWorker();
startModerationWorker();
const port = process.env.PORT || 6005;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/admin`);
});
server.on('error', console.error);
