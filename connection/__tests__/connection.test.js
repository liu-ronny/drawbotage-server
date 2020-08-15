const Connection = require("../connection");
const MockSocket = require("socket.io-mock");

let connection;
let mockServer;
let unassignedPlayerNames;
let assertionCount;
const server = {};
const events = [
  "connection",
  "createGame",
  "joinGame",
  "updateTeams",
  "updateSettings",
  "startGame",
  "leaveGame",
  "disconnect",
];
const joinGameErrorMsg =
  "Something went wrong when attempting to join the game. Please try again.";
const updateTeamsErrorMsg =
  "Something went wrong while the host attempted to update the teams. Please try again.";
const updateSettingsErrorMsg =
  "Something went wrong while the host attempted to update the settings. Please try again.";

MockSocket.prototype.to = function (roomKey) {
  return this.broadcast.to(roomKey);
};
MockSocket.prototype.emitEvent = function (eventKey, payload) {
  this._emitFn(eventKey, payload);
};
MockSocket.prototype.removeBroadcastEvent = function (eventKey) {
  delete this.generalCallbacks[eventKey];
};

jest.mock("socket.io", () => {
  return jest.fn(() => mockServer);
});

const assertionsPerRoomInfoCheck = 6;
function assertInfo(
  roomInfo,
  hostName,
  redPlayerNames,
  bluePlayerNames,
  unassignedPlayerNames,
  rounds,
  drawTime
) {
  expect(roomInfo.host).toBe(hostName);
  expect(roomInfo.redPlayerNames).toEqual(redPlayerNames);
  expect(roomInfo.bluePlayerNames).toEqual(bluePlayerNames);
  expect(roomInfo.unassignedPlayerNames).toEqual(unassignedPlayerNames);
  expect(roomInfo.rounds).toBe(rounds);
  expect(roomInfo.drawTime).toBe(drawTime);
}

