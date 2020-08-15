const fs = require("fs");
const path = require("path");
const parse = require("csv-parse/lib/sync");

// read the word file and parse the contents into an array
const fileData = fs.readFileSync(
  path.join(__dirname, "./static/wordBank.csv"),
  {
    encoding: "utf-8",
  }
);
const words = parse(fileData, { bom: true }).map((row) => row[0]);

/**
 * Manages a collection of words used to play Drawbotage.
 */
class WordBank {
  /**
   * Creates a word bank that contains a shuffled array of the master list of words.
   * @property {Array} words - The available words
   * @property {number} pos - The position of the next word in the word bank
   */
  constructor() {
    this._words = [...words];
    this._shuffle(this._words);
    this._pos = 0;
  }

  /**
   * Returns a copy of the array of words in the word bank.
   * @returns {string[]} A copy of the array of words in the word bank
   */
  get words() {
    return [...this._words];
  }

  /**
   * Shuffles the words in uniformly random order, assuming that the RNG used generates independent and
   * uniformly distributed numbers between 0 and 1. This is the Durstenfeld shuffle algorithm.
   * {@link https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array source}
   */
  _shuffle() {
    for (let i = this._words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._words[i], this._words[j]] = [this._words[j], this._words[i]];
    }
  }

  /**
   * Returns the next word in the word bank. If the position of the next word is out of bounds, it resets
   * to 0 and starts counting again.
   * @returns {string} The next word in the word bank
   */
  next() {
    const word = this._words[this._pos++];

    if (this._pos === this._words.length) {
      this._pos = 0;
    }

    return word;
  }

  /**
   *
   * @param {number} number - The number of words to return
   * @returns {string[]} An array containing the number of words requested
   */
  get(number) {
    const words = [];

    for (let i = 0; i < number; i++) {
      words.push(this.next());
    }

    return words;
  }
}

module.exports = WordBank;
