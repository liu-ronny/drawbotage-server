const io = require("socket.io");
const Room = require("./room");

/**
 * Manages a SocketIO server socket and its interactions with client sockets.
 * The Connection syncs the socket state with each Room object's state so that
 * we don't have to rely on SocketIO internals.
 */
class Connection {
  /**
   * Create a connection that listens for events from Drawbotage clients.
   * @param {http.Server} server - The HTTP server to bind to
   * @property {Map<string, Room>} - The rooms managed by the connection
   */
  constructor(server) {
    this.io = io(server);
    this.io.set("origins", "http://localhost:3000/");
    this.rooms = new Map();
    this.checkGuess = null;
    this.init();
  }

  /**
   * Sets up callbacks for Drawbotage events.
   */
  init() {
    this.io.sockets.on("connection", (socket) => {
      socket.on("createGame", (data) => {
        if (this.rooms.has(data.roomId)) {
          return;
        }

        // Create a room with the player as the host
        const room = new Room(this, data.roomId, data.rounds, data.drawTime);
        room.add(data.playerName, socket);
        room.setHost(data.playerName, socket);
        room.updateSettings("rounds", data.rounds);
        room.updateSettings("drawTime", data.drawTime);
        this.rooms.set(data.roomId, room);
        this.joinRoom(data, socket);

        this.emitInfo(data.roomId);
      });

      socket.on("joinGame", (data) => {
        if (!this.rooms.has(data.roomId)) {
          this.emitError(
            socket,
            "Something went wrong when attempting to join the game. Please try again."
          );
          return;
        }

        const room = this.rooms.get(data.roomId);
        room.add(data.playerName, socket);
        this.joinRoom(data, socket);

        this.emitInfo(data.roomId);
      });

      socket.on("updateTeams", (data) => {
        if (!this.rooms.has(data.roomId)) {
          this.emitError(
            data.roomId,
            "Something went wrong while the host attempted to update the teams. Please try again."
          );
          return;
        }

        const room = this.rooms.get(data.roomId);
        room.updateTeams(
          data.playerName,
          data.newTeamName,
          data.insertPosition
        );

        this.emitInfo(data.roomId);
      });

      socket.on("updateSettings", (data) => {
        if (!this.rooms.has(data.roomId)) {
          this.emitError(
            data.roomId,
            "Something went wrong while the host attempted to update the settings. Please try again."
          );
          return;
        }

        const room = this.rooms.get(data.roomId);
        room.updateSettings(data.settingName, data.settingValue);

        this.emitInfo(data.roomId);
      });

      socket.on("startGame", (data) => {
        if (!this.rooms.has(data.roomId)) {
          this.emitError(
            data.roomId,
            "Unable to start the game. Please try again."
          );
          return;
        }

        const room = this.rooms.get(data.roomId);
        this.io.to(data.roomId).emit("startGame", room.info());
        room.createGame();
        room.startGame();
      });

      socket.on("leaveGame", (data) => {
        if (!this.rooms.has(data.roomId)) {
          return;
        }

        const room = this.rooms.get(data.roomId);
        room.remove(data.playerName);
        socket.leave(data.roomId);

        // Clean up the room if there are no more players left
        if (room.size() === 0) {
          this.rooms.delete(socket.roomId);
          return;
        }

        this.emitInfo(data.roomId);
      });

      socket.on("disconnect", () => {
        if (!this.rooms.has(socket.roomId)) {
          return;
        }

        const room = this.rooms.get(socket.roomId);
        room.remove(socket.playerName);
        socket.leave(socket.roomId);

        // Clean up the room if there are no more players left
        if (room.size() === 0) {
          this.rooms.delete(socket.roomId);
          return;
        }

        this.emitInfo(socket.roomId);
      });

      socket.on("guess", (data) => {
        if (!this.rooms.has(data.roomId)) {
          this.emitError(
            data.roomId,
            "An error occured on the server. Please try again."
          );
          return;
        }

        const room = this.rooms.get(data.roomId);
        let isCorrect = false;
        if (room.checkGuess) {
          isCorrect = room.checkGuess(data);
        }

        // socket.to(data.roomId).emit("message", { message: data, isCorrect });
        this.emit("message", data.roomId, { message: data, isCorrect });
      });

      socket.on("setColor", (data) => {
        socket.to(socket.roomId).emit("setColor", data);
      });

      socket.on("drawingTool", (data) => {
        socket.to(socket.roomId).emit("drawingTool", data);
      });

      socket.on("eraserTool", (data) => {
        socket.to(socket.roomId).emit("eraserTool", data);
      });

      socket.on("clearTool", (data) => {
        socket.to(socket.roomId).emit("clearTool", data);
      });

      socket.on("fillTool", (data) => {
        socket.to(socket.roomId).emit("fillTool", data);
      });

      socket.on("reverseTool", (data) => {
        socket.to(socket.roomId).emit("reverseTool", data);
      });

      socket.on("colorTool", (data) => {
        socket.to(socket.roomId).emit("colorTool", data);
      });

      socket.on("hideTool", (data) => {
        socket.to(socket.roomId).emit("hideTool", data);
      });
    });
  }

