const WordBank = require("../wordBank");

describe("WordBank", () => {
  it("gets the next word correctly", () => {
    const wordBank = new WordBank();
    const words = wordBank.words;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < words.length; j++) {
        expect(words[j]).toBe(wordBank.next());
      }
    }
  });
});
