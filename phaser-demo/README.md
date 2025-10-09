# GameAPI – Quick Documentation

The game exposes a global object called **`GameAPI`**.
This is the only interface you need to control the player, move the star, or check the game state.
All commands return **Promises**, so you can safely chain them (or `await` them).

Look at the `demo.js` file for a working example. To see it run, just refresh the page.

---

## Setup

Before calling anything, wait for the game to finish loading:

```js
await GameAPI.ready();
```

This ensures the player, map, and star are fully set up.

---

## Movement & Actions

Each action is **asynchronous** (returns a Promise).
You can either chain with `await` or `.then(...)`.

* **`rotateLeft()`**
  Rotate the player 90° counter-clockwise.

* **`rotateRight()`**
  Rotate the player 90° clockwise.

* **`moveForward(steps=1)`**
  Move the player forward by the given number of tiles. Stops if blocked by a wall/star.

* **`moveBackward(steps=1)`**
  Move the player backward by the given number of tiles.

* **`toggleTow()`**
  Grab or drop the star.

  * To grab: the star must be directly in front of the player and space behind must be free.
  * When towing, the star follows behind the player.

---

## Utilities

* **`face(direction)`**
  Instantly face a direction.
  Accepted strings: `"up"`, `"right"`, `"down"`, `"left"`.

* **`setPosition(x, y)`**
  Instantly teleport the player to a given tile (if valid).

---

## State

* **`getState()`** → `{ dir, isTowing, playerTile, starTile }`

Returns the current state:

* `dir`: 0=up, 1=right, 2=down, 3=left
* `isTowing`: true if towing the star
* `playerTile`: `{ x, y }` current grid position
* `starTile`: `{ x, y }` position of the star

---

## Example Script

Here’s what a Blockly-generated sequence might look like in plain JS:

```js
await GameAPI.ready();

await GameAPI.face("right");
await GameAPI.moveForward(2);
await GameAPI.rotateLeft();
await GameAPI.moveForward(1);

const grabbed = await GameAPI.toggleTow(); // try to grab star
if (grabbed) {
  await GameAPI.moveForward(3);
  await GameAPI.rotateRight();
  await GameAPI.moveForward(1);
  await GameAPI.toggleTow(); // drop star
}

console.log(GameAPI.getState());
```

---

## Blockly Notes

* Each block should map directly to one `GameAPI` call.
* If you generate async JS, use `await` before each call to enforce order.
* If not using async/await, chain calls with `.then(...)`.

Example without `async/await`:

```js
GameAPI.ready().then(() =>
  GameAPI.moveForward(1)
    .then(() => GameAPI.rotateRight())
    .then(() => GameAPI.moveForward(2))
);
```

---

👉 With this API, Blockly doesn’t need to know about Phaser, sprites, tweens, or collisions. It only needs to call `GameAPI` functions.