  /**
   * Adds a player to the specified room.
   * @param {object} data - An object that contains a player name and a room id
   * @param {SocketIO.Socket} socket - The client socket belonging to the player
   */
  joinRoom(data, socket) {
    socket.playerName = data.playerName;
    socket.roomId = data.roomId;
    socket.join(data.roomId);
  }

  /**
   * Removes a room from the connection. This method should be called after a game ends
   * to free the memory associated with the corresponding room.
   * @param {string} roomId - The UUID that identifies the room
   */
  remove(roomId) {
    this.rooms.delete(roomId);
  }

  /**
   * Returns whether the connection has a room with the specified id.
   * @param {string} roomId - The UUID that identifies the room
   */
  contains(roomId) {
    return this.rooms.has(roomId);
  }

  get(roomId) {
    return this.rooms.get(roomId);
  }

  /**
   * Emits the specified room's information to all clients in the room.
   * @param {string} roomId - The UUID that identifies the room
   */
  emitInfo(roomId) {
    const room = this.rooms.get(roomId);
    this.emit("info", roomId, room.info());
  }

  /**
   * Emits an error event to either a specific client socket or to all clients in the room.
   * @param {object|string} recipient - Either a client socket object or a room id
   * @param {string} message - The error message to emit with the event
   */
  emitError(recipient, message) {
    this.emit("error", recipient, { message });
  }

  /**
   * Emits an event to either a specific client socket or to all clients in a room.
   * If a callback is provided, the event will be emitted with acknowledgements.
   * @param {string} event - The name of the event to emit
   * @param {object|string} recipient - Either a client socket object or a room id
   * @param {object} data - The data to emit with the event
   * @param {function} [callback] - The callback to run when the client socket has sent back an acknowledgement
   */
  emit(event, recipient, data, callback) {
    if (typeof recipient === "object") {
      if (callback) {
        recipient.emit(event, data, (response) => {
          callback(response);
        });
      } else {
        recipient.emit(event, data);
      }
    } else {
      if (callback) {
        this.io.to(recipient).emit(event, data, (response) => {
          callback(response);
        });
      } else {
        this.io.to(recipient).emit(event, data);
      }
    }
  }

  /**
   * Opens up guesses and allows the connection to respond to incoming guess events.
   * @param {function} check - The validator function used to check guesses
   * @param {function} callback - The function to run if a correct guess has been identified
   */
  enableGuesses(roomId, check, callback) {
    if (!this.rooms.has(roomId)) {
      return;
    }

    const room = this.rooms.get(roomId);

    room.checkGuess = (data) => {
      const { guess, playerName, fromTeam, timeRemaining } = data;

      const isCorrect = check(guess, fromTeam);
      if (isCorrect) {
        callback(playerName, timeRemaining);
        return true;
      }

      return false;
    };
  }

  /**
   * Closes up guesses so that guess events don't do anything.
   */
  disableGuesses(roomId) {
    if (!this.rooms.has(roomId)) {
      return;
    }

    const room = this.rooms.get(roomId);
    room.checkGuess = null;
  }
}

module.exports = Connection;
