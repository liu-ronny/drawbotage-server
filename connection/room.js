const Game = require("../game/game");

/**
 * Represents a Drawbotage room and keeps track of its current state. It is used by
 * the Connection to mirror the state of the server socket without having to access
 * its internals.
 */
class Room {
  /**
   * Creates an object that keeps track of the current state of the room with
   * the provided room id.
   * @param {Connection} connection - The Connection that manages the server socket
   * @param {string} roomId - The UUID that identifies the room
   * @param {number} rounds - The default number of rounds to play
   * @param {number} drawTime - The default draw time per turn
   * @property {Connection} connection - The Connection that manages the server socket
   * @property {string} roomId - The UUID that identifies the room
   * @property {number} rounds - The selected number of rounds to play
   * @property {number} drawTime - The selected draw time per turn
   * @property {string[]} redPlayerNames - The names of the players on the red team
   * @property {string[]} bluePlayerNames - The names of the players on the blue team
   * @property {string[]} unassignedPlayerNames - The names of the players who are not assigned to a team
   * @property {Map.<string, object>} players - The players in the room. Player names are used as keys, and the values contain their corresponding sockets and team names
   * @property {Socket} hostSocket - The client socket belonging to the host of the room
   * @property {string} hostName - The name of the host of the room
   * @property {boolean} gameStarted - Whether a game has been started in the room
   */
  constructor(connection, roomId, rounds, drawTime) {
    this.connection = connection;
    this.roomId = roomId;
    this.redPlayerNames = [];
    this.bluePlayerNames = [];
    this.unassignedPlayerNames = [];
    this.players = new Map();
    this.hostSocket = null;
    this.hostName = null;
    this.rounds = rounds;
    this.drawTime = drawTime;
  }

  /**
   * Adds a player to the room. Players are placed on the unassigned team by default.
   * @param {string} playerName - The name of the player
   * @param {Socket} playerSocket - The client socket belonging to the player
   */
  add(playerName, playerSocket) {
    this.unassignedPlayerNames.push(playerName);
    this.players.set(playerName, { playerSocket, teamName: "unassigned" });
  }

  /**
   * Removes a player from the room if the player exists. If the removed player is the host,
   * a new host will be assigned.
   * @param {string} playerName - The name of the player
   */
  remove(playerName) {
    if (this.size() === 0 || !this.contains(playerName)) {
      return;
    }

    // get the player's team, filter the player out, and remove it from the players Map
    const team = this.players.get(playerName).teamName + "PlayerNames";
    this[team] = this[team].filter((name) => name !== playerName);
    this.players.delete(playerName);

    if (playerName === this.hostName) {
      this._findNewHost();
    }
  }

  /**
   * Returns whether the specified player is in the room.
   * @param {string} playerName - The name of the player
   * @returns {boolean} True if the player is in the room, or False otherwise
   */
  contains(playerName) {
    return this.players.has(playerName);
  }

  /**
   * Returns the client socket of the specified player, or undefined if the player does not exist.
   * @param {string} playerName - The name of the player
   * @returns {Socket} The client socket belonging to the player
   */
  playerSocket(playerName) {
    const player = this.players.get(playerName);
    return player ? player.playerSocket : player;
  }

  /**
   * @typedef {Object} RoomInfo
   * @property {string} host - The name of the host of the room
   * @property {string[]} redPlayerNames - The names of the players on the red team
   * @property {string[]} bluePlayerNames - The names of the players on the blue team
   * @property {string[]} unassignedPlayerNames - The names of the players who are not assigned to a team
   * @property {number} rounds - The selected number of rounds to play  
   * @property {number} drawTime - The selected draw time per turn
   * / 
  /**
   * Returns an object containing information about the room.
   * @returns {RoomInfo} 
   */
  info() {
    return {
      host: this.hostName,
      redPlayerNames: this.redPlayerNames,
      bluePlayerNames: this.bluePlayerNames,
      unassignedPlayerNames: this.unassignedPlayerNames,
      rounds: this.rounds,
      drawTime: this.drawTime,
    };
  }

  /**
   * Sets the host of the room if the specified player exists.
   * @param {string} playerName - The name of the player
   * @param {Socket} playerSocket - The client socket belonging to the player
   */
  setHost(playerName, playerSocket) {
    if (this.players.has(playerName)) {
      this.hostName = playerName;
      this.hostSocket = playerSocket;
    }
  }

  /**
   * Returns the host name and corresponding client socket.
   * @returns {Array} An array of the form [<host name>, <host socket>]
   */
  getHost() {
    return [this.hostName, this.hostSocket];
  }

  /**
   * Finds and sets a new host using the players currently in the room.
   */
  _findNewHost() {
    if (this.size() === 0) {
      this.hostName = null;
      this.hostSocket = null;
      return;
    }

    // use the first player returned by the Map's iterator
    const playerIterator = this.players.entries();
    const newHost = playerIterator.next().value;
    const [newHostName, { playerSocket: newHostSocket }] = newHost;
    this.setHost(newHostName, newHostSocket);
  }

  /**
   * Moves a player from one team to another.
   * @param {string} playerName - The name of the player
   * @param {string} newTeamName - One of "red", "blue", or "unassigned"
   * @param {number} insertPosition - The position on the new team to insert the player at
   */
  updateTeams(playerName, newTeamName, insertPosition) {
    const validTeamNames = ["red", "blue", "unassigned"];
    if (
      !this.contains(playerName) ||
      !validTeamNames.includes(newTeamName) ||
      insertPosition < 0
    ) {
      return;
    }

    const player = this.players.get(playerName);
    const oldTeam = player.teamName + "PlayerNames";
    const newTeam = newTeamName + "PlayerNames";

    this[oldTeam] = this[oldTeam].filter((name) => name !== playerName);
    this[newTeam].splice(insertPosition, 0, playerName);
    player.teamName = newTeamName;
  }

  /**
   * Assigns a value to the specified setting if it exists.
   * @param {string} settingName - One of "rounds" or "drawTime"
   * @param {number} settingValue - The value to assign to the setting
   */
  updateSettings(settingName, settingValue) {
    if (settingName === "rounds" || settingName === "drawTime") {
      this[settingName] = settingValue;
    }
  }

  /**
   * Returns the number of players in the room.
   * @returns {number} The number of players in the room
   */
  size() {
    return this.players.size;
  }

  createGame() {
    this.game = new Game(
      this.connection,
      this,
      this.roomId,
      this.rounds,
      this.drawTime
    );
  }

  /**
   * Starts a Drawbotage game using the players in the room.
   */
  async startGame() {
    this.gameStarted = true;
    try {
      await this.game.play();
    } catch (err) {
      this.game.endGame(false);
    }
  }
}

module.exports = Room;
