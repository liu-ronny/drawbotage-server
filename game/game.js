const PlayerList = require("./playerList");
const WordBank = require("./wordBank");
const { intervalPromise, waitPromise } = require("../utils/promises");

/**
 * @typedef {object} TurnResult
 * @param {number} timeRemaining - The number of milliseconds remaining on the timer when the turn ended
 * @param {string} [playerName] - The name of the player who correctly guessed the word
 */

/**
 * @typedef {object} GameInfo
 * @param {string} word - The selected word for the turn
 * @param {number} points - The number of points the current team gained during the turn
 * @param {number} prevScore - The previous score of the current team
 * @param {number} currentScore - The current score of the current team (previous score + points)
 * @param {number} timeRemaining - The number of milliseconds remaining on the timer when the turn ended
 * @param {string} playerName - The name of the player who correctly guessed the word
 */

/**
 * Represents a Drawbotage game.
 */
class Game {
  /**
   * Creates a Drawbotage game.
   * @param {Connection} connection - The connection that manages the server socket
   * @param {Room} room - The room that is associated with the game
   * @param {string} roomId - The UUID that identifies the room
   * @param {number} rounds - The number of rounds to play
   * @param {number} drawTime - The draw time per turn
   */
  constructor(connection, room, roomId, rounds, drawTime) {
    this.connection = connection;
    this.room = room;
    this.roomId = roomId;
    this.rounds = rounds;
    this.drawTime = drawTime * 1000;

    // set the initial parameters of the game
    // both teams start with 0 points, and play commences from turn 1 of round 1
    this.redScore = 0;
    this.blueScore = 0;
    this.redTotalDrawTime = 0;
    this.blueTotalDrawTime = 0;
    this.round = 1;
    this.turn = 1;
    this.currentPlayer = null;
    this.currentWord = null;
    this.wordBank = new WordBank();
    this.gameOver = false;

    // randomly pick a team
    this.prevTeam = Math.random() < 0.5 ? "blue" : "red";
    this.currentTeam = this.prevTeam === "blue" ? "red" : "blue";

    // list out the names of the available drawbotages
    // this.drawbotages = ["reverse", "hide", "color", "bulldoze"];
    this.drawbotages = ["reverse", "hide", "color"];

    // create a managed list of players and calculate the number of turns per round
    const { redPlayerNames, bluePlayerNames } = room.info();
    this.red = new PlayerList(room, redPlayerNames);
    this.blue = new PlayerList(room, bluePlayerNames);
    this.turnsPerRound = Math.max(
      redPlayerNames.length * 2,
      bluePlayerNames.length * 2
    );
  }

  /**
   * Plays the game. Turns will be played recursively until all rounds have been played out.
   */
  async play() {
    if (this.round === 1 && this.turn === 1) {
      this.connection.emit("gameStarting", this.roomId, {});
      await waitPromise(5000);
      this.connection.emit("startGameplay", this.roomId, {});
    }

    this.setNextTeam();
    const [prevTeamScore, currentTeamScore] = this.getScores();

    // assign the next player unless there are not enough players on the current team
    try {
      this.setNextPlayer();
      this.connection.emit("setCurrentPlayer", this.roomId, {
        currentPlayerName: this.currentPlayer,
      });
    } catch (err) {
      this.connection.emitError(
        this.roomId,
        "The game ended because at least one of teams has less than 2 players left."
      );
      this.endGame(false);
      return;
    }

    // previous gap was 150 - not sure if changing to 50 will break the tests
    // if the other team is behind by a certain amount, let a player from that team choose a drawbotage
    if (prevTeamScore + 50 <= currentTeamScore) {
      await this.selectDrawbotage();
    }

    // have the player select a word, and start receiving guesses to check against
    this.setCurrentWord(await this.selectWord());
    const result = await this.receiveGuesses(this.drawTime);

    // send the result of the turn to all clients, then update the turn status
    await this.endTurn(result);
    this.nextTurn();

    if (this.gameOver) {
      this.endGame();
      return;
    }

    this.connection.emit("setCurrentPlayer", this.roomId, {});
    this.play();
  }

  /**
   * Returns the players belonging to the previous and current teams
   * @returns {[PlayerList, PlayerList]} [<previous team players>, <current team players>]
   */
  getPlayers() {
    const prevPlayers = this[this.prevTeam];
    const currentPlayers = this[this.currentTeam];
    return [prevPlayers, currentPlayers];
  }

