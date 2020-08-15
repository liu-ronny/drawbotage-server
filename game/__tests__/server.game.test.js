const Connection = require("../../connection/connection");
const MockSocket = require("socket.io-mock");

const roomId = "41de3945-703e-40b3-b2c3-a31c2071cbc8";
const drawbotages = ["reverse", "hide", "color", "bulldoze"];
const drawTime = 60000;
const waitTime = 20000;

let connection;
let room;
let game;
let mockServer;
let assertionCount;

jest.mock("../../../utils/promises.js", () => ({
  ...jest.requireActual("../../../utils/promises.js"),
  waitPromise: () => {},
}));

// MockSocket.prototype.to = function (roomKey) {
//   return {
//     emit: (eventKey, payload) => {
//       this.broadcast.to(roomKey).emit(eventKey, payload);
//     },
//     broadcast: this.broadcast.to(roomKey),
//   };
// };
MockSocket.prototype.to = function (roomKey) {
  return {
    emit: (eventKey, payload, callback) => {
      if (!callback) {
        this.broadcast.to(roomKey).emit(eventKey, payload);
      } else {
        this.broadcast.to(roomKey).emit(eventKey, {
          data: payload,
          respond: callback,
        });
      }
    },
    broadcast: this.broadcast.to(roomKey),
  };
};
MockSocket.prototype.emit = function (eventKey, payload, callback) {
  if (!callback) {
    this.socketClient.fireEvent(eventKey, payload);
  } else {
    this.socketClient.fireEvent(eventKey, {
      data: payload,
      respond: callback,
    });
  }
};
MockSocket.prototype.emitEvent = function (eventKey, payload) {
  this._emitFn(eventKey, payload);
};

jest.mock("socket.io", () => {
  return jest.fn(() => mockServer);
});

beforeEach(() => {
  jest.useFakeTimers();
  mockServer = new MockSocket();
  mockServer.sockets = mockServer;
  mockServer.set = () => {};
  connection = new Connection(mockServer);
  assertionCount = 0;

  mockServer.socketClient.emit("connection", mockServer);

  emitToServer("createGame", { playerName: "p1" });
  emitToServer("updateTeams", {
    playerName: "p1",
    newTeamName: "red",
    insertPosition: 0,
  });

  for (let i = 2; i <= 10; i++) {
    const playerName = "p" + i;

    emitToServer("joinGame", { playerName });

    if (i % 2 === 0) {
      emitToServer("updateTeams", {
        playerName,
        newTeamName: "blue",
        insertPosition: 0,
      });
    } else {
      emitToServer("updateTeams", {
        playerName,
        newTeamName: "red",
        insertPosition: 0,
      });
    }
  }

  room = connection.get(roomId);
  room.createGame();
  game = room.game;
});

afterEach(() => {
  game.gameOver = true;
  game.endGame(false);
});

function emitToServer(event, data) {
  const { playerName, pushTo } = data;
  const defaults = {
    roomId,
    rounds: 3,
    drawTime: 60,
  };

  for (const prop of Object.keys(defaults)) {
    if (!data[prop]) {
      data[prop] = defaults[prop];
    }
  }

  if (pushTo) {
    pushTo.push(playerName);
  }

  mockServer.socketClient.emit(event, data);
}

