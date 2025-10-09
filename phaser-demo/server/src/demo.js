// demo.js
// Simple example showing how to call the public API in sequence (no Blockly).

(async function runDemo() {
  // Wait for the scene to finish creating
  await GameAPI.ready();

  console.log('Initial state:', GameAPI.getState());

  // Show a small “script” of moves:
  await GameAPI.face('right');          // face right
  await GameAPI.moveForward(1);         // go 2 tiles
//   await GameAPI.rotateLeft();           // now facing up
//   await GameAPI.moveForward(1);

  // Try to grab the star (works only if star is in front and behind is free)
  const grabbed = await GameAPI.toggleTow();
  console.log('Grabbed?', grabbed);

  // If grabbed, tow it around a bit
  if (grabbed) {
    await GameAPI.moveForward(3);
    await GameAPI.rotateRight();
    await GameAPI.moveForward(1);
    // Drop it
    await GameAPI.toggleTow();
  }

  // Try a backwards step
  await GameAPI.moveBackward(1);

  console.log('Final state:', GameAPI.getState());
})();
