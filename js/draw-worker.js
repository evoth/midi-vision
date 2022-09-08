import { draw } from "./draw.js";

// Set up our offscreen canvas
const bufferCanvas = new OffscreenCanvas(1, 1);
const bufferCtx = bufferCanvas.getContext("2d");
let midiData;

onmessage = async function (e) {
    // If there's only one element in the message array, it is the midiData object
    if (e.data.length == 1) {
        midiData = e.data[0];
        // Otherwise, we have received a set of arguments to pass to the draw function, in addition to the updated
        // dimensions of the canvas.
    } else {
        // Update and clear canvas
        bufferCanvas.width = e.data[0];
        bufferCanvas.height = e.data[1];
        bufferCtx.fillRect(0, 0, e.data[0], e.data[1]);

        // Pass the given arguments to the draw function, filling in the midiData and bufferCtx from local variables
        draw(midiData, bufferCtx, ...e.data.slice(2));

        // Retrieve bitmap (transferrable) image and send it back to the main thread, transferring ownership for speed
        const transferImage = await createImageBitmap(bufferCanvas);
        postMessage(transferImage, [transferImage]);
    }
}