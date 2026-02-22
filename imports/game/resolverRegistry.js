// Resolver registry — breaks circular dependency between decisionEngine and stateMachine
// stateMachine registers its resolve functions here; decisionEngine calls them.

const resolvers = {};

export function registerResolver(name, fn) {
  resolvers[name] = fn;
}

export function getResolver(name) {
  return resolvers[name] || null;
}
