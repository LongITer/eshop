import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
// import swaggerUi from "swagger-ui-express";
// import swaggerDocument from "./swagger-output.json";
import { errorMiddleware } from '@packages/error-handler/error-middleware';
import router from '../routes/product.router';

const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json())
app.use(cookieParser())

app.get('/', (req, res) => {
    res.send({ 'message': 'Hello Product API' });
});
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))
// app.get("/docs-json", (req, res) => {
//     res.json(swaggerDocument)
// })

// Routes
app.use("/api", router);

app.use(errorMiddleware)

const port = process.env.PORT || 6002;
const server = app.listen(port, () => {
    console.log(`Product service is listening at http://localhost:${port}/`);
    console.log(`Swagger json available at http://localhost:${port}/docs-json`);
    console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
});
