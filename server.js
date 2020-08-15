const app = require("express")();
const { v4: uuid } = require("uuid");
const server = require("http").Server(app);
const Connection = require("./connection/connection");

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

const connection = new Connection(server);

app.post("/rooms", (req, res) => {
  let roomId = uuid();

  while (connection.contains(roomId)) {
    roomId = uuid();
  }

  res.send(roomId);
});

app.get("/rooms/valid/:id", (req, res) => {
  const roomId = req.params.id;
  res.send(connection.contains(roomId));
});

app.get("/rooms/:roomID/players/:playerName", (req, res) => {
  const roomId = req.params.roomID;
  const playerName = req.params.playerName;

  if (connection.contains(roomId)) {
    const playerNameIsTaken = connection.rooms.get(roomId).contains(playerName);
    res.send(playerNameIsTaken);
    return;
  }

  res.send(false);
});

// handle invalid routes
app.use(function (req, res) {
  res.sendStatus(404);
});

server.listen(8080, () => {
  "Server listening at http://localhost:8080";
});