describe("Game", () => {
  it("sets the next team correctly", () => {
    let prevTeam = game.prevTeam;
    let currentTeam = game.currentTeam;

    for (let i = 0; i < 50; i++) {
      game.setNextTeam();

      // verify that the teams have swapped roles
      expect(game.currentTeam).toBe(prevTeam);

      // swap the team variables for the next check
      [currentTeam, prevTeam] = [prevTeam, currentTeam];
    }
  });

  it("sets the next player correctly", () => {
    const playerNames = {
      blue: ["p2", "p4", "p6", "p8", "p10"],
      red: ["p1", "p3", "p5", "p7", "p9"],
    };

    for (let i = 0; i < 50; i++) {
      for (let j = 0; j < 50; j++) {
        game.setNextPlayer();
        expect(playerNames[game.currentTeam].includes(game.currentPlayer)).toBe(
          true
        );
        expect(
          playerNames[game.prevTeam].includes(game.currentPlayer)
        ).not.toBe(true);
      }
      game.setNextTeam();
    }
  });

  it("allows a player to select a drawbotage correctly", async () => {
    // check that the selector is the next player from either the blue team or the red team
    mockServer.onEmit("waitForDrawbotageSelection", (data) => {
      const selector = ["p10", "p9"];
      expect(selector).toContain(data.selector);
    });
    assertionCount++;

    // check that the emitted choices match the drawbotages array
    let drawbotage;
    mockServer.socketClient.on("selectDrawbotage", (data) => {
      const {
        data: { drawbotages: choices, timeRemaining },
        respond,
      } = data;

      expect(choices).toEqual(drawbotages);
      expect(timeRemaining).toBe(waitTime);
      drawbotage = choices[0];
      respond(drawbotage);
    });
    assertionCount += 2;

    // check that the emitted selection matches the choice made
    mockServer.onEmit("drawbotageSelection", (data) => {
      expect(data.selection).toBe(drawbotage);
    });
    assertionCount++;

    // check that a signal to hide the selection is sent
    mockServer.onEmit("hideDrawbotageSelection", (data) => {
      expect(true).toBe(true);
    });
    assertionCount++;

    // check that the return value is the selected drawbotage
    try {
      const selection = await game.selectDrawbotage();
      expect(selection).toBe(drawbotage);
    } catch (err) {
      throw err;
    }
    assertionCount++;

    expect.assertions(assertionCount);
  });

  it("selects a random drawbotage if the player fails to respond in time", async () => {
    // check that a timer gets emitted
    let timeRemaining = waitTime;
    mockServer.onEmit("selectDrawbotageTimer", (data) => {
      expect(data.timeRemaining).toBe(timeRemaining);
      timeRemaining -= 1000;
    });
    assertionCount += waitTime / 1000;

    // check that some drawbotage is selected
    let drawbotage;
    mockServer.onEmit("drawbotageSelection", (data) => {
      expect(data.selection).toBeTruthy();
      drawbotage = data.selection;
    });
    assertionCount++;

    // check that the return value is the selected drawbotage
    assertionCount++;
    try {
      let selection = game.selectDrawbotage();
      jest.runAllTimers();
      selection = await selection;
      expect(selection).toBe(drawbotage);
    } catch (err) {
      throw err;
    }

    expect.assertions(assertionCount);
  });

  it("allows a player to choose a word correctly", async () => {
    game.setNextPlayer();

    // check that the selector is the next player from either the blue team or the red team
    mockServer.onEmit("waitForWordSelection", (data) => {
      const selector = ["p10", "p9"];
      expect(selector).toContain(data.selector);
    });
    assertionCount++;

    // check that three choices are emitted to the selector
    let word;
    mockServer.socketClient.on("selectWord", (data) => {
      const {
        data: { words, timeRemaining },
        respond,
      } = data;
      expect(words).toHaveLength(3);
      expect(timeRemaining).toBe(waitTime);
      word = words[0];
      respond(word);
    });
    assertionCount += 2;

    // check that the emitted selection matches the choice made
    mockServer.onEmit("wordSelection", (data) => {
      expect(data.wordLength).toBe(word.length);
    });
    assertionCount++;

    // check that the return value is the selected word
    try {
      const selection = await game.selectWord();
      expect(selection).toBe(word);
    } catch (err) {
      throw err;
    }
    assertionCount++;

    expect.assertions(assertionCount);
  });

  it("selects a random word if the player fails to respond in time", async () => {
    game.setNextPlayer();

    // check that a timer gets emitted
    let timeRemaining = waitTime;
    mockServer.onEmit("selectWordTimer", (data) => {
      expect(data.timeRemaining).toBe(timeRemaining);
      timeRemaining -= 1000;
    });
    assertionCount += waitTime / 1000;

    // check that some word is selected
    mockServer.onEmit("wordSelection", (data) => {
      expect(data.wordLength).toBeGreaterThan(0);
    });
    assertionCount++;

    try {
      let selection = game.selectWord();
      jest.runAllTimers();
      selection = await selection;
    } catch (err) {
      throw err;
    }

    expect.assertions(assertionCount);
  });

  it("receives guesses from players during a turn correctly", async () => {
    game.setCurrentWord("test");
    const currentTeam = game.currentTeam;
    const prevTeam = game.prevTeam;

    // check that guesses received before receiveGuesses() is called are considered false
    const guesses = ["best", "rest", "test"];

    mockServer.onEmit("message", (data) => {
      const { isCorrect } = data;
      expect(isCorrect).toBeFalsy();
    });
    assertionCount += guesses.length * 2;

    for (let i = 0; i < guesses.length; i++) {
      mockServer.socketClient.emit("guess", {
        roomId,
        playerName: "p1",
        fromTeam: currentTeam,
        timeRemaining: 50000,
        guess: guesses[i],
      });

      mockServer.socketClient.emit("guess", {
        roomId,
        playerName: "p1",
        fromTeam: prevTeam,
        timeRemaining: 50000,
        guess: guesses[i],
      });
    }

    // check that guesses received after receiveGuesses() is called are validated correctly
    const result = game.receiveGuesses(60000);

    mockServer.onEmit("message", (data) => {
      const { isCorrect } = data;
      expect(isCorrect).toBeFalsy();
    });
    assertionCount += guesses.length;

    for (let i = 0; i < guesses.length; i++) {
      mockServer.socketClient.emit("guess", {
        roomId,
        playerName: "p1",
        fromTeam: prevTeam,
        timeRemaining: 50000,
        guess: guesses[i],
      });
    }

    mockServer.onEmit("message", (data) => {
      const { message, isCorrect } = data;
      expect(isCorrect).toBe(message.guess === "test");
    });
    assertionCount += guesses.length;

    for (let i = 0; i < guesses.length; i++) {
      mockServer.socketClient.emit("guess", {
        roomId,
        playerName: "p1",
        fromTeam: currentTeam,
        timeRemaining: 50000,
        guess: guesses[i],
      });
    }

    try {
      const res = await result;
      expect(res.playerName).toBe("p1");
      expect(res.timeRemaining).toBe(50000);
    } catch (err) {
      throw err;
    }
    assertionCount += 2;

    expect.assertions(assertionCount);
  });

  it("handles no correct guesses from players during a turn correctly", async () => {
    game.setCurrentWord("test");
    const currentTeam = game.currentTeam;
    const prevTeam = game.prevTeam;

    const result = game.receiveGuesses(60000);
    mockServer.socketClient.emit("guess", {
      roomId,
      playerName: "p1",
      fromTeam: currentTeam,
      timeRemaining: 50000,
      guess: "best",
    });
    mockServer.socketClient.emit("guess", {
      roomId,
      playerName: "p2",
      fromTeam: currentTeam,
      timeRemaining: 45000,
      guess: "rest",
    });
    mockServer.socketClient.emit("guess", {
      roomId,
      playerName: "p2",
      fromTeam: prevTeam,
      timeRemaining: 45000,
      guess: "test",
    });

    try {
      jest.runAllTimers();
      const res = await result;
      expect(res.timeRemaining).toBe(0);
    } catch (err) {
      throw err;
    }
    assertionCount++;

    expect.assertions(assertionCount);
  });

  it("calculates the score correctly", () => {
    // > 75% of draw time
    expect(game.calculatePoints(drawTime * 0.8)).toBe(100);

    // 75% of draw time
    expect(game.calculatePoints(drawTime * 0.75)).toBe(100);

    // 50% < timeRemaining < 75%
    expect(game.calculatePoints(drawTime * 0.6)).toBe(75);

    // 50% of draw time
    expect(game.calculatePoints(drawTime * 0.5)).toBe(75);

    // 25% < timeRemaining < 50%
    expect(game.calculatePoints(drawTime * 0.4)).toBe(60);

    // 25% of draw time
    expect(game.calculatePoints(drawTime * 0.25)).toBe(60);

    // 0% < timeRemaining < 25%
    expect(game.calculatePoints(drawTime * 0.1)).toBe(50);

    // 0% of draw time
    expect(game.calculatePoints(drawTime * 0)).toBe(0);
  });

  it("uses an accurate validator function", () => {
    const currentTeam = game.currentTeam;
    const prevTeam = game.prevTeam;

    game.setCurrentWord("test");
    let check = game.createGuessChecker();
    expect(check("test", currentTeam)).toBe(true);
    expect(check("best", currentTeam)).toBe(false);
    expect(check("test", prevTeam)).toBe(false);
    expect(check("best", prevTeam)).toBe(false);

    game.setNextTeam();
    game.setCurrentWord("best");
    check = game.createGuessChecker();
    expect(check("best", currentTeam)).toBe(false);
    expect(check("test", currentTeam)).toBe(false);
    expect(check("best", prevTeam)).toBe(true);
    expect(check("test", prevTeam)).toBe(false);
  });

  it("emits accurate results to the client when a player guesses the word", async () => {
    game.setCurrentWord("test");
    const currentTeam = game.currentTeam;

    mockServer.onEmit("endTurn", (data) => {
      expect(data.prevScore).toBe(0);
      expect(data.points).toBe(100);
      expect(data.currentScore).toBe(100);
      expect(data.currentTeam).toBe(currentTeam);
      expect(data.timeRemaining).toBe(50000);
      expect(data.playerName).toBe("p1");
    });
    assertionCount += 6;

    const result = game.receiveGuesses(60000);
    mockServer.socketClient.emit("guess", {
      roomId,
      playerName: "p1",
      fromTeam: currentTeam,
      timeRemaining: 50000,
      guess: "test",
    });

    try {
      const res = await result;
      await game.endTurn(res);
    } catch (err) {
      throw err;
    }

    expect.assertions(assertionCount);
  });

  it("emits accurate results to the client when no player guesses the word", async () => {
    game.setCurrentWord("test");
    const currentTeam = game.currentTeam;

    mockServer.onEmit("endTurn", (data) => {
      expect(data.prevScore).toBe(0);
      expect(data.points).toBe(0);
      expect(data.currentScore).toBe(0);
      expect(data.timeRemaining).toBe(0);
      expect(data.currentTeam).toBe(currentTeam);
    });
    assertionCount += 5;

    const result = game.receiveGuesses(60000);

    try {
      jest.runAllTimers();
      const res = await result;
      await game.endTurn(res);
    } catch (err) {
      throw err;
    }

    expect.assertions(assertionCount);
  });

  it("cleans up properly after the game is over", () => {
    mockServer.onEmit("endGame", () => {
      expect(true).toBe(true);
    });
    assertionCount++;

    game.endGame();
    expect(connection.contains(game.roomId)).toBe(false);
    assertionCount++;

    expect.assertions(assertionCount);
  });
});
