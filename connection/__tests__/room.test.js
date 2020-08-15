const Room = require("../room");

let room;
let unassignedPlayerNames;
let playerName;
let playerSocket;

beforeEach(() => {
  room = new Room(null, "41de3945-703e-40b3-b2c3-a31c2071cbc8", 3, 60);
  unassignedPlayerNames = [];
  playerName = "p0";
  playerSocket = {
    playerName,
    teamName: "unassigned",
    roomId: "41de3945-703e-40b3-b2c3-a31c2071cbc8",
  };
});

function assertInfo(
  hostName,
  redPlayerNames,
  bluePlayerNames,
  unassignedPlayerNames,
  rounds,
  drawTime,
  size
) {
  const roomInfo = room.info();
  expect(roomInfo.host).toBe(hostName);
  expect(roomInfo.redPlayerNames).toEqual(redPlayerNames);
  expect(roomInfo.bluePlayerNames).toEqual(bluePlayerNames);
  expect(roomInfo.unassignedPlayerNames).toEqual(unassignedPlayerNames);
  expect(roomInfo.rounds).toBe(rounds);
  expect(roomInfo.drawTime).toBe(drawTime);
  expect(room.size()).toBe(size);
}

function remove(arr, val) {
  return arr.filter((e) => e !== val);
}

