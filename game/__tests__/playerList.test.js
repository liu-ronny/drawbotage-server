const Room = require("../../connection/room");
const PlayerList = require("../playerList");

let room;
let playerNames;
let playerList;

beforeEach(() => {
  playerNames = [];

  room = new Room();
  for (let i = 1; i <= 10; i++) {
    const playerName = "p" + i;
    room.add(playerName, null);
    playerNames.push(playerName);
  }

  playerList = new PlayerList(room, playerNames);
});

describe("PlayerList", () => {
  describe("next()", () => {
    it("throws an error on an empty room", () => {
      room = new Room();
      playerList = new PlayerList(room, ["p1", "p2", "p3"]);
      expect(() => playerList.next()).toThrow();
      expect(() => playerList.next()).toThrow();
    });

    it("throws an error on an empty playerNames list", () => {
      playerList = new PlayerList(room, []);
      expect(() => {
        playerList.next();
      }).toThrow();
    });

    it("gets the next player when there are no changes in the room", () => {
      for (let i = 0; i < 100; i++) {
        const playerName = playerNames[i % playerNames.length];
        expect(playerList.next()).toBe(playerName);
      }
    });

    it("gets the correct player when the next player is no longer in the room", () => {
      for (let i = 1; i <= 10; i++) {
        if (i % 2 !== 0) {
          room.remove("p" + i);
          expect(playerList.next()).toBe("p" + (i + 1));
        }
      }

      for (let i = 2; i <= 10; i += 2) {
        expect(playerList.next()).toBe("p" + i);
      }
    });

    it("gets the correct player when consecutive next players are no longer in the room", () => {
      for (let i = 1; i <= 3; i++) {
        room.remove("p" + i);
      }

      for (let i = 4; i <= 10; i++) {
        expect(playerList.next()).toBe("p" + i);
      }

      for (let i = 4; i <= 10; i++) {
        expect(playerList.next()).toBe("p" + i);
      }
    });

    it("gets the correct player when alternating next players are no longer in the room", () => {
      for (let i = 1; i <= 3; i++) {
        if (i % 2 !== 0) {
          room.remove("p" + i);
        }
      }

      expect(playerList.next()).toBe("p2");
      expect(playerList.next()).toBe("p4");

      for (let i = 5; i <= 10; i++) {
        expect(playerList.next()).toBe("p" + i);
      }
    });

    it("gets the correct player when there are two players in the room", () => {
      room = new Room();
      room.add("p1", null);
      room.add("p2", null);
      playerList = new PlayerList(room, ["p1", "p2"]);

      for (let i = 1; i <= 100; i++) {
        if (i % 2 !== 0) {
          expect(playerList.next()).toBe("p1");
        } else {
          expect(playerList.next()).toBe("p2");
        }
      }
    });

    it("reuses names when there aren't enough names remaining in the list", () => {
      for (let i = 1; i <= 5; i++) {
        room.remove("p" + i);
      }

      for (let i = 6; i <= 10; i++) {
        expect(playerList.next()).toBe("p" + i);
      }

      for (let i = 1; i <= 5; i++) {
        expect(playerList.next()).toBe("p" + (i + 5));
      }

      for (let i = 1; i <= 5; i++) {
        expect(playerList.next()).toBe("p" + (i + 5));
      }
    });

    it("throws an error if there is only one player still in the room", () => {
      room = new Room();
      room.add("p1", null);
      playerList = new PlayerList(room, ["p1"]);

      expect(() => playerList.next()).toThrow();
      expect(() => playerList.next()).toThrow();
    });

    it("throws an error if there are no one more players still in the room", () => {
      room = new Room();
      playerList = new PlayerList(room, ["p1", "p2", "p3"]);

      expect(() => playerList.next()).toThrow();
      expect(() => playerList.next()).toThrow();
      expect(() => playerList.next()).toThrow();
    });
  });

  describe("peek()", () => {
    it("gets the next player without moving forward in the list", () => {
      expect(playerList.peek()).toBe("p1");
      expect(playerList.peek()).toBe("p1");
      expect(playerList.next()).toBe("p1");
      expect(playerList.peek()).toBe("p2");
      expect(playerList.next()).toBe("p2");
    });

    it("gets the correct player when the next player is no longer in the room", () => {
      for (let i = 1; i <= 10; i++) {
        if (i % 2 !== 0) {
          room.remove("p" + i);
          expect(playerList.peek()).toBe("p" + (i + 1));
          expect(playerList.next()).toBe("p" + (i + 1));
        }
      }

      for (let i = 2; i <= 10; i += 2) {
        expect(playerList.peek()).toBe("p2");
      }
    });

    it("gets the correct player when all the player names have been used", () => {
      for (let i = 1; i <= 10; i++) {
        playerList.next();
      }

      expect(playerList.peek()).toBe("p1");
    });

    it("throws an error if there is only one player still in the room", () => {
      room = new Room();
      room.add("p1", null);
      playerList = new PlayerList(room, ["p1"]);

      expect(() => playerList.peek()).toThrow();
      expect(() => playerList.peek()).toThrow();
    });

    it("throws an error if there are no one more players still in the room", () => {
      room = new Room();
      playerList = new PlayerList(room, ["p1", "p2", "p3"]);

      expect(() => playerList.peek()).toThrow();
      expect(() => playerList.peek()).toThrow();
      expect(() => playerList.peek()).toThrow();
    });
  });
});