  /**
   * Returns the scores belonging to the previous and current teams
   * @returns {[number, number]} [<previous team score>, <current team score>]
   */
  getScores() {
    const prevTeamScore = this[this.prevTeam + "Score"];
    const currentTeamScore = this[this.currentTeam + "Score"];
    return [prevTeamScore, currentTeamScore];
  }

  /**
   * Returns the winner of the game. Ties are broken according to total draw time.
   * @returns {string} winner - The name of the winning team
   */
  getWinner() {
    let winner;
    if (this.redScore > this.blueScore) {
      winner = "red";
    } else if (this.redScore < this.blueScore) {
      winner = "blue";
    } else {
      winner = this.redTotalDrawTime >= this.blueTotalDrawTime ? "blue" : "red";
    }

    return winner;
  }

  /**
   * Returns an object that contains information about the state of the game.
   * @param {TurnResult} result - An object that contains information about the result of the most recent turn
   * @returns {GameInfo}
   */
  getInfo(result) {
    const [_, currentTeamScore] = this.getScores();

    return {
      currentTeam: this.currentTeam,
      word: this.currentWord,
      points: result.points,
      prevScore: currentTeamScore - result.points,
      currentScore: currentTeamScore,
      timeRemaining: result.timeRemaining,
      playerName: result.playerName,
      round: this.round,
    };
  }

  /**
   * Sets the next team to be the current team. Also sets the current team to be the previous team.
   */
  setNextTeam() {
    this.prevTeam = this.currentTeam;
    this.currentTeam = this.currentTeam === "blue" ? "red" : "blue";
  }

  /**
   * Sets the next player on the current team.
   * @throws {EmptyPlayerListError}
   */
  setNextPlayer() {
    const [_, currentPlayers] = this.getPlayers();
    this.currentPlayer = currentPlayers.next();
  }

  /**
   * Sets the current word in the game.
   * @param {string} word - The word to set as the current word
   */
  setCurrentWord(word) {
    this.currentWord = word;
  }

  /**
   * Ends the current turn in the game.
   * @param {TurnResult} result - An object that contains information about the result of the most recent turn
   */
  async endTurn(result) {
    // update the total draw time and score for the current team
    this[this.currentTeam + "TotalDrawTime"] +=
      this.drawTime - result.timeRemaining;
    result.points = this.calculatePoints(result.timeRemaining);
    this[this.currentTeam + "Score"] += result.points;

    this.connection.emit("endTurn", this.roomId, this.getInfo(result));
    await waitPromise(5000);
    this.connection.emit("hideTurnResult", this.roomId, {});
  }

  /**
   * Updates the turn and round status of the game.
   */
  nextTurn() {
    this.turn++;

    if (this.turn > this.turnsPerRound) {
      this.round++;
      this.turn = 1;
    }

    if (this.round > this.rounds) {
      this.gameOver = true;
    }
  }

  /**
   * Ends the game and cleans up the associated room in memory.
   * @param {boolean} withWinner - Whether the winner status should be emitted to client sockets
   */
  endGame(withWinner = true) {
    if (withWinner) {
      this.connection.emit("endGame", this.roomId, {
        redScore: this.redScore,
        blueScore: this.blueScore,
        redTotalDrawTime: this.redTotalDrawTime,
        blueTotalDrawTime: this.blueTotalDrawTime,
        winner: this.getWinner(),
      });
    }

    // clean up the room in memory
    this.room.game = null;
    this.connection.remove(this.roomId);
  }

  /**
   * Calculates the point total for a given turn based on the draw time remaining.
   * @param {number} drawTimeRemaining - The number of milliseconds remaining on the timer when the turn ended
   * @param {number} points - The number of points the current team gained during the turn
   */
  calculatePoints(drawTimeRemaining) {
    const frac = drawTimeRemaining / this.drawTime;
    let points = 0;

    if (frac >= 0.75) {
      points = 100;
    } else if (frac >= 0.5) {
      points = 75;
    } else if (frac >= 0.25) {
      points = 60;
    } else if (frac > 0) {
      points = 50;
    }

    return points;
  }

  /**
   * Returns an array of the form [promise, intervalId]. The promise resolves when the client socket responds to the emitted event.
   * If the client fails to respond within the specified number of milliseconds, the promise will reject. The intervalId can be
   * cleared when the client responds before the promise rejects.
   * @param {string} event - The name of event to emit
   * @param {object|string} recipient - Either a client socket object or a room id
   * @param {object} data - The data to emit with the event
   * @param {string} ms - The number of milliseconds to wait before rejecting the promise. Must be >= 1000.
   * @returns {[Promise, string]} An array of the form [promise, intervalId]
   */
  getResponse(event, recipient, data, ms) {
    let response = new Promise((resolve) => {
      this.connection.emit(event, recipient, data, (responseData) => {
        resolve(responseData);
      });
    });

    return intervalPromise(ms, response, (timeRemaining) => {
      this.connection.emit(event + "Timer", this.roomId, { timeRemaining });
    });
  }

