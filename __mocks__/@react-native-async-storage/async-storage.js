let store = {};

module.exports = {
  getItem: jest.fn((key) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key, value) => {
    store[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    delete store[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    store = {};
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
  multiGet: jest.fn((keys) =>
    Promise.resolve(keys.map((k) => [k, store[k] ?? null])),
  ),
  __resetMockStorage: () => {
    store = {};
  },
};
