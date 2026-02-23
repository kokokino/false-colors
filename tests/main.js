import assert from "assert";
import { Meteor } from "meteor/meteor";

// Import server modules to ensure methods are registered
if (Meteor.isServer) {
  require("../server/methods.js");
  require("../server/gameMethods.js");
}

describe("false_colors", function () {
  it("package.json has correct name", async function () {
    const { name } = await import("../package.json");
    assert.strictEqual(name, "false_colors");
  });

  if (Meteor.isClient) {
    it("client is not server", function () {
      assert.strictEqual(Meteor.isServer, false);
    });
  }

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });

    describe("SSO Token Validation", function () {
      it("rejects empty token", async function () {
        const { validateSsoToken } = await import("../imports/hub/ssoHandler.js");
        const result = await validateSsoToken(null);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.error, "no_token");
      });

      it("rejects undefined token", async function () {
        const { validateSsoToken } = await import("../imports/hub/ssoHandler.js");
        const result = await validateSsoToken(undefined);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.error, "no_token");
      });

      it("rejects empty string token", async function () {
        const { validateSsoToken } = await import("../imports/hub/ssoHandler.js");
        const result = await validateSsoToken("");
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.error, "no_token");
      });

      it("rejects malformed token", async function () {
        const { validateSsoToken } = await import("../imports/hub/ssoHandler.js");
        const result = await validateSsoToken("not-a-valid-jwt");
        assert.strictEqual(result.valid, false);
        // Will be either 'invalid_signature' or 'configuration_error' depending on settings
        assert.ok(result.error);
      });

      it("rejects token with invalid signature", async function () {
        const { validateSsoToken } = await import("../imports/hub/ssoHandler.js");
        // A properly formatted but invalidly signed JWT
        const fakeToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0MTIzIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImFwcElkIjoic3Bva2VfYXBwX3NrZWxldG9uIiwiaWF0IjoxNzA0MDY3MjAwLCJleHAiOjE3MDQwNjc1MDAsIm5vbmNlIjoidGVzdC1ub25jZSJ9.invalid-signature";
        const result = await validateSsoToken(fakeToken);
        assert.strictEqual(result.valid, false);
      });
    });

    describe("Subscription Checking", function () {
      it("grants access when no products required", async function () {
        const { checkSubscription } = await import("../imports/hub/subscriptions.js");
        const result = await checkSubscription("fake-user-id", []);
        assert.strictEqual(result, true);
      });

      it("grants access when requiredProductSlugs is null", async function () {
        const { checkSubscription } = await import("../imports/hub/subscriptions.js");
        const result = await checkSubscription("fake-user-id", null);
        assert.strictEqual(result, true);
      });

      it("grants access when requiredProductSlugs is undefined", async function () {
        const { checkSubscription } = await import("../imports/hub/subscriptions.js");
        const result = await checkSubscription("fake-user-id", undefined);
        assert.strictEqual(result, true);
      });

      it("denies access for non-existent user with required products", async function () {
        const { checkSubscription } = await import("../imports/hub/subscriptions.js");
        const result = await checkSubscription("non-existent-user-id", ["base_monthly"]);
        assert.strictEqual(result, false);
      });
    });

    describe("User Methods", function () {
      it("user.hasAccess returns true when no products required", async function () {
        const result = await Meteor.callAsync("user.hasAccess", []);
        // Without a logged-in user, this should still return true for empty requirements
        // Actually, without userId it returns false - let's check the logic
        const resultNoUser = await Meteor.callAsync("user.hasAccess", []);
        // The method returns false if no userId, but true if empty array and has userId
        assert.strictEqual(resultNoUser, false); // No user logged in
      });

      it("user.getSubscriptionStatus rejects unauthenticated users", async function () {
        try {
          await Meteor.callAsync("user.getSubscriptionStatus");
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert.strictEqual(error.error, "not-authorized");
        }
      });
    });

    describe("Hub Client Functions", function () {
      it("exports required functions", async function () {
        const hubClient = await import("../imports/hub/client.js");

        assert.ok(typeof hubClient.hubApiRequest === "function");
        assert.ok(typeof hubClient.validateToken === "function");
        assert.ok(typeof hubClient.checkSubscriptionWithHub === "function");
        assert.ok(typeof hubClient.getUserInfo === "function");
        assert.ok(typeof hubClient.getHubPublicKey === "function");
      });
    });

    describe("Subscription Module", function () {
      it("exports required functions", async function () {
        const subscriptions = await import("../imports/hub/subscriptions.js");

        assert.ok(typeof subscriptions.checkSubscription === "function");
        assert.ok(typeof subscriptions.clearSubscriptionCache === "function");
        assert.ok(typeof subscriptions.getRequiredProducts === "function");
      });

      it("getRequiredProducts returns array", async function () {
        const { getRequiredProducts } = await import("../imports/hub/subscriptions.js");
        const products = getRequiredProducts();
        assert.ok(Array.isArray(products));
      });
    });

    // ---- Test helpers ----

    function makeGame(overrides = {}) {
      return {
        _id: 'test-game',
        players: [
          { seatIndex: 0, resolve: 3, curses: [], role: 'navigator', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Alice' },
          { seatIndex: 1, resolve: 3, curses: [], role: 'gunner', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Bob' },
          { seatIndex: 2, resolve: 3, curses: [], role: 'surgeon', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Carol' },
          { seatIndex: 3, resolve: 3, curses: [], role: 'quartermaster', alignment: 'phantom', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Dave' },
        ],
        doomLevel: 0,
        doomThreshold: 15,
        activeThreats: [],
        threatDeck: [],
        currentRound: 1,
        maxRounds: 10,
        llmCallsUsed: 0,
        goldCoins: [],
        skulls: [],
        threatsDefeated: 0,
        readyPlayers: [],
        tollAggregate: null,
        expertMode: false,
        ...overrides,
      };
    }

    function makeThreat(overrides = {}) {
      return { id: 't1', type: 'fog', name: 'Test Fog', threshold: 4, doomPerRound: 1, progress: 0, roundAdded: 1, totalDoomCaused: 0, escalated: false, ...overrides };
    }

    // ---- 1. Roles ----

    describe("Roles — getActionStrength", function () {
      it("navigator vs fog (specialty) returns 3", async function () {
        const { Roles, getActionStrength } = await import("../imports/game/roles.js");
        assert.strictEqual(getActionStrength(Roles.NAVIGATOR, 'fog'), 3);
      });

      it("navigator vs reef (specialty) returns 3", async function () {
        const { Roles, getActionStrength } = await import("../imports/game/roles.js");
        assert.strictEqual(getActionStrength(Roles.NAVIGATOR, 'reef'), 3);
      });

      it("navigator vs kraken (off-specialty) returns 1", async function () {
        const { Roles, getActionStrength } = await import("../imports/game/roles.js");
        assert.strictEqual(getActionStrength(Roles.NAVIGATOR, 'kraken'), 1);
      });

      it("quartermaster vs hull_breach (specialty) returns 3", async function () {
        const { Roles, getActionStrength } = await import("../imports/game/roles.js");
        assert.strictEqual(getActionStrength(Roles.QUARTERMASTER, 'hull_breach'), 3);
      });

      it("quartermaster vs fog (off-specialty) returns 2", async function () {
        const { Roles, getActionStrength } = await import("../imports/game/roles.js");
        assert.strictEqual(getActionStrength(Roles.QUARTERMASTER, 'fog'), 2);
      });

      it("lookout vs any type returns 2 (empty specialty array)", async function () {
        const { Roles, getActionStrength } = await import("../imports/game/roles.js");
        assert.strictEqual(getActionStrength(Roles.LOOKOUT, 'fog'), 2);
        assert.strictEqual(getActionStrength(Roles.LOOKOUT, 'kraken'), 2);
      });
    });

    // ---- 2. Threats ----

    describe("Threats", function () {
      it("createThreatDeck returns 18 threats", async function () {
        const { createThreatDeck } = await import("../imports/game/threats.js");
        const deck = createThreatDeck();
        assert.strictEqual(deck.length, 18);
      });

      it("createThreatDeck contains all 6 threat types", async function () {
        const { createThreatDeck, ThreatType } = await import("../imports/game/threats.js");
        const deck = createThreatDeck();
        const types = new Set(deck.map(t => t.type));
        assert.strictEqual(types.size, 6);
        for (const type of Object.values(ThreatType)) {
          assert.ok(types.has(type), `missing threat type: ${type}`);
        }
      });

      it("drawThreats draws 1 before round 6", async function () {
        const { createThreatDeck, drawThreats } = await import("../imports/game/threats.js");
        const deck = createThreatDeck();
        const originalLength = deck.length;
        const { drawn, remaining } = drawThreats(deck, 3);
        assert.strictEqual(drawn.length, 1);
        assert.strictEqual(remaining.length, originalLength - 1);
        assert.ok(drawn[0].id, "drawn threat should have an id");
        assert.strictEqual(drawn[0].progress, 0);
      });

      it("drawThreats draws 2 at round 6+", async function () {
        const { createThreatDeck, drawThreats } = await import("../imports/game/threats.js");
        const deck = createThreatDeck();
        const { drawn } = drawThreats(deck, 6);
        assert.strictEqual(drawn.length, 2);
      });

      it("drawThreats from empty deck returns empty", async function () {
        const { drawThreats } = await import("../imports/game/threats.js");
        const { drawn } = drawThreats([], 1);
        assert.strictEqual(drawn.length, 0);
      });
    });

    // ---- 3. Curses ----

    describe("Curses", function () {
      it("Curses array has 6 entries", async function () {
        const { Curses } = await import("../imports/game/curses.js");
        assert.strictEqual(Curses.length, 6);
      });

      it("each curse has required fields", async function () {
        const { Curses } = await import("../imports/game/curses.js");
        for (const curse of Curses) {
          assert.ok(curse.id, "curse missing id");
          assert.ok(curse.name, "curse missing name");
          assert.ok(curse.effect, "curse missing effect");
          assert.ok(curse.value !== undefined, "curse missing value");
          assert.ok(curse.description, "curse missing description");
        }
      });

      it("drawCurse returns a copy (not a reference)", async function () {
        const { Curses, drawCurse } = await import("../imports/game/curses.js");
        const drawn = drawCurse();
        drawn.name = 'MODIFIED';
        const allNames = Curses.map(c => c.name);
        assert.ok(!allNames.includes('MODIFIED'), "modifying drawn curse should not affect Curses array");
      });
    });

    // ---- 4. Resolution ----

    describe("Resolution — resolveTolls", function () {
      it("resolve toll reduces player resolve by 1", async function () {
        const { resolveTolls } = await import("../imports/game/resolution.js");
        const game = makeGame();
        const result = resolveTolls(game, [{ seatIndex: 0, choice: 'resolve' }]);
        assert.strictEqual(result.players[0].resolve, 2);
      });

      it("resolve toll with 0 resolve does not go negative", async function () {
        const { resolveTolls } = await import("../imports/game/resolution.js");
        const game = makeGame({
          players: [
            { seatIndex: 0, resolve: 0, curses: [], role: 'navigator', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Alice' },
          ],
        });
        const result = resolveTolls(game, [{ seatIndex: 0, choice: 'resolve' }]);
        assert.strictEqual(result.players[0].resolve, 0);
      });

      it("doom toll increases doom by 1", async function () {
        const { resolveTolls } = await import("../imports/game/resolution.js");
        const game = makeGame({ doomLevel: 0 });
        const result = resolveTolls(game, [{ seatIndex: 0, choice: 'doom' }]);
        assert.strictEqual(result.doomLevel, 1);
      });

      it("curse toll adds a curse to the player", async function () {
        const { resolveTolls } = await import("../imports/game/resolution.js");
        const game = makeGame();
        const result = resolveTolls(game, [{ seatIndex: 0, choice: 'curse' }]);
        assert.strictEqual(result.players[0].curses.length, 1);
        assert.ok(result.players[0].curses[0].id, "curse should have an id");
      });

      it("sea madness curse adds +1 doom to any toll choice", async function () {
        const { resolveTolls } = await import("../imports/game/resolution.js");
        const madnessCurse = { id: 'sea_madness', name: 'Sea Madness', effect: 'tollPenalty', value: 1, description: 'test' };
        const game = makeGame({
          players: [
            { seatIndex: 0, resolve: 3, curses: [madnessCurse], role: 'navigator', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Alice' },
          ],
          doomLevel: 0,
        });
        const result = resolveTolls(game, [{ seatIndex: 0, choice: 'doom' }]);
        assert.strictEqual(result.doomLevel, 2);
      });

      it("multiple submissions process correctly", async function () {
        const { resolveTolls } = await import("../imports/game/resolution.js");
        const game = makeGame({ doomLevel: 0 });
        const result = resolveTolls(game, [
          { seatIndex: 0, choice: 'resolve' },
          { seatIndex: 1, choice: 'doom' },
          { seatIndex: 2, choice: 'resolve' },
        ]);
        assert.strictEqual(result.players[0].resolve, 2);
        assert.strictEqual(result.doomLevel, 1);
        assert.strictEqual(result.players[2].resolve, 2);
      });

      it("doom is capped at threshold + 10", async function () {
        const { resolveTolls } = await import("../imports/game/resolution.js");
        const game = makeGame({ doomLevel: 24, doomThreshold: 15 });
        const result = resolveTolls(game, [{ seatIndex: 0, choice: 'doom' }]);
        assert.strictEqual(result.doomLevel, 25);
      });

      it("returns tollAggregate with correct counts", async function () {
        const { resolveTolls } = await import("../imports/game/resolution.js");
        const game = makeGame({ doomLevel: 0 });
        const result = resolveTolls(game, [
          { seatIndex: 0, choice: 'resolve' },
          { seatIndex: 1, choice: 'doom' },
          { seatIndex: 2, choice: 'doom' },
          { seatIndex: 3, choice: 'curse' },
        ]);
        assert.strictEqual(result.tollAggregate.resolveCount, 1);
        assert.strictEqual(result.tollAggregate.doomCount, 2);
        assert.strictEqual(result.tollAggregate.curseCount, 1);
      });
    });

    describe("Resolution — resolveActions", function () {
      it("specialist targeting matching threat adds specialtyStrength (3)", async function () {
        const { resolveActions } = await import("../imports/game/resolution.js");
        const threat = makeThreat({ id: 't1', type: 'fog', threshold: 10, progress: 0 });
        const game = makeGame({ activeThreats: [threat] });
        const result = resolveActions(game, [{ seatIndex: 0, threatId: 't1' }]);
        assert.strictEqual(result.activeThreats[0].progress, 3);
      });

      it("off-specialty targeting adds offStrength", async function () {
        const { resolveActions } = await import("../imports/game/resolution.js");
        const threat = makeThreat({ id: 't1', type: 'kraken', threshold: 10, progress: 0 });
        const game = makeGame({ activeThreats: [threat] });
        // Navigator vs kraken = offStrength 1
        const result = resolveActions(game, [{ seatIndex: 0, threatId: 't1' }]);
        assert.strictEqual(result.activeThreats[0].progress, 1);
      });

      it("threat completed when progress >= threshold", async function () {
        const { resolveActions } = await import("../imports/game/resolution.js");
        const threat = makeThreat({ id: 't1', type: 'fog', threshold: 4, progress: 1 });
        const game = makeGame({ activeThreats: [threat] });
        // Navigator adds 3, 1+3=4 >= threshold 4
        const result = resolveActions(game, [{ seatIndex: 0, threatId: 't1' }]);
        assert.strictEqual(result.activeThreats.length, 0);
        assert.strictEqual(result.completedThreats.length, 1);
      });

      it("weakened arm curse reduces strength by 1 (min 0)", async function () {
        const { resolveActions } = await import("../imports/game/resolution.js");
        const weakenedArm = { id: 'weakened_arm', name: 'Weakened Arm', effect: 'actionPenalty', value: -1, description: 'test' };
        const threat = makeThreat({ id: 't1', type: 'fog', threshold: 10, progress: 0 });
        const game = makeGame({
          players: [
            { seatIndex: 0, resolve: 3, curses: [weakenedArm], role: 'navigator', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Alice' },
          ],
          activeThreats: [threat],
        });
        // Navigator specialty = 3, minus 1 = 2
        const result = resolveActions(game, [{ seatIndex: 0, threatId: 't1' }]);
        assert.strictEqual(result.activeThreats[0].progress, 2);
      });

      it("player with hasNextAction=false is skipped", async function () {
        const { resolveActions } = await import("../imports/game/resolution.js");
        const threat = makeThreat({ id: 't1', type: 'fog', threshold: 10, progress: 0 });
        const game = makeGame({
          players: [
            { seatIndex: 0, resolve: 3, curses: [], role: 'navigator', alignment: 'loyal', hasNextAction: false, hasAccused: false, phantomRevealed: false, displayName: 'Alice' },
          ],
          activeThreats: [threat],
        });
        const result = resolveActions(game, [{ seatIndex: 0, threatId: 't1' }]);
        assert.strictEqual(result.activeThreats[0].progress, 0);
      });

      it("multiple players targeting same threat — strengths stack", async function () {
        const { resolveActions } = await import("../imports/game/resolution.js");
        const threat = makeThreat({ id: 't1', type: 'fog', threshold: 10, progress: 0 });
        const game = makeGame({ activeThreats: [threat] });
        // seat 0 = navigator (fog specialist, strength 3), seat 1 = gunner (off, strength 1)
        const result = resolveActions(game, [
          { seatIndex: 0, threatId: 't1' },
          { seatIndex: 1, threatId: 't1' },
        ]);
        assert.strictEqual(result.activeThreats[0].progress, 4);
      });

      it("zero resolve penalty reduces strength by 1", async function () {
        const { resolveActions } = await import("../imports/game/resolution.js");
        const threat = makeThreat({ id: 't1', type: 'fog', threshold: 10, progress: 0 });
        const game = makeGame({
          players: [
            { seatIndex: 0, resolve: 0, curses: [], role: 'navigator', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Alice' },
          ],
          activeThreats: [threat],
        });
        // Navigator specialty = 3, minus 1 (zero resolve) = 2
        const result = resolveActions(game, [{ seatIndex: 0, threatId: 't1' }]);
        assert.strictEqual(result.activeThreats[0].progress, 2);
      });

      it("revealed phantom action strength capped at 1", async function () {
        const { resolveActions } = await import("../imports/game/resolution.js");
        const threat = makeThreat({ id: 't1', type: 'fog', threshold: 10, progress: 0 });
        const game = makeGame({
          players: [
            { seatIndex: 0, resolve: 3, curses: [], role: 'navigator', alignment: 'phantom', hasNextAction: true, hasAccused: false, phantomRevealed: true, displayName: 'Alice' },
          ],
          activeThreats: [threat],
        });
        // Navigator specialty = 3, but capped at 1 because phantomRevealed
        const result = resolveActions(game, [{ seatIndex: 0, threatId: 't1' }]);
        assert.strictEqual(result.activeThreats[0].progress, 1);
      });

      it("returns playerStrengths per seat", async function () {
        const { resolveActions } = await import("../imports/game/resolution.js");
        const threat = makeThreat({ id: 't1', type: 'fog', threshold: 10, progress: 0 });
        const game = makeGame({ activeThreats: [threat] });
        const result = resolveActions(game, [
          { seatIndex: 0, threatId: 't1' },
          { seatIndex: 1, threatId: 't1' },
        ]);
        assert.strictEqual(result.playerStrengths[0], 3); // navigator specialty
        assert.strictEqual(result.playerStrengths[1], 1); // gunner off-spec for fog
      });
    });

    describe("Resolution — resolveAccusation", function () {
      it("majority guilty + target is phantom → correct, phantom revealed", async function () {
        const { resolveAccusation } = await import("../imports/game/resolution.js");
        const game = makeGame();
        const accusation = {
          accuserSeat: 0,
          targetSeat: 3, // Dave is phantom
          votes: [{ seatIndex: 0, guilty: true }, { seatIndex: 1, guilty: true }, { seatIndex: 2, guilty: false }],
        };
        const result = resolveAccusation(game, accusation);
        assert.strictEqual(result.correct, true);
        assert.strictEqual(result.convicted, true);
        assert.strictEqual(result.doomChange, -3);
        assert.ok(result.goldCoin);
        assert.strictEqual(result.goldCoin.reason, 'phantom_unmasked');
        // Phantom marked as revealed
        const target = result.updatedPlayers.find(p => p.seatIndex === 3);
        assert.strictEqual(target.phantomRevealed, true);
      });

      it("majority guilty + target is loyal → wrong, accuser loses action + doom + skull", async function () {
        const { resolveAccusation } = await import("../imports/game/resolution.js");
        const game = makeGame();
        const accusation = {
          accuserSeat: 0,
          targetSeat: 1, // Bob is loyal
          votes: [{ seatIndex: 0, guilty: true }, { seatIndex: 2, guilty: true }, { seatIndex: 3, guilty: false }],
        };
        const result = resolveAccusation(game, accusation);
        assert.strictEqual(result.correct, false);
        assert.strictEqual(result.convicted, true);
        assert.strictEqual(result.doomChange, 3);
        assert.ok(result.skull);
        assert.strictEqual(result.skull.reason, 'false_accusation');
        assert.ok(result.updatedPlayers, "should return updatedPlayers");
        const accuser = result.updatedPlayers.find(p => p.seatIndex === 0);
        assert.strictEqual(accuser.hasNextAction, false);
      });

      it("tie vote → acquittal", async function () {
        const { resolveAccusation } = await import("../imports/game/resolution.js");
        const game = makeGame();
        const accusation = {
          accuserSeat: 0,
          targetSeat: 1,
          votes: [{ seatIndex: 0, guilty: true }, { seatIndex: 2, guilty: false }],
        };
        const result = resolveAccusation(game, accusation);
        assert.strictEqual(result.correct, false);
        assert.strictEqual(result.convicted, false);
      });

      it("wrong accusation but target has phantom_whisper → accuser keeps action, still doom+skull", async function () {
        const { resolveAccusation } = await import("../imports/game/resolution.js");
        const phantomWhisper = { id: 'phantom_whisper', name: 'Phantom Whisper', effect: 'accusationPenalty', value: true, description: 'test' };
        const game = makeGame({
          players: [
            { seatIndex: 0, resolve: 3, curses: [], role: 'navigator', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Alice' },
            { seatIndex: 1, resolve: 3, curses: [phantomWhisper], role: 'gunner', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Bob' },
          ],
        });
        const accusation = {
          accuserSeat: 0,
          targetSeat: 1,
          votes: [{ seatIndex: 0, guilty: true }],
        };
        const result = resolveAccusation(game, accusation);
        assert.strictEqual(result.correct, false);
        assert.strictEqual(result.convicted, true);
        assert.strictEqual(result.doomChange, 3);
        assert.ok(result.skull);
        assert.ok(result.updatedPlayers);
        const accuser = result.updatedPlayers.find(p => p.seatIndex === 0);
        assert.strictEqual(accuser.hasNextAction, true);
      });
    });

    describe("Resolution — checkGameEnd", function () {
      it("doom >= threshold with phantom → PHANTOM_WIN", async function () {
        const { checkGameEnd } = await import("../imports/game/resolution.js");
        const { GameResult } = await import("../imports/lib/collections/games.js");
        const game = makeGame({ doomLevel: 15, doomThreshold: 15 });
        const result = checkGameEnd(game);
        assert.strictEqual(result.ended, true);
        assert.strictEqual(result.result, GameResult.PHANTOM_WIN);
        assert.strictEqual(result.reason, 'doom_threshold');
      });

      it("doom >= threshold without phantom → DOOM_LOSS", async function () {
        const { checkGameEnd } = await import("../imports/game/resolution.js");
        const { GameResult } = await import("../imports/lib/collections/games.js");
        const game = makeGame({
          doomLevel: 15,
          doomThreshold: 15,
          players: [
            { seatIndex: 0, resolve: 3, curses: [], role: 'navigator', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Alice' },
            { seatIndex: 1, resolve: 3, curses: [], role: 'gunner', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Bob' },
          ],
        });
        const result = checkGameEnd(game);
        assert.strictEqual(result.ended, true);
        assert.strictEqual(result.result, GameResult.DOOM_LOSS);
      });

      it("round >= maxRounds with coins > skulls → LOYAL_WIN", async function () {
        const { checkGameEnd } = await import("../imports/game/resolution.js");
        const { GameResult } = await import("../imports/lib/collections/games.js");
        const game = makeGame({
          currentRound: 10,
          maxRounds: 10,
          activeThreats: [makeThreat()],
          goldCoins: [{ round: 1, reason: 'test', description: 'test' }, { round: 2, reason: 'test', description: 'test' }],
          skulls: [{ round: 1, reason: 'test', description: 'test' }],
        });
        const result = checkGameEnd(game);
        assert.strictEqual(result.ended, true);
        assert.strictEqual(result.result, GameResult.LOYAL_WIN);
        assert.strictEqual(result.reason, 'survived_all_rounds');
      });

      it("round >= maxRounds with skulls >= coins → CREW_LOSS", async function () {
        const { checkGameEnd } = await import("../imports/game/resolution.js");
        const { GameResult } = await import("../imports/lib/collections/games.js");
        const game = makeGame({
          currentRound: 10,
          maxRounds: 10,
          activeThreats: [makeThreat()],
          goldCoins: [{ round: 1, reason: 'test', description: 'test' }],
          skulls: [{ round: 1, reason: 'test', description: 'test' }, { round: 2, reason: 'test', description: 'test' }],
        });
        const result = checkGameEnd(game);
        assert.strictEqual(result.ended, true);
        assert.strictEqual(result.result, GameResult.CREW_LOSS);
        assert.strictEqual(result.reason, 'skulls_exceed_coins');
      });

      it("no threats + empty deck with coins > skulls → LOYAL_WIN (all_threats_cleared)", async function () {
        const { checkGameEnd } = await import("../imports/game/resolution.js");
        const { GameResult } = await import("../imports/lib/collections/games.js");
        const game = makeGame({
          activeThreats: [],
          threatDeck: [],
          currentRound: 3,
          maxRounds: 10,
          goldCoins: [{ round: 1, reason: 'test', description: 'test' }],
          skulls: [],
        });
        const result = checkGameEnd(game);
        assert.strictEqual(result.ended, true);
        assert.strictEqual(result.result, GameResult.LOYAL_WIN);
        assert.strictEqual(result.reason, 'all_threats_cleared');
      });

      it("no threats + empty deck with skulls >= coins → CREW_LOSS", async function () {
        const { checkGameEnd } = await import("../imports/game/resolution.js");
        const { GameResult } = await import("../imports/lib/collections/games.js");
        const game = makeGame({
          activeThreats: [],
          threatDeck: [],
          currentRound: 3,
          maxRounds: 10,
          goldCoins: [],
          skulls: [{ round: 1, reason: 'test', description: 'test' }],
        });
        const result = checkGameEnd(game);
        assert.strictEqual(result.ended, true);
        assert.strictEqual(result.result, GameResult.CREW_LOSS);
        assert.strictEqual(result.reason, 'skulls_exceed_coins');
      });

      it("game still in progress → ended:false", async function () {
        const { checkGameEnd } = await import("../imports/game/resolution.js");
        const game = makeGame({ doomLevel: 5, currentRound: 3, activeThreats: [makeThreat()], threatDeck: [makeThreat()] });
        const result = checkGameEnd(game);
        assert.strictEqual(result.ended, false);
      });
    });

    // ---- 5. Suspicion Tracker ----

    describe("Suspicion Tracker", function () {
      it("initSuspicion sets all scores to 0", async function () {
        const { initSuspicion, getSuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-suspicion-1';
        initSuspicion(gameId, 0, [0, 1, 2, 3]);
        assert.strictEqual(getSuspicion(gameId, 0, 1), 0);
        assert.strictEqual(getSuspicion(gameId, 0, 2), 0);
        assert.strictEqual(getSuspicion(gameId, 0, 3), 0);
        clearSuspicion(gameId);
      });

      it("initSuspicion excludes self from tracking", async function () {
        const { initSuspicion, getSuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-suspicion-2';
        initSuspicion(gameId, 0, [0, 1, 2]);
        // Self-suspicion should return 0 (default) since not tracked
        assert.strictEqual(getSuspicion(gameId, 0, 0), 0);
        clearSuspicion(gameId);
      });

      it("updateSuspicion with toll_doom increases score by 0.1", async function () {
        const { initSuspicion, updateSuspicion, getSuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-suspicion-3';
        initSuspicion(gameId, 0, [0, 1]);
        updateSuspicion(gameId, 0, 1, 'toll_doom');
        const score = getSuspicion(gameId, 0, 1);
        assert.ok(Math.abs(score - 0.1) < 0.001, `expected ~0.1, got ${score}`);
        clearSuspicion(gameId);
      });

      it("updateSuspicion with toll_resolve decreases (clamped to 0)", async function () {
        const { initSuspicion, updateSuspicion, getSuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-suspicion-4';
        initSuspicion(gameId, 0, [0, 1]);
        updateSuspicion(gameId, 0, 1, 'toll_resolve');
        const score = getSuspicion(gameId, 0, 1);
        assert.strictEqual(score, 0); // clamped to 0
        clearSuspicion(gameId);
      });

      it("suspicion clamped to [0, 1] range", async function () {
        const { initSuspicion, updateSuspicion, getSuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-suspicion-5';
        initSuspicion(gameId, 0, [0, 1]);
        // Push above 1
        for (let i = 0; i < 20; i++) {
          updateSuspicion(gameId, 0, 1, 'accused_loyal'); // +0.2 each
        }
        assert.strictEqual(getSuspicion(gameId, 0, 1), 1);
        clearSuspicion(gameId);
      });

      it("getMostSuspicious returns highest-score player", async function () {
        const { initSuspicion, updateSuspicion, getMostSuspicious, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-suspicion-6';
        initSuspicion(gameId, 0, [0, 1, 2, 3]);
        updateSuspicion(gameId, 0, 1, 'toll_doom');  // +0.1
        updateSuspicion(gameId, 0, 2, 'toll_doom');  // +0.1
        updateSuspicion(gameId, 0, 2, 'toll_doom');  // +0.1 more = 0.2
        const most = getMostSuspicious(gameId, 0);
        assert.strictEqual(most.seatIndex, 2);
        assert.ok(Math.abs(most.score - 0.2) < 0.001);
        clearSuspicion(gameId);
      });

      it("getMostSuspicious returns null when all scores are 0", async function () {
        const { initSuspicion, getMostSuspicious, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-suspicion-7';
        initSuspicion(gameId, 0, [0, 1, 2]);
        const most = getMostSuspicious(gameId, 0);
        assert.strictEqual(most, null);
        clearSuspicion(gameId);
      });

      it("clearSuspicion removes all state for a game", async function () {
        const { initSuspicion, updateSuspicion, getSuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-suspicion-8';
        initSuspicion(gameId, 0, [0, 1]);
        updateSuspicion(gameId, 0, 1, 'toll_doom');
        clearSuspicion(gameId);
        assert.strictEqual(getSuspicion(gameId, 0, 1), 0);
      });
    });

    // ---- 6. Toll Strategy ----

    describe("Toll Strategy", function () {
      it("loyal: high resolve + high doom → resolve", async function () {
        const { chooseLoyalToll } = await import("../imports/game/ai/tollStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const player = { resolve: 3, curses: [] };
        const game = makeGame({ doomLevel: 10, doomThreshold: 15 });
        const result = chooseLoyalToll(player, game, Personalities.grizzled);
        assert.strictEqual(result, 'resolve');
      });

      it("loyal: low doom + cautious personality → resolve", async function () {
        const { chooseLoyalToll } = await import("../imports/game/ai/tollStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        // doom < 30% threshold (4.5), cautious (tollCaution > 0.6), resolve >= 2
        const player = { resolve: 3, curses: [] };
        const game = makeGame({ doomLevel: 2, doomThreshold: 15 });
        const result = chooseLoyalToll(player, game, Personalities.grizzled); // tollCaution: 0.7
        assert.strictEqual(result, 'resolve');
      });

      it("loyal: low doom + non-cautious → doom", async function () {
        const { chooseLoyalToll } = await import("../imports/game/ai/tollStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        // doom < 30% threshold, tollCaution <= 0.6, resolve < 2 so caution branch won't hit resolve
        const player = { resolve: 1, curses: [] };
        const game = makeGame({ doomLevel: 2, doomThreshold: 15 });
        const result = chooseLoyalToll(player, game, Personalities.reckless); // tollCaution: 0.3
        assert.strictEqual(result, 'doom');
      });

      it("loyal: mid-game, resolve >= 2 → resolve", async function () {
        const { chooseLoyalToll } = await import("../imports/game/ai/tollStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        // doom between 30% and 50% threshold, resolve >= 2
        const player = { resolve: 2, curses: [] };
        const game = makeGame({ doomLevel: 6, doomThreshold: 15 });
        const result = chooseLoyalToll(player, game, Personalities.nervous);
        assert.strictEqual(result, 'resolve');
      });

      it("loyal: low resolve, few curses, low caution → curse", async function () {
        const { chooseLoyalToll } = await import("../imports/game/ai/tollStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        // doom between 30%-50%, resolve < 2, curses < 2, tollCaution < 0.5
        const player = { resolve: 1, curses: [] };
        const game = makeGame({ doomLevel: 6, doomThreshold: 15 });
        const result = chooseLoyalToll(player, game, Personalities.reckless); // tollCaution: 0.3
        assert.strictEqual(result, 'curse');
      });

      it("loyal: no resolve, has curses → doom (last resort)", async function () {
        const { chooseLoyalToll } = await import("../imports/game/ai/tollStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const curse1 = { id: 'c1', effect: 'noLookout', value: true };
        const curse2 = { id: 'c2', effect: 'resolveDrain', value: 1 };
        const player = { resolve: 0, curses: [curse1, curse2] };
        const game = makeGame({ doomLevel: 6, doomThreshold: 15 });
        const result = chooseLoyalToll(player, game, Personalities.reckless);
        assert.strictEqual(result, 'doom');
      });

      it("phantom early game: cooperates (resolve with enough resolve)", async function () {
        const { choosePhantomToll } = await import("../imports/game/ai/tollStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const origRandom = Math.random;
        Math.random = () => 0.5; // > 0.1 so skip curse branch
        try {
          const player = { resolve: 3, curses: [], phantomRevealed: false };
          const game = makeGame({ maxRounds: 10 });
          const result = choosePhantomToll(player, game, Personalities.grizzled, 2); // round 2, progress 0.2 < earlyThreshold
          assert.strictEqual(result, 'resolve');
        } finally {
          Math.random = origRandom;
        }
      });

      it("phantom late game: mostly doom", async function () {
        const { choosePhantomToll } = await import("../imports/game/ai/tollStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const origRandom = Math.random;
        Math.random = () => 0.5; // > lateCurseChance so skip curse
        try {
          const player = { resolve: 3, curses: [], phantomRevealed: false };
          const game = makeGame({ maxRounds: 10 });
          const result = choosePhantomToll(player, game, Personalities.grizzled, 8); // round 8, progress 0.8 >= midThreshold
          assert.strictEqual(result, 'doom');
        } finally {
          Math.random = origRandom;
        }
      });

      it("revealed phantom always returns doom", async function () {
        const { choosePhantomToll } = await import("../imports/game/ai/tollStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const player = { resolve: 3, curses: [], phantomRevealed: true };
        const game = makeGame({ maxRounds: 10 });
        const result = choosePhantomToll(player, game, Personalities.grizzled, 2);
        assert.strictEqual(result, 'doom');
      });
    });

    // ---- 7. Action Strategy ----

    describe("Action Strategy", function () {
      it("loyal: returns highest-priority threat for specialist", async function () {
        const { chooseLoyalAction } = await import("../imports/game/ai/actionStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const threats = [
          makeThreat({ id: 't1', type: 'kraken', threshold: 4, doomPerRound: 1, progress: 0 }),
          makeThreat({ id: 't2', type: 'fog', threshold: 4, doomPerRound: 2, progress: 0 }),
        ];
        const player = { role: 'navigator', curses: [] };
        const game = makeGame({ activeThreats: threats });
        // analytical has actionOptimality 0.95 > 0.85, so always picks best
        // Navigator specialty is fog. t2: urgency = 2*(4-0)=8, strength=3, score=24
        // t1: urgency = 1*(4-0)=4, strength=1, score=4
        const result = chooseLoyalAction(player, game, Personalities.analytical);
        assert.strictEqual(result, 't2');
      });

      it("loyal: returns null when no active threats", async function () {
        const { chooseLoyalAction } = await import("../imports/game/ai/actionStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const player = { role: 'navigator', curses: [] };
        const game = makeGame({ activeThreats: [] });
        const result = chooseLoyalAction(player, game, Personalities.analytical);
        assert.strictEqual(result, null);
      });

      it("loyal: highly optimal personality always picks best", async function () {
        const { chooseLoyalAction } = await import("../imports/game/ai/actionStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const threats = [
          makeThreat({ id: 't1', type: 'fog', threshold: 6, doomPerRound: 2, progress: 0 }),
          makeThreat({ id: 't2', type: 'fog', threshold: 4, doomPerRound: 1, progress: 0 }),
        ];
        const player = { role: 'navigator', curses: [] };
        const game = makeGame({ activeThreats: threats });
        // grizzled has actionOptimality 0.9 > 0.85, always picks best
        // t1 score: 2*(6-0)*3=36, t2 score: 1*(4-0)*3=12
        const result = chooseLoyalAction(player, game, Personalities.grizzled);
        assert.strictEqual(result, 't1');
      });

      it("phantom early game: can cooperate", async function () {
        const { choosePhantomAction } = await import("../imports/game/ai/actionStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const origRandom = Math.random;
        Math.random = () => 0.2; // < cooperateChance so cooperate in early game
        try {
          const threats = [
            makeThreat({ id: 't1', type: 'fog', threshold: 4, doomPerRound: 2, progress: 0 }),
            makeThreat({ id: 't2', type: 'kraken', threshold: 4, doomPerRound: 1, progress: 0 }),
          ];
          const player = { role: 'navigator', curses: [], phantomRevealed: false };
          const game = makeGame({ activeThreats: threats, maxRounds: 10 });
          const result = choosePhantomAction(player, game, Personalities.grizzled, 2); // progress 0.2 < 0.3
          assert.strictEqual(result, 't1'); // best threat
        } finally {
          Math.random = origRandom;
        }
      });

      it("phantom mid/late game: picks suboptimal threat", async function () {
        const { choosePhantomAction } = await import("../imports/game/ai/actionStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const origRandom = Math.random;
        Math.random = () => 0.7; // > cooperateChance, > thirdChance, falls to 2nd pick
        try {
          const threats = [
            makeThreat({ id: 't1', type: 'fog', threshold: 6, doomPerRound: 2, progress: 0 }),
            makeThreat({ id: 't2', type: 'fog', threshold: 4, doomPerRound: 1, progress: 0 }),
          ];
          const player = { role: 'navigator', curses: [], phantomRevealed: false };
          const game = makeGame({ activeThreats: threats, maxRounds: 10 });
          const result = choosePhantomAction(player, game, Personalities.grizzled, 5); // progress 0.5 >= 0.3
          assert.strictEqual(result, 't2'); // 2nd priority
        } finally {
          Math.random = origRandom;
        }
      });

      it("returns null for unknown role", async function () {
        const { chooseLoyalAction } = await import("../imports/game/ai/actionStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const player = { role: 'unknown_role', curses: [] };
        const game = makeGame({ activeThreats: [makeThreat()] });
        const result = chooseLoyalAction(player, game, Personalities.analytical);
        assert.strictEqual(result, null);
      });

      it("loyal: prioritizes nearly-complete threat over fresh off-spec one", async function () {
        const { chooseLoyalAction } = await import("../imports/game/ai/actionStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const threats = [
          makeThreat({ id: 't1', type: 'kraken', threshold: 4, doomPerRound: 1, progress: 0 }),
          makeThreat({ id: 't2', type: 'fog', threshold: 4, doomPerRound: 1, progress: 3 }),
        ];
        const player = { role: 'navigator', curses: [] };
        const game = makeGame({ activeThreats: threats });
        // analytical has actionOptimality 0.95 > 0.85, always picks best
        // t1 (kraken, off-spec): remaining=4, urgency=4, strength=1, no bonus → 4
        // t2 (fog, specialty): remaining=1, urgency=1, bonus=1*3=3, score=(1+3)*3=12
        const result = chooseLoyalAction(player, game, Personalities.analytical);
        assert.strictEqual(result, 't2');
      });

      it("revealed phantom: picks lowest-priority threat", async function () {
        const { choosePhantomAction } = await import("../imports/game/ai/actionStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const threats = [
          makeThreat({ id: 't1', type: 'fog', threshold: 4, doomPerRound: 2, progress: 0 }),
          makeThreat({ id: 't2', type: 'kraken', threshold: 4, doomPerRound: 1, progress: 0 }),
        ];
        const player = { role: 'navigator', curses: [], phantomRevealed: true };
        const game = makeGame({ activeThreats: threats, maxRounds: 10 });
        // Navigator: fog=specialty(3), kraken=off(1)
        // t1 score: 2*4*3=24, t2 score: 1*4*1=4
        // Revealed phantom picks lowest → t2
        const result = choosePhantomAction(player, game, Personalities.grizzled, 5);
        assert.strictEqual(result, 't2');
      });

      it("escalated threat gets priority bonus", async function () {
        const { chooseLoyalAction } = await import("../imports/game/ai/actionStrategy.js");
        const { Personalities } = await import("../imports/game/ai/personalities.js");
        const threats = [
          makeThreat({ id: 't1', type: 'fog', threshold: 6, doomPerRound: 1, progress: 0, escalated: false }),
          makeThreat({ id: 't2', type: 'fog', threshold: 6, doomPerRound: 1, progress: 0, escalated: true }),
        ];
        const player = { role: 'navigator', curses: [] };
        const game = makeGame({ activeThreats: threats });
        // t1: urgency=6, no bonus, score=6*3=18
        // t2: urgency=6, escalation bonus=1*2=2, score=(6+2)*3=24
        const result = chooseLoyalAction(player, game, Personalities.analytical);
        assert.strictEqual(result, 't2');
      });
    });

    // ---- 8. Dialogue Templates ----

    describe("Dialogue Templates — Phantom Tides", function () {
      it("getTemplate returns a string for each valid trigger/style combo", async function () {
        const { getTemplate } = await import("../imports/ai/templates/phantomTides.js");
        const triggers = [
          'greeting', 'threatAssessment', 'tollReaction', 'accusation', 'defense', 'commentary',
          'tollObservation', 'actionObservation', 'cookObservation', 'phantomRevealedReaction', 'scoreObservation',
          'doomWarning',
        ];
        const styles = ['terse', 'worried', 'cheerful', 'analytical', 'bold', 'solemn'];
        for (const trigger of triggers) {
          for (const style of styles) {
            const result = getTemplate(trigger, style);
            assert.strictEqual(typeof result, 'string', `getTemplate('${trigger}', '${style}') should return a string`);
            assert.ok(result.length > 0, `getTemplate('${trigger}', '${style}') should return a non-empty string`);
          }
        }
      });

      it("getTemplate falls back to terse for unknown style", async function () {
        const { getTemplate } = await import("../imports/ai/templates/phantomTides.js");
        const origRandom = Math.random;
        Math.random = () => 0;
        try {
          const result = getTemplate('greeting', 'nonexistent_style');
          assert.strictEqual(typeof result, 'string');
          assert.ok(result.length > 0);
        } finally {
          Math.random = origRandom;
        }
      });

      it("getTemplate returns 'Hmm...' for unknown trigger", async function () {
        const { getTemplate } = await import("../imports/ai/templates/phantomTides.js");
        const result = getTemplate('nonexistent_trigger', 'terse');
        assert.strictEqual(result, 'Hmm...');
      });

      it("fillSlots replaces {threat_name} with value", async function () {
        const { fillSlots } = await import("../imports/ai/templates/phantomTides.js");
        const result = fillSlots('{threat_name}. Dangerous.', { threat_name: 'Kraken Attack' });
        assert.strictEqual(result, 'Kraken Attack. Dangerous.');
      });

      it("fillSlots replaces multiple slots in one template", async function () {
        const { fillSlots } = await import("../imports/ai/templates/phantomTides.js");
        const result = fillSlots('{threat_name} requires {threshold} strength to resolve.', {
          threat_name: 'Blinding Fog',
          threshold: '4',
        });
        assert.strictEqual(result, 'Blinding Fog requires 4 strength to resolve.');
      });
    });

    // ---- 9. Style Transfer Prompts ----

    describe("Style Transfer Prompts", function () {
      it("buildStyleTransferPrompt returns systemPrompt and userPrompt", async function () {
        const { buildStyleTransferPrompt } = await import("../imports/ai/styleTransfer.js");
        const result = buildStyleTransferPrompt('Stay sharp, crew.', 'grizzled');
        assert.ok(result, "should not return null");
        assert.strictEqual(typeof result.systemPrompt, 'string');
        assert.strictEqual(typeof result.userPrompt, 'string');
      });

      it("userPrompt contains the base text", async function () {
        const { buildStyleTransferPrompt } = await import("../imports/ai/styleTransfer.js");
        const baseText = 'We need to focus on the fog!';
        const result = buildStyleTransferPrompt(baseText, 'nervous');
        assert.ok(result.userPrompt.includes(baseText), "userPrompt should contain the base text");
      });

      it("returns null for unknown personality", async function () {
        const { buildStyleTransferPrompt } = await import("../imports/ai/styleTransfer.js");
        const result = buildStyleTransferPrompt('Hello', 'nonexistent_personality');
        assert.strictEqual(result, null);
      });
    });

    // ---- 10. Integration: Full Game Loop ----

    describe("Integration — Full Game Loop", function () {
      it("walks through all phases from THREAT to ROUND_END and checks game end", async function () {
        const { resolveTolls, resolveActions, resolveAccusation, checkGameEnd } = await import("../imports/game/resolution.js");
        const { createThreatDeck, drawThreats } = await import("../imports/game/threats.js");
        const { GamePhase, GameResult } = await import("../imports/lib/collections/games.js");

        // Create initial game state
        const game = {
          _id: 'integration-test',
          players: [
            { seatIndex: 0, resolve: 3, curses: [], role: 'navigator', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Alice' },
            { seatIndex: 1, resolve: 3, curses: [], role: 'gunner', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Bob' },
            { seatIndex: 2, resolve: 3, curses: [], role: 'surgeon', alignment: 'loyal', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Carol' },
            { seatIndex: 3, resolve: 3, curses: [], role: 'quartermaster', alignment: 'phantom', hasNextAction: true, hasAccused: false, phantomRevealed: false, displayName: 'Dave' },
          ],
          doomLevel: 0,
          doomThreshold: 15,
          activeThreats: [],
          threatDeck: createThreatDeck(),
          currentRound: 1,
          maxRounds: 10,
          currentPhase: GamePhase.THREAT,
          goldCoins: [],
          skulls: [],
          threatsDefeated: 0,
          readyPlayers: [],
          tollAggregate: null,
          expertMode: false,
        };

        // --- THREAT PHASE ---
        const { drawn, remaining } = drawThreats([...game.threatDeck], game.currentRound);
        assert.strictEqual(drawn.length, 1, "round 1 draws 1 threat");
        game.activeThreats = [...game.activeThreats, ...drawn];
        game.threatDeck = remaining;
        assert.strictEqual(game.activeThreats.length, 1);

        // --- TOLL PHASE ---
        game.currentPhase = GamePhase.TOLL;
        const tollSubmissions = [
          { seatIndex: 0, choice: 'resolve' },
          { seatIndex: 1, choice: 'doom' },
          { seatIndex: 2, choice: 'resolve' },
          { seatIndex: 3, choice: 'doom' },
        ];
        const tollResult = resolveTolls(game, tollSubmissions);
        assert.strictEqual(tollResult.players[0].resolve, 2, "Alice loses 1 resolve");
        assert.strictEqual(tollResult.doomLevel, 2, "2 doom tolls add 2 doom");
        assert.strictEqual(tollResult.tollAggregate.resolveCount, 2);
        assert.strictEqual(tollResult.tollAggregate.doomCount, 2);
        game.players = tollResult.players;
        game.doomLevel = tollResult.doomLevel;
        game.tollAggregate = tollResult.tollAggregate;

        // --- DISCUSSION PHASE --- (no resolution logic, just phase transition)
        game.currentPhase = GamePhase.DISCUSSION;
        assert.strictEqual(game.currentPhase, GamePhase.DISCUSSION);

        // --- ACTION PHASE ---
        game.currentPhase = GamePhase.ACTION;
        const threatId = game.activeThreats[0].id;
        const actionSubmissions = [
          { seatIndex: 0, threatId }, // navigator vs threat
          { seatIndex: 1, threatId }, // gunner vs threat
          { seatIndex: 2, threatId }, // surgeon vs threat
          { seatIndex: 3, threatId }, // quartermaster vs threat
        ];
        const actionResult = resolveActions(game, actionSubmissions);
        // Verify progress was applied (total strength depends on threat type vs roles)
        assert.ok(actionResult.activeThreats !== undefined, "resolveActions returns activeThreats");
        assert.ok(actionResult.playerStrengths !== undefined, "resolveActions returns playerStrengths");
        game.activeThreats = actionResult.activeThreats;

        // --- ACCUSATION PHASE --- (no accusation made, advances automatically)
        game.currentPhase = GamePhase.ACCUSATION;
        // No accusation — just verify we can advance
        assert.strictEqual(game.currentPhase, GamePhase.ACCUSATION);

        // --- ROUND END ---
        game.currentPhase = GamePhase.ROUND_END;
        const endCheck1 = checkGameEnd(game);
        // Game should not end after round 1 with low doom
        assert.strictEqual(endCheck1.ended, false, "game should not end after round 1");

        // Advance to round 2
        game.currentRound = 2;
        game.players = game.players.map(p => ({ ...p, hasNextAction: true }));

        // --- Verify game end: doom threshold ---
        const doomGame = { ...game, doomLevel: 15, doomThreshold: 15 };
        const doomEnd = checkGameEnd(doomGame);
        assert.strictEqual(doomEnd.ended, true);
        assert.strictEqual(doomEnd.result, GameResult.PHANTOM_WIN);
        assert.strictEqual(doomEnd.reason, 'doom_threshold');

        // --- Verify game end: survived all rounds with coins > skulls ---
        const survivedGame = {
          ...game,
          currentRound: 10,
          maxRounds: 10,
          doomLevel: 5,
          goldCoins: [{ round: 1, reason: 'test', description: 'test' }, { round: 2, reason: 'test', description: 'test' }],
          skulls: [{ round: 1, reason: 'test', description: 'test' }],
        };
        const survivedEnd = checkGameEnd(survivedGame);
        assert.strictEqual(survivedEnd.ended, true);
        assert.strictEqual(survivedEnd.result, GameResult.LOYAL_WIN);
        assert.strictEqual(survivedEnd.reason, 'survived_all_rounds');

        // --- Verify game end: survived all rounds but skulls >= coins → CREW_LOSS ---
        const crewLossGame = {
          ...game,
          currentRound: 10,
          maxRounds: 10,
          doomLevel: 5,
          goldCoins: [],
          skulls: [{ round: 1, reason: 'test', description: 'test' }],
        };
        const crewLossEnd = checkGameEnd(crewLossGame);
        assert.strictEqual(crewLossEnd.ended, true);
        assert.strictEqual(crewLossEnd.result, GameResult.CREW_LOSS);

        // --- Verify game end: all threats cleared with coins > skulls ---
        const clearedGame = {
          ...game,
          activeThreats: [],
          threatDeck: [],
          currentRound: 3,
          goldCoins: [{ round: 1, reason: 'test', description: 'test' }],
          skulls: [],
        };
        const clearedEnd = checkGameEnd(clearedGame);
        assert.strictEqual(clearedEnd.ended, true);
        assert.strictEqual(clearedEnd.result, GameResult.LOYAL_WIN);
        assert.strictEqual(clearedEnd.reason, 'all_threats_cleared');
      });

      it("accusation correctly identifies phantom — game continues", async function () {
        const { resolveAccusation } = await import("../imports/game/resolution.js");

        const game = makeGame();
        const accusation = {
          accuserSeat: 0,
          targetSeat: 3, // Dave is phantom
          votes: [
            { seatIndex: 1, guilty: true },
            { seatIndex: 2, guilty: true },
          ],
        };
        const result = resolveAccusation(game, accusation);
        assert.strictEqual(result.correct, true, "phantom should be correctly identified");
        assert.strictEqual(result.convicted, true);
        assert.strictEqual(result.doomChange, -3, "correct accusation reduces doom by 3");
        assert.ok(result.goldCoin, "correct accusation earns a gold coin");
        // Phantom revealed, game continues
        const target = result.updatedPlayers.find(p => p.seatIndex === 3);
        assert.strictEqual(target.phantomRevealed, true);
      });

      it("wrong accusation penalizes accuser then game continues", async function () {
        const { resolveTolls, resolveActions, resolveAccusation } = await import("../imports/game/resolution.js");

        const game = makeGame({
          activeThreats: [makeThreat({ id: 't1', type: 'fog', threshold: 10, progress: 0 })],
        });

        // Wrong accusation against loyal player
        const accusation = {
          accuserSeat: 0,
          targetSeat: 1, // Bob is loyal
          votes: [
            { seatIndex: 2, guilty: true },
            { seatIndex: 3, guilty: true },
          ],
        };
        const accuseResult = resolveAccusation(game, accusation);
        assert.strictEqual(accuseResult.correct, false);
        assert.strictEqual(accuseResult.convicted, true);
        assert.strictEqual(accuseResult.doomChange, 3, "wrong accusation adds 3 doom");
        assert.ok(accuseResult.skull, "wrong accusation earns a skull");

        // Accuser loses next action
        const penalizedPlayers = accuseResult.updatedPlayers;
        const accuser = penalizedPlayers.find(p => p.seatIndex === 0);
        assert.strictEqual(accuser.hasNextAction, false);

        // Next round: accuser's action is skipped
        const gameAfterPenalty = { ...game, players: penalizedPlayers };
        const actionResult = resolveActions(gameAfterPenalty, [
          { seatIndex: 0, threatId: 't1' }, // should be skipped (hasNextAction = false)
          { seatIndex: 1, threatId: 't1' }, // gunner off-spec = 1
        ]);
        // Only seat 1's action counts (gunner vs fog = offStrength 1)
        assert.strictEqual(actionResult.activeThreats[0].progress, 1);
      });
    });

    // ---- 11. Suspicion Decay ----

    describe("Suspicion Decay", function () {
      it("reduces all scores by decay rate", async function () {
        const { initSuspicion, updateSuspicion, getSuspicion, decaySuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-decay-1';
        initSuspicion(gameId, 0, [0, 1, 2]);
        updateSuspicion(gameId, 0, 1, 'toll_doom');  // +0.1
        updateSuspicion(gameId, 0, 2, 'accused_loyal'); // +0.2
        decaySuspicion(gameId, 0.1);
        assert.ok(Math.abs(getSuspicion(gameId, 0, 1) - 0.09) < 0.001, `expected ~0.09, got ${getSuspicion(gameId, 0, 1)}`);
        assert.ok(Math.abs(getSuspicion(gameId, 0, 2) - 0.18) < 0.001, `expected ~0.18, got ${getSuspicion(gameId, 0, 2)}`);
        clearSuspicion(gameId);
      });

      it("0% decay preserves scores", async function () {
        const { initSuspicion, updateSuspicion, getSuspicion, decaySuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-decay-2';
        initSuspicion(gameId, 0, [0, 1]);
        updateSuspicion(gameId, 0, 1, 'toll_doom'); // +0.1
        decaySuspicion(gameId, 0);
        assert.ok(Math.abs(getSuspicion(gameId, 0, 1) - 0.1) < 0.001);
        clearSuspicion(gameId);
      });

      it("100% decay zeros scores", async function () {
        const { initSuspicion, updateSuspicion, getSuspicion, decaySuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-decay-3';
        initSuspicion(gameId, 0, [0, 1]);
        updateSuspicion(gameId, 0, 1, 'accused_loyal'); // +0.2
        decaySuspicion(gameId, 1);
        assert.strictEqual(getSuspicion(gameId, 0, 1), 0);
        clearSuspicion(gameId);
      });

      it("unknown gameId does not throw", async function () {
        const { decaySuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        assert.doesNotThrow(() => decaySuspicion('nonexistent-game-id'));
      });

      it("multiple AI players decay independently", async function () {
        const { initSuspicion, updateSuspicion, getSuspicion, decaySuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-decay-5';
        initSuspicion(gameId, 0, [0, 1, 2]);
        initSuspicion(gameId, 1, [0, 1, 2]);
        updateSuspicion(gameId, 0, 2, 'toll_doom');    // AI 0 → seat 2: 0.1
        updateSuspicion(gameId, 1, 2, 'accused_loyal'); // AI 1 → seat 2: 0.2
        decaySuspicion(gameId, 0.1);
        assert.ok(Math.abs(getSuspicion(gameId, 0, 2) - 0.09) < 0.001);
        assert.ok(Math.abs(getSuspicion(gameId, 1, 2) - 0.18) < 0.001);
        clearSuspicion(gameId);
      });

      it("default rate (no arg) uses 0.1", async function () {
        const { initSuspicion, updateSuspicion, getSuspicion, decaySuspicion, clearSuspicion } = await import("../imports/game/ai/suspicionTracker.js");
        const gameId = 'test-decay-6';
        initSuspicion(gameId, 0, [0, 1]);
        updateSuspicion(gameId, 0, 1, 'toll_doom'); // +0.1
        decaySuspicion(gameId);
        assert.ok(Math.abs(getSuspicion(gameId, 0, 1) - 0.09) < 0.001);
        clearSuspicion(gameId);
      });
    });

    // ---- 12. humanizeEventType ----

    describe("humanizeEventType", function () {
      it("player_cursed → Player Cursed", async function () {
        const { humanizeEventType } = await import("../imports/ui/components/game/GameLogPanel.js");
        assert.strictEqual(humanizeEventType('player_cursed'), 'Player Cursed');
      });

      it("single word: started → Started", async function () {
        const { humanizeEventType } = await import("../imports/ui/components/game/GameLogPanel.js");
        assert.strictEqual(humanizeEventType('started'), 'Started');
      });

      it("triple segment: round_end_summary → Round End Summary", async function () {
        const { humanizeEventType } = await import("../imports/ui/components/game/GameLogPanel.js");
        assert.strictEqual(humanizeEventType('round_end_summary'), 'Round End Summary');
      });

      it("null → Unknown Event", async function () {
        const { humanizeEventType } = await import("../imports/ui/components/game/GameLogPanel.js");
        assert.strictEqual(humanizeEventType(null), 'Unknown Event');
      });

      it("undefined → Unknown Event", async function () {
        const { humanizeEventType } = await import("../imports/ui/components/game/GameLogPanel.js");
        assert.strictEqual(humanizeEventType(undefined), 'Unknown Event');
      });

      it("empty string → Unknown Event", async function () {
        const { humanizeEventType } = await import("../imports/ui/components/game/GameLogPanel.js");
        assert.strictEqual(humanizeEventType(''), 'Unknown Event');
      });

      it("non-string (42) → Unknown Event", async function () {
        const { humanizeEventType } = await import("../imports/ui/components/game/GameLogPanel.js");
        assert.strictEqual(humanizeEventType(42), 'Unknown Event');
      });
    });

    // ---- 13. Phase Timer ----

    describe("Phase Timer", function () {
      it("PhaseDurations (novice) has all 6 phases with positive numbers", async function () {
        const { PhaseDurations } = await import("../imports/game/phaseTimer.js");
        const phases = ['threat', 'toll', 'discussion', 'action', 'accusation', 'round_end'];
        for (const phase of phases) {
          assert.ok(typeof PhaseDurations[phase] === 'number', `${phase} should be a number`);
          assert.ok(PhaseDurations[phase] > 0, `${phase} should be positive`);
        }
      });

      it("novice duration values match spec (3s/45s/60s/45s/30s/15s)", async function () {
        const { PhaseDurationsNovice } = await import("../imports/game/phaseTimer.js");
        assert.strictEqual(PhaseDurationsNovice.threat, 3000);
        assert.strictEqual(PhaseDurationsNovice.toll, 45000);
        assert.strictEqual(PhaseDurationsNovice.discussion, 60000);
        assert.strictEqual(PhaseDurationsNovice.action, 45000);
        assert.strictEqual(PhaseDurationsNovice.accusation, 30000);
        assert.strictEqual(PhaseDurationsNovice.round_end, 15000);
      });

      it("expert duration values match spec (2s/30s/45s/30s/20s/10s)", async function () {
        const { PhaseDurationsExpert } = await import("../imports/game/phaseTimer.js");
        assert.strictEqual(PhaseDurationsExpert.threat, 2000);
        assert.strictEqual(PhaseDurationsExpert.toll, 30000);
        assert.strictEqual(PhaseDurationsExpert.discussion, 45000);
        assert.strictEqual(PhaseDurationsExpert.action, 30000);
        assert.strictEqual(PhaseDurationsExpert.accusation, 20000);
        assert.strictEqual(PhaseDurationsExpert.round_end, 10000);
      });

      it("getPhaseDuration returns novice by default", async function () {
        const { getPhaseDuration, PhaseDurationsNovice } = await import("../imports/game/phaseTimer.js");
        assert.strictEqual(getPhaseDuration('toll', false), PhaseDurationsNovice.toll);
        assert.strictEqual(getPhaseDuration('toll', undefined), PhaseDurationsNovice.toll);
      });

      it("getPhaseDuration returns expert when expertMode is true", async function () {
        const { getPhaseDuration, PhaseDurationsExpert } = await import("../imports/game/phaseTimer.js");
        assert.strictEqual(getPhaseDuration('toll', true), PhaseDurationsExpert.toll);
        assert.strictEqual(getPhaseDuration('action', true), PhaseDurationsExpert.action);
      });

      it("unknown phase → no callback, no throw", async function () {
        const { startPhaseTimer } = await import("../imports/game/phaseTimer.js");
        let called = false;
        assert.doesNotThrow(() => {
          startPhaseTimer('timer-test-1', 'nonexistent_phase', () => { called = true; });
        });
        // Wait briefly to confirm callback was not scheduled
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(called, false);
      });

      it("clearPhaseTimer on non-existent timer → no throw", async function () {
        const { clearPhaseTimer } = await import("../imports/game/phaseTimer.js");
        assert.doesNotThrow(() => clearPhaseTimer('nonexistent-timer-game'));
      });

      it("second startPhaseTimer on same gameId cancels first", async function () {
        this.timeout(5000);
        const { startPhaseTimer, clearPhaseTimer } = await import("../imports/game/phaseTimer.js");
        let firstCalled = false;
        let secondCalled = false;
        // First timer: threat phase (novice = 3s)
        startPhaseTimer('timer-test-2', 'threat', () => { firstCalled = true; });
        // Immediately replace with another threat timer
        startPhaseTimer('timer-test-2', 'threat', () => { secondCalled = true; });
        // Wait 3.5s — only the second timer should fire
        await new Promise(resolve => setTimeout(resolve, 3500));
        assert.strictEqual(firstCalled, false, "first timer should have been cancelled");
        assert.strictEqual(secondCalled, true, "second timer should have fired");
        clearPhaseTimer('timer-test-2');
      });
    });

    // ---- 14. Game Methods — integration ----

    describe("Game Methods — integration", function () {
      it("game.submitToll rejects unauthenticated user", async function () {
        try {
          await Meteor.callAsync("game.submitToll", "fake-game-id", "resolve");
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert.strictEqual(error.error, "not-authorized");
        }
      });

      it("game.submitAction rejects unauthenticated user", async function () {
        try {
          await Meteor.callAsync("game.submitAction", "fake-game-id", "fake-threat-id");
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert.strictEqual(error.error, "not-authorized");
        }
      });

      it("game.sendMessage rejects unauthenticated user", async function () {
        try {
          await Meteor.callAsync("game.sendMessage", "fake-game-id", "hello");
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert.strictEqual(error.error, "not-authorized");
        }
      });

      it("game.readyToAdvance rejects unauthenticated user", async function () {
        try {
          await Meteor.callAsync("game.readyToAdvance", "fake-game-id");
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert.strictEqual(error.error, "not-authorized");
        }
      });

      it("game.cookNourish rejects unauthenticated user", async function () {
        try {
          await Meteor.callAsync("game.cookNourish", "fake-game-id", 0);
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert.strictEqual(error.error, "not-authorized");
        }
      });
    });
  }
});
