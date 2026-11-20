// Decorative episodes only: no weather service, activity records, or persistence.
const lengths = {walk:14, tent:22, climb:22, swim:24};
const weatherFor = {
  walk:['sunset','cloudy','night','sunny'],
  tent:['rain','snow','night'],
  climb:['sunny','cloudy','sunset'],
  swim:['sunny'],
};

export function createCampSequence(random = Math.random) {
  let bag = [], previous = null;
  return {
    next() {
      if (!bag.length) {
        bag = Object.keys(lengths);
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag.at(-1) === previous) [bag[0], bag[3]] = [bag[3], bag[0]];
      }
      const kind = bag.pop(), choices = weatherFor[kind];
      const weather = choices[Math.floor(random() * choices.length)];
      const speed = .9 + random() * .2;
      previous = kind;
      return {kind, weather, speed, duration:lengths[kind] / speed};
    },
  };
}
