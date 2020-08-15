/**
 * An error that is thrown when a PlayerList is logically "empty" when its next()
 * method is called. An empty list contains < 2 elements.
 */
class EmptyPlayerListError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, EmptyPlayerListError);
  }
}

/**
 * Manages a dynamic list of player names. Its primary role is to get the next
 * available player from the provided list of names. It handles player disconnections
 * and reuses names if necessary.
 */
class PlayerList {
  /**
   * Creates a dynamic list of players that takes care of getting the next available player.
   * @param {Room} room - The room that contains the players
   * @param {string[]} playerNames - The list of player names to manage
   */
  constructor(room, playerNames) {
    this._room = room;
    this._names = [];
    this._temp = [];

    // push the list of player names in reverse order so that they pop in index order
    for (let i = playerNames.length - 1; i >= 0; i--) {
      this._names.push(playerNames[i]);
    }
  }

  /**
   * Returns the name of the next available player. If the next player is no longer in the room,
   * the player's name is discarded from the list and the search continues.
   * @throws {EmptyPlayerListError} An error indicating that the PlayerList has less than 2 players
   * @returns {string} The name of the next available player
   */
  next() {
    const namesLen = this._names.length;
    const tempLen = this._temp.length;

    if (namesLen + tempLen < 2) {
      throw new EmptyPlayerListError();
    }

    // reuse previously popped names if the main stack is empty
    if (namesLen === 0) {
      for (let i = 0; i < tempLen; i++) {
        this._names.push(this._temp.pop());
      }
    }

    // validate that the next player is available
    // if not, recursively call next, which will either eventually throw an error or return the next available player
    let top = this._names.pop();
    if (!this._room.contains(top)) {
      return this.next();
    }

    this._temp.push(top);
    return top;
  }

  /**
   * Returns the name of the next available player without moving forward in the list.
   */
  peek() {
    // get the next available player and move it back to the main stack
    const next = this.next();
    this._names.push(next);
    this._temp.pop();
    return next;
  }
}

module.exports = PlayerList;
