import express from "express";

const app = express();
app.use(express.json());
app.use();

app.get("/", (req, res) => {
  res.send({ message: "Welcome to chatting-service!" });
});

const port = process.env.PORT || 6006;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on("error", console.error);
