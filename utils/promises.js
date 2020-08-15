/**
 * Races a timeout promise that rejects after the provided number of milliseconds against the
 * provided promise. The returned promise represents the first promise of the two to fulfill.
 * @param {number} ms - The number of milliseconds to wait before rejecting the timeout promise
 * @param {Promise} promise - The promise to race against the timeout promise
 * @returns {Promise} A promise representing the result of the first promise to fulfill
 */
function timeoutPromise(ms, promise) {
  const timeout = new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeout]);
}

/**
 * Races an interval promise that rejects after the provided number of milliseconds against the
 * provided promise. The returned promise represents the first promise of the two to fulfill.
 * @param {number} ms - The number of milliseconds to wait before rejecting the interval promise. Must be >= 1000.
 * @param {Promise} promise - The promise to race against the interval promise
 * @param {function} callback - The callback to run every second until the interval promise fulfills
 * @returns {[Promise, string]} A promise representing the result of the first promise to fulfill and the id of the interval set in the interval promise
 */
function intervalPromise(ms, promise, callback) {
  let timeRemaining = ms;
  let id;

  const interval = new Promise((resolve, reject) => {
    id = setInterval(() => {
      callback(timeRemaining);
      timeRemaining -= 1000;

      if (timeRemaining <= 0) {
        clearInterval(id);
        reject(new Error(`Timed out after ${ms} ms`));
      }
    }, 1000);
  });

  return [Promise.race([promise, interval]), id];
}

/**
 * Returns a promise that resolves after the specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to wait before resolving the created promise
 */
function waitPromise(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

module.exports = {
  timeoutPromise,
  intervalPromise,
  waitPromise,
};