describe("server Room object", () => {
  it("initializes correctly", () => {
    assertInfo(null, [], [], [], 3, 60, 0);
  });

  it("adds players correctly", () => {
    // add a player
    room.add(playerName, playerSocket);
    unassignedPlayerNames.push(playerName);
    expect(room.contains(playerName)).toBe(true);
    expect(room.playerSocket(playerName)).toBe(playerSocket);
    assertInfo(null, [], [], unassignedPlayerNames, 3, 60, 1);

    // add multiple players
    for (let i = 1; i <= 50; i++) {
      playerName = "p" + i;
      playerSocket = { playerName };
      room.add(playerName, playerSocket);
      unassignedPlayerNames.push(playerName);
      expect(room.contains(playerName)).toBe(true);
      expect(room.playerSocket(playerName)).toBe(playerSocket);
      assertInfo(null, [], [], unassignedPlayerNames, 3, 60, i + 1);
    }
  });

  it("removes players correctly", () => {
    // remove a non-existent player from an empty room
    room.remove(playerName);
    assertInfo(null, [], [], unassignedPlayerNames, 3, 60, 0);

    // add and remove a player
    room.add(playerName, playerSocket);
    room.remove(playerName);
    assertInfo(null, [], [], unassignedPlayerNames, 3, 60, 0);

    // add multiple players and remove them in order of insertion
    let length = 50;
    for (let i = 0; i < length; i++) {
      playerName = "p" + i;
      playerSocket = { ...playerSocket };
      playerSocket.playerName = playerName;
      room.add(playerName, playerSocket);
      unassignedPlayerNames.push(playerName);
    }

    for (let i = 0; i < length; i++) {
      room.remove(unassignedPlayerNames.shift());
      assertInfo(null, [], [], unassignedPlayerNames, 3, 60, length - i - 1);
    }

    // add multiple players and remove them in reverse order
    for (let i = 0; i < length; i++) {
      playerName = "p" + i;
      playerSocket = { ...playerSocket };
      playerSocket.playerName = playerName;
      room.add(playerName, playerSocket);
      unassignedPlayerNames.push(playerName);
    }

    for (let i = 0; i < length; i++) {
      room.remove(unassignedPlayerNames.pop());
      assertInfo(null, [], [], unassignedPlayerNames, 3, 60, length - i - 1);
    }

    // add multiple players and remove them in a random order
    for (let i = 0; i < length; i++) {
      playerName = "p" + i;
      playerSocket = { ...playerSocket };
      playerSocket.playerName = playerName;
      room.add(playerName, playerSocket);
      unassignedPlayerNames.push(playerName);
    }

    // remove non-existent players
    room.remove("abc");
    assertInfo(null, [], [], unassignedPlayerNames, 3, 60, length);
    room.remove("123");
    assertInfo(null, [], [], unassignedPlayerNames, 3, 60, length);
    room.remove("abc123");
    assertInfo(null, [], [], unassignedPlayerNames, 3, 60, length);

    // remove existing players randomly
    for (let i = 0; i < length; i++) {
      const playerNamesRemaining = length - i;
      const pos = Math.floor(Math.random() * playerNamesRemaining);
      const [removedPlayerName] = unassignedPlayerNames.splice(pos, 1);
      room.remove(removedPlayerName);
      assertInfo(null, [], [], unassignedPlayerNames, 3, 60, length - i - 1);
    }
  });

  it("has a correct implementation of the 'contains' method", () => {
    const length = 50;

    // check for a non-existent player
    expect(room.contains(playerName)).toBe(false);

    // check for an existing player
    room.add(playerName, playerSocket);
    expect(room.contains(playerName)).toBe(true);

    // remove an existing player and check whether the player is still in the room
    room.remove(playerName);
    expect(room.contains(playerName)).toBe(false);

    // add multiple players and check whether the room contains them
    for (let i = 0; i < length; i++) {
      playerName = "p" + i;
      playerSocket = { ...playerSocket };
      playerSocket.playerName = playerName;
      room.add(playerName, playerSocket);
      unassignedPlayerNames.push(playerName);
      expect(room.contains(playerName)).toBe(true);
      expect(room.contains("abc")).toBe(false);
    }
  });

  it("has a correct implementation of the 'playerSocket' method", () => {
    // check for a non-existent socket
    expect(room.playerSocket(playerSocket)).toBeUndefined();

    // check for an existing socket
    room.add(playerName, playerSocket);
    expect(room.playerSocket(playerName)).toBe(playerSocket);

    // remove an existing player and check whether the socket is still in the room
    room.remove(playerName);
    expect(room.playerSocket(playerSocket)).toBeUndefined();

    // add multiple players and check whether the room contains the sockets
    for (let i = 0; i < 50; i++) {
      playerName = "p" + i;
      playerSocket = { ...playerSocket };
      playerSocket.playerName = playerName;
      room.add(playerName, playerSocket);
      expect(room.playerSocket(playerName)).toBe(playerSocket);
    }
  });

  it("sets hosts correctly", () => {
    // set the host in an empty room
    room.setHost(playerName, playerSocket);
    let [hostName, hostSocket] = room.getHost();
    expect(hostName).toBeNull();
    expect(hostSocket).toBeNull();

    // add a player as the host
    room.add(playerName, playerSocket);
    room.setHost(playerName, playerSocket);
    [hostName, hostSocket] = room.getHost();
    expect(hostName).toBe(playerName);
    expect(hostSocket).toBe(playerSocket);

    // set the host as non-existent player
    const newPlayerName = "abc";
    const newPlayerSocket = {
      newPlayerName,
      teamName: "unassigned",
      roomId: "41de3945-703e-40b3-b2c3-a31c2071cbc8",
    };
    room.setHost("abc", newPlayerSocket);
    [hostName, hostSocket] = room.getHost();
    expect(hostName).toBe(playerName);
    expect(hostSocket).toBe(playerSocket);

    // add the previously non-existent player and set as the host
    room.add(newPlayerName, newPlayerSocket);
    room.setHost("abc", newPlayerSocket);
    [hostName, hostSocket] = room.getHost();
    expect(hostName).toBe(newPlayerName);
    expect(hostSocket).toBe(newPlayerSocket);
  });

  it("finds a new host correctly", () => {
    const player2Name = "abc";
    const player2Socket = {
      player2Name,
      teamName: "unassigned",
      roomId: "41de3945-703e-40b3-b2c3-a31c2071cbc8",
    };
    const player3Name = "123";
    const player3Socket = {
      player3Name,
      teamName: "unassigned",
      roomId: "41de3945-703e-40b3-b2c3-a31c2071cbc8",
    };

    // add players and set a host
    room.add(playerName, playerSocket);
    room.setHost(playerName, playerSocket);
    room.add(player2Name, player2Socket);
    room.add(player3Name, player3Socket);

    // let current host leave
    room.remove(playerName);
    let [hostName, hostSocket] = room.getHost();
    expect(hostName).not.toBe(playerName);
    expect(hostSocket).not.toBe(playerSocket);
    expect(hostName).not.toBeNull();
    expect(hostSocket).not.toBeNull();
    expect([player2Name, player3Name]).toContain(hostName);
    expect([player2Socket, player3Socket]).toContain(hostSocket);

    // let new host leave
    const newHostName = hostName === player2Name ? player2Name : player3Name;
    const newHostSocket =
      hostName === player2Name ? player2Socket : player3Socket;
    const nonHostName = hostName === player2Name ? player3Name : player2Name;
    const nonHostSocket =
      hostName === player2Name ? player3Socket : player2Socket;

    room.remove(newHostName);
    [hostName, hostSocket] = room.getHost();
    expect(hostName).not.toBe(newHostName);
    expect(hostSocket).not.toBe(newHostSocket);
    expect(hostName).not.toBeNull();
    expect(hostSocket).not.toBeNull();
    expect(nonHostName).toBe(hostName);
    expect(nonHostSocket).toBe(hostSocket);

    // let last player leave
    room.remove(nonHostName);
    [hostName, hostSocket] = room.getHost();
    expect(hostName).toBeNull();
    expect(hostSocket).toBeNull();
  });

  it("updates teams correctly", () => {
    let redPlayerNames = [];
    let bluePlayerNames = [];

    // update for an invalid playerName, valid teamName, and valid insertPosition
    room.updateTeams(playerName, "red", 0);
    assertInfo(
      null,
      redPlayerNames,
      bluePlayerNames,
      unassignedPlayerNames,
      3,
      60,
      0
    );

    // update for an invalid playerName, invalid teamName, and valid insertPosition
    room.updateTeams(playerName, "green", 0);
    assertInfo(
      null,
      redPlayerNames,
      bluePlayerNames,
      unassignedPlayerNames,
      3,
      60,
      0
    );

    // update for an invalid playerName, valid teamName, and invalid insertPosition
    room.updateTeams(playerName, "red", -1);
    assertInfo(
      null,
      redPlayerNames,
      bluePlayerNames,
      unassignedPlayerNames,
      3,
      60,
      0
    );

    // update for an invalid playerName, invalid teamName, and invalid insertPosition
    room.updateTeams(playerName, "green", -1);
    assertInfo(
      null,
      redPlayerNames,
      bluePlayerNames,
      unassignedPlayerNames,
      3,
      60,
      0
    );

    // update for a valid playerName, invalid teamName, and valid insertPosition
    room.add(playerName, playerSocket);
    unassignedPlayerNames.push(playerName);
    room.updateTeams(playerName, "green", 0);
    assertInfo(
      null,
      redPlayerNames,
      bluePlayerNames,
      unassignedPlayerNames,
      3,
      60,
      1
    );

    // update for a valid playerName, valid teamName, and invalid insertPosition
    room.updateTeams(playerName, "red", -1);
    assertInfo(
      null,
      redPlayerNames,
      bluePlayerNames,
      unassignedPlayerNames,
      3,
      60,
      1
    );

    // update for an valid playerName, invalid teamName, and invalid insertPosition
    room.updateTeams(playerName, "green", -1);
    assertInfo(
      null,
      redPlayerNames,
      bluePlayerNames,
      unassignedPlayerNames,
      3,
      60,
      1
    );

    // update for an valid playerName, valid teamName, and invalid insertPosition
    redPlayerNames.push(playerName);
    unassignedPlayerNames = remove(unassignedPlayerNames, playerName);
    room.updateTeams(playerName, "red", 0);
    room.setHost(playerName);
    assertInfo(
      playerName,
      redPlayerNames,
      bluePlayerNames,
      unassignedPlayerNames,
      3,
      60,
      1
    );

    // add more players
    for (let i = 1; i < 10; i++) {
      playerName = "p" + i;
      playerSocket = {
        playerName,
        teamName: "unassigned",
        roomId: "41de3945-703e-40b3-b2c3-a31c2071cbc8",
      };
      unassignedPlayerNames.push(playerName);
      room.add(playerName, playerSocket);
    }

    /** ---------- Move a player within its own team ---------- */

    // move each player in place
    const playerNames = {
      red: redPlayerNames,
      blue: bluePlayerNames,
      unassigned: unassignedPlayerNames,
    };
    const entries = Object.entries(playerNames);

    for (let [teamName, playerNames] of entries) {
      for (let i = 0; i < playerNames.length; i++) {
        const name = playerNames[i];
        room.updateTeams(name, teamName, i);
      }
    }

    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(bluePlayerNames);
    expect(room.info().unassignedPlayerNames).toEqual(unassignedPlayerNames);

    // move a player from the front to the end of the same team
    room.updateTeams("p1", "unassigned", 8);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(bluePlayerNames);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
      "p1",
    ]);

    // move a player from the end of a team to the front of the same team
    room.updateTeams("p1", "unassigned", 0);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(bluePlayerNames);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
    ]);

    // move a player from the front to the middle of the same team
    room.updateTeams("p1", "unassigned", 3);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(bluePlayerNames);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p2",
      "p3",
      "p4",
      "p1",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
    ]);

    // move a player from the end to the middle of the same team
    room.updateTeams("p9", "unassigned", 3);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(bluePlayerNames);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p2",
      "p3",
      "p4",
      "p9",
      "p1",
      "p5",
      "p6",
      "p7",
      "p8",
    ]);

    // move a player from the middle to the middle of the same team
    room.updateTeams("p9", "unassigned", 6);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(bluePlayerNames);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p2",
      "p3",
      "p4",
      "p1",
      "p5",
      "p6",
      "p9",
      "p7",
      "p8",
    ]);

    // move a player one position down the same team
    room.updateTeams("p3", "unassigned", 2);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(bluePlayerNames);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p2",
      "p4",
      "p3",
      "p1",
      "p5",
      "p6",
      "p9",
      "p7",
      "p8",
    ]);

    // move a player one position up the same team
    room.updateTeams("p5", "unassigned", 3);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(bluePlayerNames);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p2",
      "p4",
      "p3",
      "p5",
      "p1",
      "p6",
      "p9",
      "p7",
      "p8",
    ]);

    /** ---------- Move a player to another team ---------- */

    // move a player to an empty team
    room.updateTeams("p2", "blue", 0);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(["p2"]);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p4",
      "p3",
      "p5",
      "p1",
      "p6",
      "p9",
      "p7",
      "p8",
    ]);

    // move a player to the front of another team
    room.updateTeams("p3", "blue", 0);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(["p3", "p2"]);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p4",
      "p5",
      "p1",
      "p6",
      "p9",
      "p7",
      "p8",
    ]);

    // move a player to the end of another team
    room.updateTeams("p7", "blue", 2);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(["p3", "p2", "p7"]);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p4",
      "p5",
      "p1",
      "p6",
      "p9",
      "p8",
    ]);

    // move a player to the middle of another team
    room.updateTeams("p1", "blue", 1);
    expect(room.info().redPlayerNames).toEqual(redPlayerNames);
    expect(room.info().bluePlayerNames).toEqual(["p3", "p1", "p2", "p7"]);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p4",
      "p5",
      "p6",
      "p9",
      "p8",
    ]);

    // move a player from a team with a single player
    room.updateTeams("p0", "blue", 2);
    expect(room.info().redPlayerNames).toEqual([]);
    expect(room.info().bluePlayerNames).toEqual(["p3", "p1", "p0", "p2", "p7"]);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p4",
      "p5",
      "p6",
      "p9",
      "p8",
    ]);

    // move a player from the end of one team to the end of another team
    room.updateTeams("p8", "blue", 5);
    expect(room.info().redPlayerNames).toEqual([]);
    expect(room.info().bluePlayerNames).toEqual([
      "p3",
      "p1",
      "p0",
      "p2",
      "p7",
      "p8",
    ]);
    expect(room.info().unassignedPlayerNames).toEqual(["p4", "p5", "p6", "p9"]);

    // move a player from the end of one team to the front of another team
    room.updateTeams("p9", "blue", 0);
    expect(room.info().redPlayerNames).toEqual([]);
    expect(room.info().bluePlayerNames).toEqual([
      "p9",
      "p3",
      "p1",
      "p0",
      "p2",
      "p7",
      "p8",
    ]);
    expect(room.info().unassignedPlayerNames).toEqual(["p4", "p5", "p6"]);

    // move a player from the end of one team to the middle of another team
    room.updateTeams("p6", "blue", 3);
    expect(room.info().redPlayerNames).toEqual([]);
    expect(room.info().bluePlayerNames).toEqual([
      "p9",
      "p3",
      "p1",
      "p6",
      "p0",
      "p2",
      "p7",
      "p8",
    ]);
    expect(room.info().unassignedPlayerNames).toEqual(["p4", "p5"]);

    // move a player from the front of one team to the front of another team
    room.updateTeams("p9", "unassigned", 0);
    expect(room.info().redPlayerNames).toEqual([]);
    expect(room.info().bluePlayerNames).toEqual([
      "p3",
      "p1",
      "p6",
      "p0",
      "p2",
      "p7",
      "p8",
    ]);
    expect(room.info().unassignedPlayerNames).toEqual(["p9", "p4", "p5"]);

    // move a player from the front of one team to the end of another team
    room.updateTeams("p3", "unassigned", 3);
    expect(room.info().redPlayerNames).toEqual([]);
    expect(room.info().bluePlayerNames).toEqual([
      "p1",
      "p6",
      "p0",
      "p2",
      "p7",
      "p8",
    ]);
    expect(room.info().unassignedPlayerNames).toEqual(["p9", "p4", "p5", "p3"]);

    // move a player from the front of one team to the middle of another team
    room.updateTeams("p1", "unassigned", 2);
    expect(room.info().redPlayerNames).toEqual([]);
    expect(room.info().bluePlayerNames).toEqual(["p6", "p0", "p2", "p7", "p8"]);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p9",
      "p4",
      "p1",
      "p5",
      "p3",
    ]);

    // move a player from the middle of one team to the front of another team
    room.updateTeams("p2", "red", 0);
    expect(room.info().redPlayerNames).toEqual(["p2"]);
    expect(room.info().bluePlayerNames).toEqual(["p6", "p0", "p7", "p8"]);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p9",
      "p4",
      "p1",
      "p5",
      "p3",
    ]);

    // move a player from the middle of one team to the end of another team
    room.updateTeams("p0", "red", 1);
    expect(room.info().redPlayerNames).toEqual(["p2", "p0"]);
    expect(room.info().bluePlayerNames).toEqual(["p6", "p7", "p8"]);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p9",
      "p4",
      "p1",
      "p5",
      "p3",
    ]);

    // move a player from the middle of one team to the middle of another team
    room.updateTeams("p7", "red", 1);
    expect(room.info().redPlayerNames).toEqual(["p2", "p7", "p0"]);
    expect(room.info().bluePlayerNames).toEqual(["p6", "p8"]);
    expect(room.info().unassignedPlayerNames).toEqual([
      "p9",
      "p4",
      "p1",
      "p5",
      "p3",
    ]);
  });

  it("updates settings correctly", () => {
    // update an invalid setting
    room.updateSettings("turns", 5);
    assertInfo(null, [], [], [], 3, 60, 0);

    // update the number of rounds
    room.updateSettings("rounds", 5);
    assertInfo(null, [], [], [], 5, 60, 0);

    // update the drawTime
    room.updateSettings("drawTime", 80);
    assertInfo(null, [], [], [], 5, 80, 0);
  });

  it("has a correct implementation of the 'size' method", () => {
    // check size of an empty room
    expect(room.size()).toBe(0);
    const length = 50;

    // add some players and check the room size
    for (let i = 1; i <= length; i++) {
      playerName = "p" + i;
      playerSocket = {
        playerName,
        teamName: "unassigned",
        roomId: "41de3945-703e-40b3-b2c3-a31c2071cbc8",
      };
      room.add(playerName, playerSocket);
      unassignedPlayerNames.push(playerName);
      expect(room.size()).toBe(i);
    }

    // remove all players one at a time and check the room size
    for (let i = 1; i <= length; i++) {
      room.remove(unassignedPlayerNames[i - 1]);
      expect(room.size()).toBe(length - i);
    }
  });
});
