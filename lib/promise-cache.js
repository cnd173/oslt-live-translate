function createPromiseCache(limit = 256) {
  const values = new Map();

  function trim() {
    while (values.size > limit) {
      values.delete(values.keys().next().value);
    }
  }

  async function getOrCreate(key, factory) {
    if (values.has(key)) {
      const cached = values.get(key);
      values.delete(key);
      values.set(key, cached);
      return cached;
    }

    const pending = Promise.resolve().then(factory);
    values.set(key, pending);
    trim();

    try {
      return await pending;
    } catch (error) {
      if (values.get(key) === pending) values.delete(key);
      throw error;
    }
  }

  return {
    getOrCreate,
    get size() {
      return values.size;
    },
  };
}

module.exports = { createPromiseCache };
