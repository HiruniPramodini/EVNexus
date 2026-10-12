const fmt = (d) => d.toISOString().slice(0, 10);

export const defaultRange = () => ({
  from: fmt(new Date(Date.now() - 6 * 86400000)),
  to: fmt(new Date()),
});

export const isInvalidRange = ({ from, to }) => !!(from && to && to < from);