  /**
   * Lets a player from the non-current team select a drawbotage.
   * @returns {string} The name of the selected drawbotage
   */
  async selectDrawbotage() {
    const [prevPlayers, _] = this.getPlayers();
    const selector = prevPlayers.peek();
    const socket = this.room.playerSocket(selector);

    socket.to(this.roomId).broadcast.emit("waitForDrawbotageSelection", {
      selector,
      timeRemaining: 120000,
    });

    // give the player 10 seconds to select a drawbotage before selecting one at random
    let drawbotage;
    const [response, timerId] = this.getResponse(
      "selectDrawbotage",
      socket,
      { drawbotages: this.drawbotages, timeRemaining: 120000 },
      120000
    );

    try {
      drawbotage = await response;
      clearInterval(timerId);
    } catch (err) {
      const randPos = Math.floor(Math.random() * this.drawbotages.length);
      drawbotage = this.drawbotages[randPos];
    }

    // emit the drawbotage choice to all clients
    this.connection.emit("drawbotageSelection", this.roomId, {
      selection: drawbotage,
    });
    await waitPromise(5000);
    this.connection.emit("hideDrawbotageSelection", this.roomId, {});

    return drawbotage;
  }

  /**
   * Lets the current player select a word.
   * @returns {string} The selected word
   */
  async selectWord() {
    // get three words from the word bank and let the active player choose one
    const words = this.wordBank.get(3);
    const socket = this.room.playerSocket(this.currentPlayer);

    socket.to(this.roomId).broadcast.emit("waitForWordSelection", {
      selector: this.currentPlayer,
      timeRemaining: 20000,
    });

    // give the player 10 seconds to select a word before selecting one at random
    let word;
    const [response, timerId] = this.getResponse(
      "selectWord",
      socket,
      { words, timeRemaining: 20000 },
      20000
    );

    try {
      word = await response;
      clearInterval(timerId);
    } catch (err) {
      const randPos = Math.floor(Math.random() * words.length);
      word = words[randPos];
    }

    // emit the word selection to all clients
    const spacesAt = this.getSpacePositions(word);
    this.connection.emit("wordSelection", this.roomId, {
      wordLength: word.length,
      spacesAt,
    });
    return word;
  }

  /**
   * Returns the indices of all spaces in a word.
   * @param {string} word - The input word
   */
  getSpacePositions(word) {
    const positions = [];

    for (let i = 0; i < word.length; i++) {
      const ch = word[i];

      if (ch === " ") {
        positions.push(i);
      }
    }

    return positions;
  }

  /**
   * Creates a check function that validates incoming guesses.
   * @returns {function} - A function that returns True if the guess is the current word, or False if it is incorrect
   */
  createGuessChecker() {
    return (guess, fromTeam) => {
      if (fromTeam === this.currentTeam) {
        return guess.trim().toLowerCase() === this.currentWord;
      }
      return false;
    };
  }

  /**
   * Allows client sockets to start sending in guesses for the current turn.
   * @param {number} ms - The number of milliseconds before the turn automatically ends
   * @returns {TurnResult} - An object that contains information about the result of the most recent turn
   */
  async receiveGuesses(ms) {
    const check = this.createGuessChecker();

    // use the check function to validate incoming guesses
    // a correct guess will cause the promise to resolve
    const guess = new Promise((resolve, reject) => {
      this.connection.enableGuesses(
        this.roomId,
        check,
        (playerName, timeRemaining) => {
          resolve({ playerName, timeRemaining });
        }
      );
    });

    // race the timer against the created promise
    const [result, intervalId] = intervalPromise(ms, guess, (timeRemaining) => {
      this.connection.emit("guessTimer", this.roomId, { timeRemaining });
    });

    // wait until either a player has correctly guessed the current word or until time has run out
    // in either case, disallow guess events from impacting the state of the game beyond this point
    let res = {};
    try {
      res = await result;
      clearInterval(intervalId);
    } catch (err) {
      res.timeRemaining = 0;
    } finally {
      this.connection.disableGuesses(this.roomId);
    }

    return res;
  }
}

module.exports = Game;