function emitToServer(event, data) {
  const { playerName, pushTo } = data;
  const defaults = {
    roomId: "41de3945-703e-40b3-b2c3-a31c2071cbc8",
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

function haveClientsJoinGame(
  clientCount,
  pushTo = unassignedPlayerNames,
  roomId
) {
  mockServer.onEmit("info", (data) => {
    assertInfo(data, "p1", [], [], pushTo, 3, 60);
  });

  for (let i = 2; i < clientCount + 2; i++) {
    emitToServer("joinGame", {
      playerName: "p" + i,
      pushTo,
      roomId,
    });
    assertionCount += assertionsPerRoomInfoCheck;
  }
  mockServer.removeBroadcastEvent("info");
}

beforeEach(() => {
  mockServer = new MockSocket();
  mockServer.sockets = mockServer;
  mockServer.set = () => {};
  connection = new Connection(mockServer);
  unassignedPlayerNames = [];
  assertionCount = 0;
  mockServer.socketClient.emit("connection", mockServer);
});

describe("socket.io connection", () => {
  it("adds the correct listeners on connection", () => {
    expect(mockServer.hasListeners("connection")).toBe(true);
    for (let event of events) {
      expect(mockServer.hasListeners(event)).toBe(true);
    }
  });

  it("handles createGame events correctly", () => {
    expect.hasAssertions();

    mockServer.onEmit("info", (data) => {
      assertInfo(data, "p1", [], [], unassignedPlayerNames, 3, 60);
    });
    emitToServer("createGame", {
      playerName: "p1",
      pushTo: unassignedPlayerNames,
    });
  });

  it("handles joinGame events correctly", () => {
    // create a game
    emitToServer("createGame", {
      playerName: "p1",
      pushTo: unassignedPlayerNames,
    });

    // join a non-existent game
    mockServer.socketClient.on("error", (data) => {
      expect(data.message).toBe(joinGameErrorMsg);
    });
    emitToServer("joinGame", { playerName: "p2", roomId: "abc" });
    assertionCount++;

    // join an existing game multiple times
    haveClientsJoinGame(10);

    expect.assertions(assertionCount);
  });

  it("handles updateTeams events correctly", () => {
    // create a game
    emitToServer("createGame", {
      playerName: "p1",
      pushTo: unassignedPlayerNames,
    });

    // update a non-existent game
    mockServer.onEmit("error", (data) => {
      expect(data.message).toBe(updateTeamsErrorMsg);
    });
    assertionCount++;
    emitToServer("updateTeams", {
      playerName: "p1",
      roomId: "abc",
      newTeam: "red",
      insertPosition: 0,
    });

    // join an existing game multiple times
    haveClientsJoinGame(4);

    let assertionArgs;
    mockServer.onEmit("info", (data) => {
      assertInfo(data, ...assertionArgs);
    });

    // move a player to the red team
    assertionArgs = ["p1", ["p3"], [], ["p1", "p2", "p4", "p5"], 3, 60];
    assertionCount += assertionsPerRoomInfoCheck;
    emitToServer("updateTeams", {
      playerName: "p3",
      newTeamName: "red",
      insertPosition: 0,
    });

    // move a player to the blue team
    assertionArgs = ["p1", ["p3"], ["p4"], ["p1", "p2", "p5"], 3, 60];
    assertionCount += assertionsPerRoomInfoCheck;
    emitToServer("updateTeams", {
      playerName: "p4",
      newTeamName: "blue",
      insertPosition: 0,
    });

    // move a player in-place
    assertionArgs = ["p1", ["p3"], ["p4"], ["p1", "p2", "p5"], 3, 60];
    assertionCount += assertionsPerRoomInfoCheck;
    emitToServer("updateTeams", {
      playerName: "p2",
      newTeamName: "unassigned",
      insertPosition: 1,
    });

    // move a player to a different position on the same team
    assertionArgs = ["p1", ["p3"], ["p4"], ["p2", "p1", "p5"], 3, 60];
    assertionCount += assertionsPerRoomInfoCheck;
    emitToServer("updateTeams", {
      playerName: "p2",
      newTeamName: "unassigned",
      insertPosition: 0,
    });

    // move a player from one team to another
    assertionArgs = ["p1", [], ["p4", "p3"], ["p2", "p1", "p5"], 3, 60];
    assertionCount += assertionsPerRoomInfoCheck;
    emitToServer("updateTeams", {
      playerName: "p3",
      newTeamName: "blue",
      insertPosition: 1,
    });

    expect.assertions(assertionCount);
  });

  it("handles updateSettings events correctly", () => {
    // create a game
    emitToServer("createGame", {
      playerName: "p1",
      pushTo: unassignedPlayerNames,
    });

    // update settings on a non-existent game
    mockServer.onEmit("error", (data) => {
      expect(data.message).toBe(updateSettingsErrorMsg);
    });
    assertionCount++;
    emitToServer("updateSettings", {
      roomId: "abc",
      settingName: "rounds",
      settingValue: 5,
    });

    // update the number of rounds on an existing game
    mockServer.onEmit("info", (data) => {
      assertInfo(data, "p1", [], [], unassignedPlayerNames, 5, 60);
    });
    assertionCount += assertionsPerRoomInfoCheck;
    emitToServer("updateSettings", {
      settingName: "rounds",
      settingValue: 5,
    });

    // update the draw time on an existing game
    mockServer.onEmit("info", (data) => {
      assertInfo(data, "p1", [], [], unassignedPlayerNames, 5, 80);
    });
    assertionCount += assertionsPerRoomInfoCheck;
    emitToServer("updateSettings", {
      settingName: "drawTime",
      settingValue: 80,
    });

    expect.assertions(assertionCount);
  });

  it("handles startGame correctly", () => {
    expect.hasAssertions();

    // create a game
    emitToServer("createGame", {
      playerName: "p1",
      pushTo: unassignedPlayerNames,
    });

    // start the game
    mockServer.onEmit("startGame", () => {
      expect(true).toBe(true);
    });
    emitToServer("startGame", {});
  });

  it("handles leaveGame correctly", () => {
    // create a game
    emitToServer("createGame", {
      playerName: "p1",
      pushTo: unassignedPlayerNames,
    });

    // leave non-existent game
    emitToServer("leaveGame", {
      playerName: "p1",
      roomId: "abc",
    });

    // join an existing game multiple times
    haveClientsJoinGame(5);

    // leave game multiple times until there are no players left
    let remainingPlayerNames = [...unassignedPlayerNames];

    mockServer.onEmit("info", (data) => {
      expect(remainingPlayerNames).toContain(data.host);
      assertInfo(data, data.host, [], [], remainingPlayerNames, 3, 60);
    });
    for (const playerName of unassignedPlayerNames) {
      remainingPlayerNames = remainingPlayerNames.filter(
        (name) => name !== playerName
      );
      emitToServer("leaveGame", {
        playerName,
      });
      assertionCount += assertionsPerRoomInfoCheck + 1;
    }
    // after the last player is removed there will be no info event emitted
    assertionCount -= assertionsPerRoomInfoCheck + 1;

    expect.assertions(assertionCount);
  });

  it("implements the 'contains' method correctly", () => {
    const roomId = "41de3945-703e-40b3-b2c3-a31c2071cbc8";

    // check for a non-existent room
    expect(connection.contains("abc")).toBe(false);
    expect(connection.contains(roomId)).toBe(false);
    assertionCount += 2;

    mockServer.onEmit("info", () => {
      expect(true).toBe(true);
    });

    // create a game
    emitToServer("createGame", {
      playerName: "p1",
      roomId,
      pushTo: unassignedPlayerNames,
    });
    assertionCount++;

    // check for an existing room
    expect(connection.contains(roomId)).toBe(true);
    assertionCount++;

    // leave the newly created room and check for its existence
    emitToServer("leaveGame", {
      playerName: "p1",
      roomId,
    });
    expect(connection.contains(roomId)).toBe(false);
    assertionCount++;

    // create another game
    unassignedPlayerNames = [];
    emitToServer("createGame", {
      playerName: "p1",
      roomId,
      pushTo: unassignedPlayerNames,
    });
    expect(connection.contains(roomId)).toBe(true);
    assertionCount += 2;

    haveClientsJoinGame(5, unassignedPlayerNames, roomId);

    // re-add info event listener since haveClientsJoinGame will clear it
    mockServer.onEmit("info", (data) => {
      expect(true).toBe(true);
    });

    // remove all players from roomId
    for (let playerName of unassignedPlayerNames) {
      emitToServer("leaveGame", {
        playerName,
        roomId,
      });
      assertionCount++;
    }
    assertionCount--;

    expect(connection.contains(roomId)).toBe(false);
    assertionCount++;

    // create another game
    unassignedPlayerNames = [];
    emitToServer("createGame", {
      playerName: "p1",
      roomId,
      pushTo: unassignedPlayerNames,
    });
    expect(connection.contains(roomId)).toBe(true);
    assertionCount += 2;

    // re-add info event listener since haveClientsJoinGame will clear it
    mockServer.onEmit("info", (data) => {
      expect(true).toBe(true);
    });

    // disonnect the player from roomId
    emitToServer("disconnect", {});
    expect(connection.contains(roomId)).toBe(false);
    assertionCount++;

    expect.assertions(assertionCount);
  });
});
