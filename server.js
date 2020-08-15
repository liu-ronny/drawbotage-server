const app = require("express")();
const cors = require("cors");
const { v4: uuid } = require("uuid");
const server = require("http").Server(app);
const Connection = require("./connection/connection");

const connection = new Connection(server);

if (app.get("env") === "development") {
  app.use(cors());
} else {
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGIN,
    })
  );
}

app.set("port", process.env.PORT || 5000);

/**
 * Creates a unique room id and sends it to the client.
 */
app.post("/rooms", (req, res) => {
  let roomId = uuid();

  while (connection.contains(roomId)) {
    roomId = uuid();
  }

  res.send(roomId);
});

/**
 * Checks whether the provided room id is valid.
 */
app.get("/rooms/valid/:id", (req, res) => {
  const roomId = req.params.id;
  res.send(connection.contains(roomId));
});

/**
 * Checks whether the specified player is in the provided room id.
 */
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

/**
 * Handles invalid routes.
 */
app.use(function (req, res) {
  res.sendStatus(404);
});

server.listen(app.get("port"));
