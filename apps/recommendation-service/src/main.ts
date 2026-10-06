/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import express from "express";
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import isAuthenticated from '@packages/middleware/isAuthenticated';
import { isUser } from '@packages/middleware/authorizeRoles';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
import { personalized, similar, trending } from './controllers/recommendation.controller';
import * as path from "path";

const app = express();
app.use(cookieParser());
app.get('/api/recommendations/:userId', isAuthenticated, isUser, personalized);
app.get('/api/similar-products/:productId', similar);
app.get('/api/trending-products', trending);

app.use("/assets", express.static(path.join(__dirname, "assets")));

app.get("/api", (req, res) => {
  res.send({ message: "Welcome to recommendation-service!" });
});

app.use(errorMiddleware);
const port = process.env.PORT || process.env.RECOMMENDATION_PORT || 6008;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on("error", console.error);
